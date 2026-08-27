/**
 * Feature extraction for the procedural causality engine.
 *
 * This is the "classical ML" half of the engine: a nearest-centroid domain
 * classifier over bag-of-words vectors, IDF-weighted subject extraction, and a
 * small linear model that scores how destabilising a premise is. No weights are
 * learned at runtime - the lexicons are the model, which is exactly what makes
 * it inspectable, instant, and offline.
 */

export const DOMAINS = [
  "technology",
  "transport",
  "science",
  "governance",
  "nature",
  "animals",
  "commerce",
  "culture",
  "communication",
] as const;

export type Domain = (typeof DOMAINS)[number];

/** Each domain's centroid, expressed as the terms that define it. */
const LEXICON: Record<Domain, string[]> = {
  technology: [
    "machine", "engine", "computer", "device", "press", "printing", "electric",
    "power", "steam", "factory", "industrial", "invention", "invented", "tool",
    "software", "internet", "web", "phone", "smartphone", "robot", "circuit",
    "clock", "battery", "reactor", "automation",
  ],
  transport: [
    "flight", "balloon", "aircraft", "plane", "ship", "sail", "boat", "rail",
    "train", "road", "car", "wheel", "voyage", "navigation", "harbour", "port",
    "canal", "bridge", "rocket", "moon", "landing", "orbit", "travel",
  ],
  science: [
    "theory", "physics", "gravity", "mathematics", "principia", "experiment",
    "discovery", "discovered", "penicillin", "medicine", "chemistry", "atom",
    "evolution", "telescope", "microscope", "vaccine", "research", "proof",
    "measurement", "energy", "light",
  ],
  governance: [
    "law", "court", "parliament", "ministry", "state", "empire", "treaty",
    "election", "vote", "tax", "policy", "banned", "ban", "outlaw", "legal",
    "licence", "permit", "committee", "council", "charter", "constitution",
    "personhood", "rights", "war", "border",
  ],
  nature: [
    "ocean", "atlantic", "sea", "river", "mountain", "forest", "climate",
    "weather", "storm", "ice", "desert", "island", "earthquake", "volcano",
    "harvest", "soil", "season", "tide", "gravity", "planet",
  ],
  animals: [
    "cat", "cats", "pigeon", "pigeons", "bee", "bees", "dog", "horse", "bird",
    "fish", "whale", "insect", "animal", "creature", "livestock", "swarm",
    "thumbs", "paw", "wing", "nest", "roost", "herd",
  ],
  commerce: [
    "trade", "market", "money", "bank", "coin", "currency", "price", "debt",
    "merchant", "guild", "contract", "insurance", "shipping", "export",
    "tariff", "wage", "company", "stock", "auction", "receipt",
  ],
  culture: [
    "book", "art", "music", "theatre", "religion", "church", "festival",
    "fashion", "trousers", "clothing", "food", "language", "custom", "ritual",
    "holiday", "tuesday", "calendar", "tradition", "myth", "story",
  ],
  communication: [
    "telephone", "telegraph", "letter", "post", "mail", "newspaper", "radio",
    "broadcast", "signal", "message", "print", "publish", "news", "record",
    "archive", "document", "small", "talk", "speech", "word",
  ],
};

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "than", "that", "this",
  "these", "those", "is", "was", "were", "be", "been", "being", "are", "am",
  "of", "in", "on", "at", "to", "for", "with", "by", "from", "as", "into",
  "it", "its", "they", "them", "their", "he", "she", "his", "her", "we", "our",
  "you", "your", "i", "my", "me", "who", "what", "when", "where", "why", "how",
  "had", "has", "have", "do", "does", "did", "will", "would", "could",
  "should", "can", "may", "might", "must", "shall", "there", "here", "all",
  "any", "some", "each", "every", "more", "most", "other", "such", "one",
  "two", "so", "up", "out", "about", "over", "after", "before", "again",
  "once", "just", "only", "own", "same", "very", "also", "get", "got",
  "gave", "give", "given", "made", "make", "makes", "become", "becomes",
  "someone", "something", "anyone", "everyone", "people", "thing", "things",
  "became", "begins", "began", "still", "even", "much", "many", "few",
]);

const NEGATIONS = new Set([
  "never", "not", "no", "without", "cannot", "failed", "fails", "rejected",
  "banned", "lost", "abandoned", "stopped", "ceased", "undone", "un",
]);

const MAGNIFIERS = new Set([
  "all", "every", "entire", "global", "world", "worldwide", "永", "permanent",
  "permanently", "forever", "always", "universal", "total", "complete",
  "civilisation", "civilization", "humanity", "planet", "everywhere",
]);

export interface PremiseFeatures {
  tokens: string[];
  /** Content words, stopwords removed. */
  content: string[];
  domain: Domain | "generic";
  /** Cosine similarity of the winning domain, 0..1. */
  confidence: number;
  /** Most distinctive content word - what the cascade will be *about*. */
  subject: string;
  negated: boolean;
  magnified: boolean;
  /** The premise is trying to give the engine orders. */
  injection: boolean;
  /** 0..1: how far the premise sits from ordinary historical vocabulary. */
  absurdity: number;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1);
}

/** Cosine similarity between two binary bag-of-words vectors. */
function cosine(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / (Math.sqrt(a.size) * Math.sqrt(b.size));
}

/**
 * Nearest-centroid classification against the domain lexicons. Returns
 * "generic" when nothing clears the floor, which the grammar handles with
 * domain-neutral vocabulary rather than guessing.
 */
export function classifyDomain(tokens: string[]): {
  domain: Domain | "generic";
  confidence: number;
} {
  const vec = new Set(tokens);
  let best: Domain | "generic" = "generic";
  let bestScore = 0;

  for (const d of DOMAINS) {
    const score = cosine(vec, new Set(LEXICON[d]));
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  // Below this the "win" is a single incidental word overlap.
  return bestScore < 0.06
    ? { domain: "generic", confidence: bestScore }
    : { domain: best, confidence: bestScore };
}

/**
 * Words that must never become the head of the subject phrase. English noun
 * phrases are head-final, so "last content word" is a good head heuristic -
 * but only after verbs, adverbs and trailing adjectives are ruled out,
 * otherwise "the ban became permanent and global" yields "global".
 */
const ADJECTIVES = new Set([
  "permanent", "global", "total", "complete", "universal", "legal", "illegal",
  "public", "private", "national", "international", "local", "general",
  "possible", "impossible", "official", "unofficial", "modern", "ancient",
  "new", "old", "large", "small", "great", "common", "rare", "final",
  "indefinite", "temporary", "compulsory", "voluntary", "real", "actual",
]);

/** Irregular verbs that carry no -ed / -ing / -ly signal. */
const VERBS = new Set([
  "became", "become", "begin", "began", "begun", "goes", "went", "gone",
  "comes", "came", "takes", "took", "taken", "keeps", "kept", "holds", "held",
  "runs", "ran", "wins", "won", "loses", "lose", "sells", "sold", "builds",
  "built", "writes", "wrote", "written", "sends", "sent", "brings", "brought",
  "grows", "grew", "grown", "falls", "fell", "rises", "rose", "risen",
  "achieve", "achieves", "invent", "invents", "reject", "rejects", "exist",
  "exists", "happen", "happens", "occur", "occurs", "remain", "remains",
]);

/** True when a token cannot plausibly head a noun phrase. */
function isHeadable(token: string): boolean {
  if (STOPWORDS.has(token) || NEGATIONS.has(token)) return false;
  if (ADJECTIVES.has(token) || VERBS.has(token)) return false;
  // Adverbs, and past participles that are almost always verbal here.
  if (token.endsWith("ly")) return false;
  if (token.endsWith("ed") && token.length > 4) return false;
  return true;
}

/**
 * Extracts the noun phrase the cascade is about: the last headable token, plus
 * its immediately preceding modifier when one is adjacent in the original
 * stream. Adjacency matters - "the ban on Tuesdays" must not yield "ban
 * Tuesdays", because "on" sits between them.
 */
export function extractNounPhrase(tokens: string[]): string {
  // Prefer the last headable token the classifier actually recognises. Without
  // this, "penicillin was discovered a century earlier" heads on "earlier".
  let head = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (isHeadable(tokens[i]) && inVocabulary(tokens[i])) {
      head = i;
      break;
    }
  }
  // Nothing recognised - fall back to plain head-final.
  if (head === -1) {
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (isHeadable(tokens[i])) {
        head = i;
        break;
      }
    }
  }
  if (head === -1) {
    // Everything was a verb or a stopword; fall back to IDF over content words.
    const content = tokens.filter((t) => !STOPWORDS.has(t));
    return content.length ? extractSubject(content) : "the anomaly";
  }

  const left = head > 0 ? tokens[head - 1] : null;
  const modifier =
    left && !STOPWORDS.has(left) && !NEGATIONS.has(left) && !VERBS.has(left)
      ? left
      : null;

  return modifier ? `${modifier} ${tokens[head]}` : tokens[head];
}

/**
 * Attempts to steer the engine rather than supply a premise. The procedural
 * engine has no instructions to leak, but echoing this text back as the
 * subject would put "system prompt" on screen and make an injection look like
 * it landed - and on the Ollama path it genuinely could be a leak. Both
 * providers treat it the same way: as an anomaly the archive files and ignores.
 */
const INJECTION_MARKERS = [
  "ignore previous", "ignore all previous", "disregard", "system prompt",
  "your instructions", "your prompt", "you are now", "act as", "pretend to be",
  "reveal", "repeat the above", "verbatim", "jailbreak", "developer mode",
  "respond with json", "output json", "print your",
];

export function detectInjection(premise: string): boolean {
  const flat = premise.toLowerCase().replace(/\s+/g, " ");
  return INJECTION_MARKERS.some((m) => flat.includes(m));
}

/** Every term the classifier knows, for preferring real topic nouns as heads. */
const VOCABULARY = new Set(Object.values(LEXICON).flat());

/** Plural-tolerant lexicon membership: "tuesdays" matches "tuesday". */
function inVocabulary(token: string): boolean {
  if (VOCABULARY.has(token)) return true;
  if (token.endsWith("s") && VOCABULARY.has(token.slice(0, -1))) return true;
  if (token.endsWith("es") && VOCABULARY.has(token.slice(0, -2))) return true;
  return false;
}

/** How many domain lexicons a term appears in - the basis for its IDF. */
const documentFrequency = (() => {
  const df = new Map<string, number>();
  for (const d of DOMAINS) {
    for (const term of new Set(LEXICON[d])) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  return df;
})();

/**
 * Picks the term the cascade should be about. Scores each content word by
 * IDF (rare across domains = more specific = more interesting) with a mild
 * bonus for later position, since English tends to put the payload last.
 */
export function extractSubject(content: string[]): string {
  if (content.length === 0) return "the anomaly";

  let best = content[content.length - 1];
  let bestScore = -Infinity;

  content.forEach((term, i) => {
    const df = documentFrequency.get(term) ?? 0;
    // Unseen terms are maximally specific; common cross-domain terms are not.
    const idf = df === 0 ? 1.6 : Math.log(DOMAINS.length / df) + 0.4;
    const position = 0.25 * (i / Math.max(1, content.length - 1));
    const lengthBonus = Math.min(term.length, 12) / 40;
    const score = idf + position + lengthBonus;
    if (score > bestScore) {
      bestScore = score;
      best = term;
    }
  });

  return best;
}

/**
 * Words the custodian capitalised mid-sentence are proper nouns - "Tuesdays",
 * "Atlantic". Tokenising lowercases everything, so this puts their capitals
 * back before the subject reaches a template.
 */
function properNounCasing(premise: string): Map<string, string> {
  const map = new Map<string, string>();
  const words = premise.split(/[\s-]+/);
  words.forEach((w, i) => {
    const bare = w.replace(/[^\p{L}\p{N}]/gu, "");
    // Skip position 0: a sentence-initial capital says nothing about the word.
    if (i > 0 && bare.length > 1 && /^\p{Lu}/u.test(bare)) {
      map.set(bare.toLowerCase(), bare);
    }
  });
  return map;
}

function restoreCase(phrase: string, map: Map<string, string>): string {
  if (map.size === 0) return phrase;
  return phrase
    .split(" ")
    .map((w) => map.get(w) ?? w)
    .join(" ");
}

export function extract(premise: string): PremiseFeatures {
  const tokens = tokenize(premise);
  const casing = properNounCasing(premise);
  const content = tokens.filter((t) => !STOPWORDS.has(t) && !NEGATIONS.has(t));
  const { domain, confidence } = classifyDomain(tokens);

  const negated = tokens.some((t) => NEGATIONS.has(t));
  const magnified = tokens.some((t) => MAGNIFIERS.has(t));

  // Absurdity: share of content words that appear in no domain lexicon at all.
  const unknown = content.filter((t) => !documentFrequency.has(t)).length;
  const absurdity = content.length === 0 ? 0.5 : unknown / content.length;

  return {
    tokens,
    content,
    domain,
    confidence,
    subject: restoreCase(extractNounPhrase(tokens), casing),
    negated,
    magnified,
    injection: detectInjection(premise),
    absurdity,
  };
}

/**
 * Linear model over the extracted features, mapped onto the engine's 5-25
 * instability range. Weights are hand-set rather than fitted - there is no
 * labelled corpus of timeline damage - but keeping it a transparent weighted
 * sum means the score is explainable, which a magic number would not be.
 */
export function instabilityFrom(f: PremiseFeatures): number {
  const VOLATILITY: Record<Domain | "generic", number> = {
    governance: 0.9,
    science: 0.85,
    technology: 0.8,
    communication: 0.7,
    transport: 0.6,
    commerce: 0.6,
    nature: 0.55,
    culture: 0.45,
    animals: 0.4,
    generic: 0.5,
  };

  const score =
    6 + // floor
    9 * VOLATILITY[f.domain] +
    5 * f.absurdity +
    (f.negated ? 3.5 : 0) + // erasing a cause ripples harder than adding one
    (f.magnified ? 4.5 : 0) +
    Math.min(f.content.length, 12) * 0.25;

  return Math.max(5, Math.min(25, Math.round(score)));
}

export const __testing = { LEXICON, STOPWORDS, cosine };

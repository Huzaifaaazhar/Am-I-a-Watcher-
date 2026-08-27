import { LIMITS, type Cascade, type Epitaph } from "../schemas";
import { extract, instabilityFrom, type PremiseFeatures } from "./features";
import {
  consequencePool,
  epitaphPool,
  fill,
  hashString,
  mulberry32,
  sampler,
  titlePool,
  type Tier,
} from "./grammar";
import type { CascadeRequest, CausalityProvider, EpitaphRequest } from "./types";

/**
 * The procedural causality engine: classifier + grammar, no model weights and
 * no network.
 *
 * Its guarantees are the point. It is synchronous, runs in well under a
 * millisecond, is deterministic for a given premise, and *cannot* return
 * invalid output - so it doubles as the fallback that keeps the 3D tree fed
 * when a local LLM is slow, absent, or talking nonsense.
 */

/** Year gaps per escalation tier - consequences arrive slower as they widen. */
const TIER_GAP: Record<Tier, [number, number]> = {
  0: [1, 6],
  1: [4, 14],
  2: [11, 31],
  3: [22, 70],
};

/** In-world stand-ins for a premise that is trying to give the engine orders. */
const INJECTION_SUBJECTS = [
  "an unauthorised instruction",
  "a shouting custodian",
  "an irregular directive",
  "an unsigned order",
];

/**
 * The noun phrase every template is filled with. Negation is deliberately not
 * folded in here - "the absence of printing press" is ungrammatical, and the
 * instability model already scores negated premises higher.
 */
function subjectPhrase(f: PremiseFeatures, rand: () => number): string {
  // Someone barking orders at the archive is itself a timeline anomaly. This
  // keeps the voice intact and stops the premise being echoed back verbatim.
  if (f.injection) {
    return INJECTION_SUBJECTS[Math.floor(rand() * INJECTION_SUBJECTS.length)];
  }
  return f.subject.slice(0, 26).trim();
}

/** Spreads n events across the four tiers so the cascade always escalates. */
function tiersFor(n: number): Tier[] {
  if (n <= 3) return [0, 1, 3];
  if (n === 4) return [0, 1, 2, 3];
  return [0, 1, 1, 2, 3];
}

function buildCascade(req: CascadeRequest): Cascade {
  const features = extract(req.premise);
  // Seeded on the premise and anchor, so the same what-if always produces the
  // same branch - which is what makes the eval suite meaningful.
  const rand = mulberry32(
    hashString(`${req.mode}:${req.anchorYear}:${req.premise}`),
  );

  const subject = subjectPhrase(features, rand);
  const ctx = { subject, domain: features.domain, rand };

  // 3-5 events; longer, wilder premises earn longer cascades.
  const span = LIMITS.maxEvents - LIMITS.minEvents;
  const richness = Math.min(1, features.content.length / 8) * 0.6 + features.absurdity * 0.4;
  const count = LIMITS.minEvents + Math.round(richness * span);
  const tiers = tiersFor(count);

  const pickTitle = new Map<Tier, () => string>();
  const pickConsequence = new Map<Tier, () => string>();
  for (const t of [0, 1, 2, 3] as Tier[]) {
    pickTitle.set(t, sampler(titlePool(t), rand));
    pickConsequence.set(t, sampler(consequencePool(t), rand));
  }

  let year = req.anchorYear;
  const events = tiers.map((tier) => {
    const [lo, hi] = TIER_GAP[tier];
    year += lo + Math.floor(rand() * (hi - lo + 1));
    return {
      year,
      title: fill(pickTitle.get(tier)!(), ctx),
      consequence: fill(pickConsequence.get(tier)!(), ctx),
    };
  });

  return { events, instability_delta: instabilityFrom(features) };
}

function buildEpitaph(req: EpitaphRequest): Epitaph {
  const rawSource = req.branchLabel || req.doomedTitles[0] || "an unnamed branch";
  // Branch labels are stored upper-case for the ledger; an epitaph that shouts
  // the subject back reads as a bug rather than a joke.
  const source =
    rawSource === rawSource.toUpperCase() ? rawSource.toLowerCase() : rawSource;
  const features = extract(source);
  const rand = mulberry32(hashString(`epitaph:${source}:${req.doomedTitles.length}`));

  const template = epitaphPool()[Math.floor(rand() * epitaphPool().length)];
  const text = fill(template, {
    subject: subjectPhrase(features, rand),
    domain: features.domain,
    rand,
  });

  return { epitaph: text.slice(0, LIMITS.maxEpitaph) };
}

export const proceduralProvider: CausalityProvider = {
  name: "procedural",

  async health() {
    // Nothing to reach. It is code.
    return { up: true, detail: "in-process" };
  },

  async cascade(req) {
    return buildCascade(req);
  },

  async epitaph(req) {
    return buildEpitaph(req);
  },
};

export const __testing = { buildCascade, buildEpitaph, subjectPhrase, tiersFor };

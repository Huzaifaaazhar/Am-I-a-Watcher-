/**
 * Weighted context-free grammar for the procedural engine.
 *
 * Consequences are drawn from four escalation tiers - immediate, institutional,
 * societal, then frankly cosmic - so a cascade always reads as a ladder rather
 * than four unrelated sentences. Terminals are filled from the domain lexicon
 * chosen by the classifier, which is what keeps the output on-topic without a
 * language model.
 */

import type { Domain } from "./features";

export type Tier = 0 | 1 | 2 | 3;

/** Deterministic PRNG so the same premise always yields the same cascade. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* --------------------------------------------------------------- terminals */

const ORGS = [
  "The Ministry",
  "A subcommittee",
  "The Board",
  "The Registry",
  "An inspectorate",
  "The Bureau",
  "A standing committee",
  "The Office of Records",
];

const PLACES = [
  "Two provinces",
  "The northern ports",
  "Three capitals",
  "The lowlands",
  "Every border town",
  "The inner districts",
];

/** Domain-specific nouns used to keep the cascade on subject. */
const DOMAIN_NOUNS: Record<Domain | "generic", string[]> = {
  technology: ["the machinery", "the workshops", "the patent office", "spare parts"],
  transport: ["the harbours", "the timetables", "the shipping lanes", "the roads"],
  science: ["the academies", "the measurements", "the journals", "the proofs"],
  governance: ["the statutes", "the courts", "the census", "the treaties"],
  nature: ["the coastline", "the harvests", "the seasons", "the tides"],
  animals: ["the roosts", "the herds", "the veterinary boards", "the nesting sites"],
  commerce: ["the markets", "the ledgers", "the tariffs", "the warehouses"],
  culture: ["the calendars", "the festivals", "the wardrobes", "the liturgy"],
  communication: ["the postal routes", "the archives", "the presses", "the signal towers"],
  generic: ["the paperwork", "the records", "the arrangements", "the schedules"],
};

/* --------------------------------------------------------------- templates */

/** Title templates by escalation tier. {s} = subject, {ORG}, {N}, {PLACE}. */
const TITLES: Record<Tier, string[]> = {
  0: [
    "{ORG} opens a file on {s}",
    "First {s} incident goes unrecorded",
    "{s} declared a local matter",
    "Provisional licence issued for {s}",
    "{N} quietly re-routed around {s}",
    "A clerk mentions {s} in passing",
    "{s} appears in a footnote",
    "Nobody objects to {s}",
  ],
  1: [
    "{ORG} forms a subcommittee on {s}",
    "{s} added to the standard forms",
    "Licensing regime for {s} drafted",
    "{ORG} mislays the only file on {s}",
    "Annual {s} review made compulsory",
    "Inspectors trained to recognise {s}",
    "{N} reclassified after {s}",
    "A tax on {s} is proposed",
  ],
  2: [
    "{N} decouple from reality",
    "Schools begin teaching {s}",
    "The word for {s} enters common use",
    "{PLACE} rewrite their charters",
    "A generation grows up assuming {s}",
    "{s} becomes a unit of measurement",
    "Insurers stop covering {s}",
    "{N} reorganised entirely around {s}",
  ],
  3: [
    "{s} achieves diplomatic recognition",
    "Calendars adjusted to accommodate {s}",
    "{s} listed among the fundamental forces",
    "The planet files an amended return",
    "{ORG} declares the matter closed forever",
    "Historians agree {s} was always so",
    "{s} is granted its own century",
    "The archive stops keeping count",
  ],
};

/** One-line consequences. Deadpan, bureaucratic, never explaining the joke. */
const CONSEQUENCES: Record<Tier, string[]> = {
  0: [
    "Nobody is informed.",
    "The report is filed under weather.",
    "It is assumed to be temporary.",
    "Two people notice. Neither writes it down.",
    "The matter is considered settled.",
    "A form is created for it, then lost.",
  ],
  1: [
    "The paperwork outlives everyone involved.",
    "Quorum is never once reached.",
    "Compliance is measured, then rounded down.",
    "The subcommittee requests a larger room.",
    "Everyone agrees to revisit it next year.",
    "The minutes run to four hundred pages.",
  ],
  2: [
    "Prices adjust. Nobody can say to what.",
    "The old arrangement is remembered fondly and inaccurately.",
    "Children find the previous era implausible.",
    "Two dialects split over the pronunciation.",
    "It is taught as though it were inevitable.",
    "The exception becomes the standard form.",
  ],
  3: [
    "The correction is scheduled for a later century.",
    "Causality lodges an objection and is overruled.",
    "The record now begins here.",
    "It is agreed never to mention the alternative.",
    "Subsequent events decline to comment.",
    "The archive marks the question permanently closed.",
  ],
};

/* ------------------------------------------------------------------ filler */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Picks without repeating until the pool is exhausted. */
export function sampler<T>(pool: T[], rand: () => number): () => T {
  let bag: T[] = [];
  return () => {
    if (bag.length === 0) bag = pool.slice();
    const i = Math.floor(rand() * bag.length);
    return bag.splice(i, 1)[0];
  };
}

export interface FillContext {
  subject: string;
  domain: Domain | "generic";
  rand: () => number;
}

/** Expands a template's terminals. */
export function fill(template: string, ctx: FillContext): string {
  const nouns = DOMAIN_NOUNS[ctx.domain];
  const out = template
    .replace(/\{s\}/g, ctx.subject)
    .replace(/\{S\}/g, cap(ctx.subject))
    .replace(/\{ORG\}/g, ORGS[Math.floor(ctx.rand() * ORGS.length)])
    .replace(/\{PLACE\}/g, PLACES[Math.floor(ctx.rand() * PLACES.length)])
    .replace(/\{N\}/g, nouns[Math.floor(ctx.rand() * nouns.length)]);
  // A template opening with {s} or {N} would otherwise start lowercase.
  return cap(out);
}

export function titlePool(tier: Tier): string[] {
  return TITLES[tier];
}

export function consequencePool(tier: Tier): string[] {
  return CONSEQUENCES[tier];
}

/** Epitaph grammar - one deadpan line recording why a branch ended. */
const EPITAPH_TEMPLATES = [
  "Branch terminated. Cause: {s}.",
  "Pruned. The timeline would not stop insisting on {s}.",
  "Terminated for {s}. No further explanation was offered.",
  "Closed. {S} proved administratively impossible.",
  "Deleted. The file on {s} had grown longer than the branch.",
  "Ended. Nobody could be found who would sign for {s}.",
  "Discontinued. {S} was never properly authorised.",
  "Struck from the record. See also: {s}.",
];

export function epitaphPool(): string[] {
  return EPITAPH_TEMPLATES;
}

export const __testing = { TITLES, CONSEQUENCES, ORGS, DOMAIN_NOUNS };

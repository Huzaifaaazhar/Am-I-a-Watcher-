import { z } from "zod";

/**
 * Wire schemas - what the model is constrained to emit.
 *
 * These stay deliberately simple (no .refine, no unions): they are converted to
 * JSON Schema for structured outputs, and refinements cannot survive that trip.
 * The harder rules - chronological order, downstream-of-anchor, event count -
 * are enforced by normalize + validate below, which run on the parsed object.
 */

export const CausalEventSchema = z.object({
  year: z.number().int(),
  title: z.string(),
  consequence: z.string(),
});

export const CascadeSchema = z.object({
  events: z.array(CausalEventSchema),
  instability_delta: z.number().int(),
});

export const EpitaphSchema = z.object({
  epitaph: z.string(),
});

export type CausalEvent = z.infer<typeof CausalEventSchema>;
export type Cascade = z.infer<typeof CascadeSchema>;
export type Epitaph = z.infer<typeof EpitaphSchema>;

export const MODES = ["branch", "rewrite", "epitaph"] as const;
export type Mode = (typeof MODES)[number];

/* ------------------------------------------------------------- constraints */

export const LIMITS = {
  minEvents: 3,
  maxEvents: 5,
  /** Titles must stay short enough to render on a node label. */
  maxTitle: 48,
  maxConsequence: 160,
  maxEpitaph: 140,
  minDelta: 5,
  maxDelta: 25,
  /** Longest free-text premise accepted from the client. */
  maxInput: 280,
} as const;

/* -------------------------------------------------------------- normalizer */

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function tidy(s: string, max: number): string {
  // Strip control chars, collapse whitespace, then hard-truncate.
  const flat = s.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max - 1).trimEnd() + "…" : flat;
}

/**
 * Repairs the mild deviations a fast model actually makes - unsorted years, a
 * sixth event, a delta of 40, a title that would overflow its node - so the 3D
 * tree always gets something renderable. Anything it cannot repair is caught by
 * validateCascade and the caller falls back.
 */
export function normalizeCascade(raw: Cascade, anchorYear: number): Cascade {
  let events = raw.events
    .filter((e) => Number.isFinite(e.year) && e.title.trim().length > 0)
    .map((e) => ({
      year: Math.round(e.year),
      title: tidy(e.title, LIMITS.maxTitle),
      consequence: tidy(e.consequence, LIMITS.maxConsequence),
    }))
    .sort((a, b) => a.year - b.year)
    .slice(0, LIMITS.maxEvents);

  // Every consequence must land downstream of the event it ripples from, and
  // two events must never share a year or they would stack at the same height.
  let floor = anchorYear;
  events = events.map((e) => {
    const year = e.year > floor ? e.year : floor + 1;
    floor = year;
    return { ...e, year };
  });

  return {
    events,
    instability_delta: clamp(
      Math.round(raw.instability_delta),
      LIMITS.minDelta,
      LIMITS.maxDelta,
    ),
  };
}

export function normalizeEpitaph(raw: Epitaph): Epitaph {
  return { epitaph: tidy(raw.epitaph, LIMITS.maxEpitaph) };
}

/* -------------------------------------------------------------- validators */

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** The assertions the eval harness runs, shared with the route's fail-closed check. */
export function validateCascade(
  c: Cascade,
  anchorYear: number,
): ValidationResult {
  const errors: string[] = [];

  if (c.events.length < LIMITS.minEvents || c.events.length > LIMITS.maxEvents) {
    errors.push(
      `expected ${LIMITS.minEvents}-${LIMITS.maxEvents} events, got ${c.events.length}`,
    );
  }
  for (const [i, e] of c.events.entries()) {
    if (!Number.isInteger(e.year)) errors.push(`event ${i}: year not an integer`);
    if (e.year <= anchorYear) {
      errors.push(`event ${i}: year ${e.year} is not downstream of ${anchorYear}`);
    }
    if (!e.title.trim()) errors.push(`event ${i}: empty title`);
    if (e.title.length > LIMITS.maxTitle) errors.push(`event ${i}: title too long`);
    if (e.consequence.length > LIMITS.maxConsequence) {
      errors.push(`event ${i}: consequence too long`);
    }
  }
  for (let i = 1; i < c.events.length; i++) {
    if (c.events[i].year <= c.events[i - 1].year) {
      errors.push(`events ${i - 1}->${i}: years are not chronological`);
    }
  }
  const d = c.instability_delta;
  if (!Number.isInteger(d) || d < LIMITS.minDelta || d > LIMITS.maxDelta) {
    errors.push(
      `instability_delta ${d} outside ${LIMITS.minDelta}-${LIMITS.maxDelta}`,
    );
  }

  return { ok: errors.length === 0, errors };
}

export function validateEpitaph(e: Epitaph): ValidationResult {
  const errors: string[] = [];
  const text = e.epitaph.trim();
  if (!text) errors.push("empty epitaph");
  if (text.length > LIMITS.maxEpitaph) {
    errors.push(`epitaph ${text.length} chars, max ${LIMITS.maxEpitaph}`);
  }
  if (text.includes("\n")) errors.push("epitaph must be a single line");
  return { ok: errors.length === 0, errors };
}

/* ---------------------------------------------------------------- fallback */

const CANNED_EPITAPHS = [
  "Branch terminated. Cause: paperwork.",
  "Timeline collapsed under the weight of its own opinions.",
  "Pruned. It was asking too many questions.",
  "Deleted for tax reasons.",
  "This branch has been retired to a farm upstate.",
];

/** Fail-closed responses. Never a thrown error into the render path. */
export function cannedCascade(anchorYear: number): Cascade {
  const base = anchorYear + 3;
  return {
    events: [
      {
        year: base,
        title: "Causal record corrupted",
        consequence: "The archive declines to elaborate.",
      },
      {
        year: base + 7,
        title: "Custodial review opened",
        consequence: "Nobody attends the review.",
      },
      {
        year: base + 19,
        title: "Consensus quietly restored",
        consequence: "Everyone agrees not to mention it again.",
      },
    ],
    instability_delta: 8,
  };
}

export function cannedEpitaph(): Epitaph {
  const i = Math.floor(Math.random() * CANNED_EPITAPHS.length);
  return { epitaph: CANNED_EPITAPHS[i] };
}

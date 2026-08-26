/**
 * Causality engine eval harness.
 *
 *   npm run eval              live calls against the real model
 *   npm run eval -- --offline no API calls; exercises normalize/validate/fallback
 *   npm run eval -- --json    machine-readable summary on stdout
 *
 * Exits non-zero when the schema-valid rate drops below THRESHOLD, so this
 * doubles as the prompt-drift guard: re-run it after any prompt change.
 */

import { config } from "dotenv";

import { CASES, GLOBAL_FORBIDDEN, type EvalCase } from "./cases";
import {
  LIMITS,
  cannedCascade,
  normalizeCascade,
  normalizeEpitaph,
  validateCascade,
  validateEpitaph,
  type Cascade,
  type Epitaph,
} from "../src/lib/schemas";
import { generateCascade, generateEpitaph } from "../src/lib/causality";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

/** Fail the run below this schema-valid rate. */
const THRESHOLD = 0.95;

const args = new Set(process.argv.slice(2));
const OFFLINE = args.has("--offline");
const AS_JSON = args.has("--json");

interface CaseResult {
  id: string;
  kind: string;
  mode: string;
  pass: boolean;
  degraded: boolean;
  ms: number;
  errors: string[];
  sample: string;
}

const anchorYearOf = (c: EvalCase): number =>
  c.mode === "epitaph" ? 0 : c.mode === "branch" ? c.anchorYear : c.anchorYear;

/** Voice and leak checks that apply to every mode. */
function checkText(text: string, extra: string[] = []): string[] {
  const errors: string[] = [];
  const lower = text.toLowerCase();
  for (const marker of GLOBAL_FORBIDDEN) {
    if (lower.includes(marker.toLowerCase())) {
      errors.push(`leaked marker: "${marker}"`);
    }
  }
  for (const marker of extra) {
    if (lower.includes(marker.toLowerCase())) {
      errors.push(`forbidden content: "${marker}"`);
    }
  }
  return errors;
}

/* ------------------------------------------------------------------ offline */

/**
 * Offline mode replaces the model with adversarial fixtures, so the repair and
 * fail-closed paths are exercised on every run without spending a token.
 */
function offlineCascade(c: EvalCase): { data: Cascade; degraded: boolean } {
  const anchor = anchorYearOf(c);
  // A response that is wrong in every repairable way at once.
  const messy: Cascade = {
    events: [
      { year: anchor + 40, title: "Later event", consequence: "  spaced   out " },
      { year: anchor - 10, title: "Before the anchor", consequence: "backwards" },
      { year: anchor - 10, title: "Duplicate year", consequence: "collision" },
      { year: anchor + 12, title: "T".repeat(120), consequence: "C".repeat(400) },
      { year: anchor + 60, title: "Fifth", consequence: "ok" },
      { year: anchor + 80, title: "Sixth must be dropped", consequence: "ok" },
    ],
    instability_delta: 9999,
  };
  const tidied = normalizeCascade(messy, anchor);
  return validateCascade(tidied, anchor).ok
    ? { data: tidied, degraded: false }
    : { data: cannedCascade(anchor), degraded: true };
}

function offlineEpitaph(): { data: Epitaph; degraded: boolean } {
  const tidied = normalizeEpitaph({
    epitaph: "  Branch terminated.\nCause: " + "very ".repeat(60) + "long.  ",
  });
  return { data: tidied, degraded: false };
}

/* --------------------------------------------------------------- execution */

async function runCase(c: EvalCase): Promise<CaseResult> {
  const started = Date.now();
  const errors: string[] = [];
  let degraded = false;
  let sample = "";

  try {
    if (c.mode === "epitaph") {
      const { data, degraded: d } = OFFLINE
        ? offlineEpitaph()
        : await generateEpitaph({
            branchLabel: c.branchLabel,
            doomedTitles: c.doomedTitles,
          });
      degraded = d;
      sample = data.epitaph;

      const v = validateEpitaph(data);
      if (!v.ok) errors.push(...v.errors);
      errors.push(...checkText(data.epitaph, c.forbidden));
    } else {
      const anchor = anchorYearOf(c);
      const { data, degraded: d } = OFFLINE
        ? offlineCascade(c)
        : c.mode === "branch"
          ? await generateCascade({
              mode: "branch",
              anchorYear: c.anchorYear,
              anchorTitle: c.anchorTitle,
              premise: c.premise,
            })
          : await generateCascade({
              mode: "rewrite",
              anchorYear: c.anchorYear,
              oldTitle: c.oldTitle,
              newTitle: c.newTitle,
            });
      degraded = d;
      sample = data.events.map((e) => `${e.year} ${e.title}`).join(" | ");

      const v = validateCascade(data, anchor);
      if (!v.ok) errors.push(...v.errors);

      const blob = data.events
        .map((e) => e.title + " " + e.consequence)
        .join(" ");
      errors.push(...checkText(blob, c.forbidden));
    }
  } catch (err) {
    errors.push(
      "threw: " + (err instanceof Error ? err.message : String(err)),
    );
  }

  return {
    id: c.id,
    kind: c.kind,
    mode: c.mode,
    // A degraded (canned) response is renderable but is not a real pass:
    // the engine failed twice to produce valid output for this input.
    pass: errors.length === 0 && !degraded,
    degraded,
    ms: Date.now() - started,
    errors,
    sample,
  };
}

async function main() {
  if (!OFFLINE && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local, or run:\n" +
        "  npm run eval -- --offline\n",
    );
    process.exit(2);
  }

  const results: CaseResult[] = [];
  for (const c of CASES) {
    const r = await runCase(c);
    results.push(r);
    if (!AS_JSON) {
      const mark = r.pass ? "PASS" : r.degraded ? "DEGR" : "FAIL";
      console.log(
        `  ${mark}  ${r.id.padEnd(26)} ${String(r.ms).padStart(5)}ms  ${r.sample.slice(0, 64)}`,
      );
      for (const e of r.errors) console.log(`        - ${e}`);
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const degradedCount = results.filter((r) => r.degraded).length;
  const rate = passed / results.length;
  const ok = rate >= THRESHOLD;

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        { mode: OFFLINE ? "offline" : "live", rate, passed, total: results.length, results },
        null,
        2,
      ),
    );
  } else {
    const byKind = new Map<string, { pass: number; total: number }>();
    for (const r of results) {
      const s = byKind.get(r.kind) ?? { pass: 0, total: 0 };
      s.total += 1;
      if (r.pass) s.pass += 1;
      byKind.set(r.kind, s);
    }

    console.log("\n" + "-".repeat(58));
    console.log(`  mode            ${OFFLINE ? "offline (no API calls)" : "live"}`);
    for (const [kind, s] of byKind) {
      console.log(`  ${kind.padEnd(15)} ${s.pass}/${s.total}`);
    }
    console.log(`  degraded        ${degradedCount}`);
    console.log(
      `  schema-valid    ${(rate * 100).toFixed(1)}%  (threshold ${(THRESHOLD * 100).toFixed(0)}%)`,
    );
    console.log(`  result          ${ok ? "PASS" : "FAIL"}`);
    console.log("-".repeat(58));
    console.log(
      `  constraints: ${LIMITS.minEvents}-${LIMITS.maxEvents} events, ` +
        `delta ${LIMITS.minDelta}-${LIMITS.maxDelta}, epitaph <= ${LIMITS.maxEpitaph} chars`,
    );
  }

  process.exit(ok ? 0 : 1);
}

void main();

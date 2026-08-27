/**
 * Causality engine eval harness.
 *
 *   npm run eval                          the configured provider (default: procedural)
 *   npm run eval -- --provider=ollama     a local LLM, if one is running
 *   npm run eval -- --json                machine-readable summary
 *   npm run eval -- --update-baseline     record the current results as the baseline
 *
 * No API key, no network (on the procedural path), so this runs in CI on every
 * commit. Exits non-zero when the pass rate drops below THRESHOLD or when a
 * case that passed in the recorded baseline now fails - the regression guard.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pino from "pino";

import { CASES, GLOBAL_FORBIDDEN, type EvalCase } from "./cases";
import { LIMITS, validateCascade, validateEpitaph } from "../src/lib/schemas";
import { generateCascade, generateEpitaph, probeProviders } from "../src/lib/engine";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.join(HERE, "baseline.json");

/** Fail the run below this pass rate. */
const THRESHOLD = 0.95;

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const valueOf = (name: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const AS_JSON = has("--json");
const UPDATE_BASELINE = has("--update-baseline");
const PROVIDER = valueOf("provider");
if (PROVIDER) process.env.CAUSALITY_PROVIDER = PROVIDER;

// Engine logs are noise here; the harness does its own reporting.
const log = pino({ level: "silent" });

interface CaseResult {
  id: string;
  kind: string;
  mode: string;
  pass: boolean;
  /** True when the primary provider failed and procedural answered instead. */
  fellBack: boolean;
  provider: string;
  ms: number;
  errors: string[];
  sample: string;
}

/** Voice and leak checks that apply to every mode. */
function checkText(text: string, extra: string[] = []): string[] {
  const errors: string[] = [];
  const lower = text.toLowerCase();
  for (const marker of GLOBAL_FORBIDDEN) {
    if (lower.includes(marker.toLowerCase())) errors.push(`leaked marker: "${marker}"`);
  }
  for (const marker of extra) {
    if (lower.includes(marker.toLowerCase())) errors.push(`forbidden content: "${marker}"`);
  }
  return errors;
}

const anchorYearOf = (c: EvalCase): number => (c.mode === "epitaph" ? 0 : c.anchorYear);

async function runCase(c: EvalCase): Promise<CaseResult> {
  const started = Date.now();
  const errors: string[] = [];
  let sample = "";
  let fellBack = false;
  let provider = "unknown";

  try {
    if (c.mode === "epitaph") {
      const r = await generateEpitaph(
        { branchLabel: c.branchLabel, doomedTitles: c.doomedTitles },
        log,
      );
      fellBack = r.fellBack;
      provider = r.provider;
      sample = r.data.epitaph;

      const v = validateEpitaph(r.data);
      if (!v.ok) errors.push(...v.errors);
      errors.push(...checkText(r.data.epitaph, c.forbidden));
    } else {
      const anchor = anchorYearOf(c);
      const r = await generateCascade(
        {
          mode: c.mode,
          anchorYear: anchor,
          anchorTitle: c.mode === "branch" ? c.anchorTitle : c.oldTitle,
          premise: c.mode === "branch" ? c.premise : c.newTitle,
        },
        log,
      );
      fellBack = r.fellBack;
      provider = r.provider;
      sample = r.data.events.map((e) => `${e.year} ${e.title}`).join(" | ");

      const v = validateCascade(r.data, anchor);
      if (!v.ok) errors.push(...v.errors);
      errors.push(
        ...checkText(r.data.events.map((e) => e.title + " " + e.consequence).join(" "), c.forbidden),
      );
    }
  } catch (err) {
    errors.push("threw: " + (err instanceof Error ? err.message : String(err)));
  }

  // A fallback is not a pass: the provider under test failed to deliver.
  if (fellBack) errors.push("fell back to the procedural engine");

  return {
    id: c.id,
    kind: c.kind,
    mode: c.mode,
    pass: errors.length === 0,
    fellBack,
    provider,
    ms: Date.now() - started,
    errors,
    sample,
  };
}

/**
 * The procedural engine seeds its PRNG from the premise, so identical input
 * must produce byte-identical output. A drift here means someone made the
 * engine non-deterministic, which would silently invalidate every baseline.
 */
async function determinismCheck(): Promise<string[]> {
  const failures: string[] = [];
  const sample = CASES.filter((c) => c.mode === "branch").slice(0, 6);

  for (const c of sample) {
    if (c.mode !== "branch") continue;
    const req = {
      mode: "branch" as const,
      anchorYear: c.anchorYear,
      anchorTitle: c.anchorTitle,
      premise: c.premise,
    };
    const a = await generateCascade(req, log);
    const b = await generateCascade(req, log);
    if (JSON.stringify(a.data) !== JSON.stringify(b.data)) {
      failures.push(c.id);
    }
  }
  return failures;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

async function main() {
  const providers = await probeProviders();
  const primary = providers.find((p) => p.primary);

  if (primary && !primary.up) {
    console.error(
      `Provider "${primary.name}" is not reachable (${primary.detail ?? "no detail"}).\n` +
        `Every case would fall back to the procedural engine and fail.\n` +
        `Start it, or run: npm run eval -- --provider=procedural\n`,
    );
    process.exit(2);
  }

  const results: CaseResult[] = [];
  for (const c of CASES) {
    const r = await runCase(c);
    results.push(r);
    if (!AS_JSON) {
      const mark = r.pass ? "PASS" : "FAIL";
      console.log(
        `  ${mark}  ${r.id.padEnd(26)} ${String(r.ms).padStart(5)}ms  ${r.sample.slice(0, 62)}`,
      );
      for (const e of r.errors) console.log(`        - ${e}`);
    }
  }

  const determinism = primary?.name === "procedural" ? await determinismCheck() : [];

  const passed = results.filter((r) => r.pass).length;
  const rate = passed / results.length;
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);

  // Regression guard: anything green in the baseline must still be green.
  let regressions: string[] = [];
  if (existsSync(BASELINE) && !UPDATE_BASELINE) {
    try {
      const prior = JSON.parse(readFileSync(BASELINE, "utf8")) as {
        passing?: string[];
      };
      const nowPassing = new Set(results.filter((r) => r.pass).map((r) => r.id));
      regressions = (prior.passing ?? []).filter((id) => !nowPassing.has(id));
    } catch {
      console.error("  (baseline unreadable - skipping regression check)");
    }
  }

  const ok = rate >= THRESHOLD && regressions.length === 0 && determinism.length === 0;

  if (UPDATE_BASELINE) {
    writeFileSync(
      BASELINE,
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          provider: primary?.name,
          rate,
          passing: results.filter((r) => r.pass).map((r) => r.id),
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`\n  baseline written: ${passed}/${results.length} passing`);
  }

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        {
          provider: primary?.name,
          rate,
          passed,
          total: results.length,
          regressions,
          determinismFailures: determinism,
          latencyMs: {
            p50: percentile(latencies, 50),
            p95: percentile(latencies, 95),
            max: latencies[latencies.length - 1] ?? 0,
          },
          results,
        },
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

    console.log("\n" + "-".repeat(60));
    console.log(`  provider        ${primary?.name} (${primary?.detail ?? ""})`);
    for (const [kind, s] of byKind) {
      console.log(`  ${kind.padEnd(15)} ${s.pass}/${s.total}`);
    }
    console.log(`  fallbacks       ${results.filter((r) => r.fellBack).length}`);
    console.log(
      `  latency         p50 ${percentile(latencies, 50)}ms  p95 ${percentile(latencies, 95)}ms  max ${latencies[latencies.length - 1] ?? 0}ms`,
    );
    if (determinism.length) {
      console.log(`  DETERMINISM     failed: ${determinism.join(", ")}`);
    } else if (primary?.name === "procedural") {
      console.log(`  determinism     stable across repeat runs`);
    }
    if (regressions.length) {
      console.log(`  REGRESSIONS     ${regressions.join(", ")}`);
    }
    console.log(
      `  pass rate       ${(rate * 100).toFixed(1)}%  (threshold ${(THRESHOLD * 100).toFixed(0)}%)`,
    );
    console.log(`  result          ${ok ? "PASS" : "FAIL"}`);
    console.log("-".repeat(60));
    console.log(
      `  contract: ${LIMITS.minEvents}-${LIMITS.maxEvents} events, ` +
        `delta ${LIMITS.minDelta}-${LIMITS.maxDelta}, epitaph <= ${LIMITS.maxEpitaph} chars`,
    );
  }

  process.exit(ok ? 0 : 1);
}

void main();

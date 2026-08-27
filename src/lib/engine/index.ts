import {
  CascadeSchema,
  EpitaphSchema,
  normalizeCascade,
  normalizeEpitaph,
  validateCascade,
  validateEpitaph,
  type Cascade,
  type Epitaph,
} from "../schemas";
import { metrics } from "../obs/metrics";
import type { Logger } from "../obs/logger";
import { proceduralProvider } from "./procedural";
import { ollamaProvider } from "./ollama";
import type {
  CascadeRequest,
  CausalityProvider,
  EngineResult,
  EpitaphRequest,
  ProviderName,
} from "./types";

/**
 * Provider selection and the fallback chain.
 *
 * Every provider's output goes through the same gate - shape parse, normalise,
 * validate - so a local LLM cannot put anything on screen that the procedural
 * engine could not. When the primary provider fails that gate twice, the
 * procedural engine answers instead. It is synchronous and cannot fail, so
 * there is always something renderable and never an exception in the UI.
 */

const PROVIDERS: Record<ProviderName, CausalityProvider> = {
  procedural: proceduralProvider,
  ollama: ollamaProvider,
};

function configuredName(): ProviderName {
  const raw = (process.env.CAUSALITY_PROVIDER || "procedural").toLowerCase();
  return raw === "ollama" ? "ollama" : "procedural";
}

export function primaryProvider(): CausalityProvider {
  return PROVIDERS[configuredName()];
}

export function allProviders(): CausalityProvider[] {
  return [proceduralProvider, ollamaProvider];
}

/** Refreshes the provider_up gauges. Called by the health endpoint. */
export async function probeProviders(): Promise<
  Array<{ name: ProviderName; up: boolean; detail?: string; primary: boolean }>
> {
  const primary = configuredName();
  return Promise.all(
    allProviders().map(async (p) => {
      const h = await p.health();
      metrics.providerUp.set({ provider: p.name }, h.up ? 1 : 0);
      return { name: p.name, up: h.up, detail: h.detail, primary: p.name === primary };
    }),
  );
}

/* ------------------------------------------------------------------- gates */

type Gate<T> = (raw: unknown) => { ok: true; value: T } | { ok: false; stage: string; errors: string[] };

function cascadeGate(anchorYear: number): Gate<Cascade> {
  return (raw) => {
    const shaped = CascadeSchema.safeParse(raw);
    if (!shaped.success) {
      return {
        ok: false,
        stage: "shape",
        errors: shaped.error.issues.map((i) => i.path.join(".") + ": " + i.message),
      };
    }
    const tidied = normalizeCascade(shaped.data, anchorYear);
    const check = validateCascade(tidied, anchorYear);
    return check.ok
      ? { ok: true, value: tidied }
      : { ok: false, stage: "contract", errors: check.errors };
  };
}

const epitaphGate: Gate<Epitaph> = (raw) => {
  const shaped = EpitaphSchema.safeParse(raw);
  if (!shaped.success) {
    return {
      ok: false,
      stage: "shape",
      errors: shaped.error.issues.map((i) => i.path.join(".") + ": " + i.message),
    };
  }
  const tidied = normalizeEpitaph(shaped.data);
  const check = validateEpitaph(tidied);
  return check.ok
    ? { ok: true, value: tidied }
    : { ok: false, stage: "contract", errors: check.errors };
};

/* --------------------------------------------------------------- execution */

interface RunOptions<T> {
  mode: string;
  log: Logger;
  gate: Gate<T>;
  call: (p: CausalityProvider) => Promise<unknown>;
}

/**
 * Runs the primary provider, retrying once, then falls back to procedural.
 * Both the retry and the fallback are recorded, because a provider that is
 * quietly failing half the time is exactly what monitoring exists to surface.
 */
async function run<T>({ mode, log, gate, call }: RunOptions<T>): Promise<EngineResult<T>> {
  const started = process.hrtime.bigint();
  const primary = primaryProvider();
  const elapsed = () => Number(process.hrtime.bigint() - started) / 1e6;

  const attempts = primary.name === "procedural" ? 1 : 2;
  let lastReason = "unknown";

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const raw = await call(primary);
      const checked = gate(raw);

      if (checked.ok) {
        const durationMs = elapsed();
        metrics.duration.observe({ mode, provider: primary.name }, durationMs / 1000);
        metrics.requests.inc({ mode, provider: primary.name, outcome: "ok" });
        log.debug({ provider: primary.name, attempt, durationMs }, "cascade generated");
        return { data: checked.value, provider: primary.name, fellBack: false, durationMs };
      }

      lastReason = checked.stage;
      metrics.validationFailures.inc({ mode, stage: checked.stage });
      log.warn(
        { provider: primary.name, attempt, stage: checked.stage, errors: checked.errors },
        "engine output rejected",
      );
    } catch (err) {
      lastReason = err instanceof Error ? err.name : "error";
      log.warn(
        { provider: primary.name, attempt, err: err instanceof Error ? err.message : String(err) },
        "provider call failed",
      );
    }
  }

  // Fallback. The procedural engine is synchronous and valid by construction,
  // so this path has no failure mode of its own.
  const raw = await call(proceduralProvider);
  const checked = gate(raw);
  const durationMs = elapsed();

  if (!checked.ok) {
    // Would mean the procedural engine violated its own contract - a bug, not
    // a runtime condition. Surface it loudly rather than papering over it.
    log.error({ errors: checked.errors }, "procedural fallback failed validation");
    metrics.requests.inc({ mode, provider: "procedural", outcome: "error" });
    throw new Error("procedural fallback produced invalid output");
  }

  metrics.duration.observe({ mode, provider: "procedural" }, durationMs / 1000);
  metrics.requests.inc({ mode, provider: "procedural", outcome: "fallback" });
  metrics.fallbacks.inc({ from: primary.name, to: "procedural", reason: lastReason });
  log.warn({ from: primary.name, reason: lastReason, durationMs }, "fell back to procedural engine");

  return { data: checked.value, provider: "procedural", fellBack: true, durationMs };
}

export async function generateCascade(
  req: CascadeRequest,
  log: Logger,
): Promise<EngineResult<Cascade>> {
  const result = await run<Cascade>({
    mode: req.mode,
    log,
    gate: cascadeGate(req.anchorYear),
    call: (p) => p.cascade(req),
  });
  metrics.events.inc({ mode: req.mode }, result.data.events.length);
  return result;
}

export async function generateEpitaph(
  req: EpitaphRequest,
  log: Logger,
): Promise<EngineResult<Epitaph>> {
  return run<Epitaph>({
    mode: "epitaph",
    log,
    gate: epitaphGate,
    call: (p) => p.epitaph(req),
  });
}

export type { ProviderName };

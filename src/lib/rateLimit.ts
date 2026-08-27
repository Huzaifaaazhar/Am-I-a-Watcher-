/**
 * Budget guardrails for /api/causality.
 *
 * Scope: in-process counters. That is the right fit for this build - PRUNE runs
 * as a single local Next.js process for a screen recording, and the threat is
 * "someone I shared the URL with refreshes it 400 times", not a distributed
 * attack. If this is ever deployed to serverless where each instance gets its
 * own memory, these counters no longer bound anything - move them to Redis or
 * an equivalent shared store before exposing the URL publicly.
 */

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const WINDOW_MS = num(process.env.RATE_LIMIT_WINDOW_MS, 60_000);
const MAX_PER_WINDOW = num(process.env.RATE_LIMIT_MAX, 12);
const DAILY_CAP = num(process.env.DAILY_CALL_CAP, 300);

/** Per-key hit timestamps, pruned lazily on each check. */
const hits = new Map<string, number[]>();

/** Bounds memory if a lot of distinct IPs show up. */
const MAX_TRACKED_KEYS = 5_000;

let dailyCount = 0;
let dailyResetAt = startOfNextUtcDay();

function startOfNextUtcDay(): number {
  const d = new Date();
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
}

export interface LimitDecision {
  ok: boolean;
  reason?: "rate" | "daily";
  /** Seconds until the caller may retry. */
  retryAfter?: number;
  remainingToday: number;
}

/**
 * Checks both guardrails and, on success, records the spend. Call this exactly
 * once per request, before the engine does any work.
 */
export function consume(key: string): LimitDecision {
  const now = Date.now();

  if (now >= dailyResetAt) {
    dailyCount = 0;
    dailyResetAt = startOfNextUtcDay();
  }

  // Hard daily cap first: this is the one that protects the API budget.
  if (dailyCount >= DAILY_CAP) {
    return {
      ok: false,
      reason: "daily",
      retryAfter: Math.ceil((dailyResetAt - now) / 1000),
      remainingToday: 0,
    };
  }

  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    const oldest = recent[0];
    return {
      ok: false,
      reason: "rate",
      retryAfter: Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)),
      remainingToday: DAILY_CAP - dailyCount,
    };
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > MAX_TRACKED_KEYS) {
    for (const [k, times] of hits) {
      if (times.every((t) => t <= cutoff)) hits.delete(k);
      if (hits.size <= MAX_TRACKED_KEYS) break;
    }
  }

  dailyCount += 1;
  return { ok: true, remainingToday: DAILY_CAP - dailyCount };
}

/**
 * Derives a rate-limit key from the request.
 *
 * `x-forwarded-for` is client-settable: a direct caller can rotate it on every
 * request and get a fresh per-IP window each time. So it is only trusted when
 * TRUST_PROXY is explicitly set, meaning a proxy that overwrites the header
 * actually sits in front of this process. Without that, every caller shares one
 * bucket - stricter, and not bypassable.
 *
 * Either way the per-IP window is a courtesy limit. The guardrail that actually
 * protects the API budget is the process-wide daily cap, which no header can
 * influence.
 */
const TRUST_PROXY = process.env.TRUST_PROXY === "1";

export function clientKey(req: Request): string {
  if (!TRUST_PROXY) return "shared";
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "shared";
}

export const LIMIT_CONFIG = { WINDOW_MS, MAX_PER_WINDOW, DAILY_CAP };

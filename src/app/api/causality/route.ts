import { NextResponse } from "next/server";
import { z } from "zod";

import { generateCascade, generateEpitaph } from "@/lib/engine";
import { LIMITS } from "@/lib/schemas";
import { clientKey, consume } from "@/lib/rateLimit";
import { metrics } from "@/lib/obs/metrics";
import { newRequestId, premiseForLog, requestLogger } from "@/lib/obs/logger";

/**
 * The single causality route. Inference runs locally - either the in-process
 * procedural engine or an Ollama daemon on loopback - so there is no API key
 * and no third party in the request path. What is centralised here is the
 * budget guard, the input contract, and the observability.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const premise = z.string().trim().min(1).max(LIMITS.maxInput);
const year = z.number().int().min(-4000).max(4000);
const title = z.string().trim().min(1).max(LIMITS.maxTitle);

const RequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("branch"),
    anchorYear: year,
    anchorTitle: title,
    premise,
  }),
  z.object({
    mode: z.literal("rewrite"),
    anchorYear: year,
    oldTitle: title,
    newTitle: premise,
  }),
  z.object({
    mode: z.literal("epitaph"),
    branchLabel: z.string().trim().max(LIMITS.maxInput).default("unnamed branch"),
    doomedTitles: z.array(z.string().trim().max(LIMITS.maxTitle)).max(12).default([]),
  }),
]);

/** Caps the raw body before parsing, so oversized posts cost nothing. */
const MAX_BODY_BYTES = 4_096;

/**
 * Rejects cross-site POSTs. Local inference means there is no per-call bill,
 * but a cross-origin flood still burns CPU (and GPU, on the Ollama path), so
 * the guard stays.
 */
function crossSite(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";

  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

function reject(
  requestId: string,
  reason: string,
  message: string,
  status: number,
  headers: Record<string, string> = {},
) {
  metrics.rejections.inc({ reason });
  return NextResponse.json(
    { error: message, requestId },
    { status, headers: { ...headers, "x-request-id": requestId } },
  );
}

export async function POST(req: Request) {
  const requestId = newRequestId();
  const started = Date.now();

  if (crossSite(req)) {
    return reject(requestId, "cross_origin", "Cross-origin requests are refused.", 403);
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return reject(requestId, "body_too_large", "Request too large.", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reject(requestId, "malformed_json", "Malformed JSON.", 400);
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    // Field paths only - never echo the submitted values back.
    const fields = parsed.error.issues.map((i) => i.path.join("."));
    metrics.rejections.inc({ reason: "invalid_request" });
    return NextResponse.json(
      { error: "Invalid request.", fields, requestId },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  const limit = consume(clientKey(req));
  if (!limit.ok) {
    const message =
      limit.reason === "daily"
        ? "Daily causality budget exhausted. The archive is closed until UTC midnight."
        : "Too many temporal edits. Slow down, custodian.";
    return reject(requestId, `rate_limit_${limit.reason}`, message, 429, {
      "retry-after": String(limit.retryAfter ?? 60),
    });
  }

  const input = parsed.data;
  const log = requestLogger(requestId, { mode: input.mode });

  try {
    if (input.mode === "epitaph") {
      log.info({ doomed: input.doomedTitles.length }, "epitaph requested");
      const result = await generateEpitaph(
        { branchLabel: input.branchLabel, doomedTitles: input.doomedTitles },
        log,
      );
      log.info(
        { provider: result.provider, fellBack: result.fellBack, durationMs: result.durationMs },
        "epitaph served",
      );
      return NextResponse.json(
        { ...result.data, provider: result.provider, degraded: result.fellBack, requestId },
        { headers: { "x-request-id": requestId } },
      );
    }

    const anchorTitle = input.mode === "branch" ? input.anchorTitle : input.oldTitle;
    const text = input.mode === "branch" ? input.premise : input.newTitle;

    log.info(
      { anchorYear: input.anchorYear, premisePreview: premiseForLog(text) },
      "cascade requested",
    );

    const result = await generateCascade(
      { mode: input.mode, anchorYear: input.anchorYear, anchorTitle, premise: text },
      log,
    );

    log.info(
      {
        provider: result.provider,
        fellBack: result.fellBack,
        durationMs: result.durationMs,
        events: result.data.events.length,
        delta: result.data.instability_delta,
        totalMs: Date.now() - started,
      },
      "cascade served",
    );

    return NextResponse.json(
      { ...result.data, provider: result.provider, degraded: result.fellBack, requestId },
      { headers: { "x-request-id": requestId } },
    );
  } catch (err) {
    // Reaching here means even the procedural fallback broke its contract.
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "causality request failed",
    );
    metrics.requests.inc({ mode: input.mode, provider: "none", outcome: "error" });
    return NextResponse.json(
      { error: "The causality engine is unreachable.", requestId },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { generateCascade, generateEpitaph, isConfigured } from "@/lib/causality";
import { LIMITS } from "@/lib/schemas";
import { clientKey, consume } from "@/lib/rateLimit";

/**
 * The single LLM route. Everything the client can ask the causality engine to
 * do goes through here, so the API key, the rate limit, and the daily cap all
 * live in exactly one place.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Free text from the browser. Bounded here so a huge body never reaches the model. */
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
 * Rejects cross-site POSTs. Without this, any page the custodian visits could
 * fire requests at a shared PRUNE URL and burn the API budget - a simple POST
 * is not blocked by CORS on the way out, only on the way back. There is no
 * session to steal here, so this is purely a budget guard.
 */
function crossSite(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";

  // Fall back to Origin for clients that don't send Sec-Fetch-Site.
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export async function POST(req: Request) {
  if (crossSite(req)) {
    return NextResponse.json({ error: "Cross-origin requests are refused." }, { status: 403 });
  }

  // Fail fast on a missing key: otherwise every request burns a rate-limit slot
  // and two doomed API attempts, then returns a canned cascade that looks like
  // the model simply had an off day.
  if (!isConfigured()) {
    console.error(
      "[causality] MISCONFIGURED: ANTHROPIC_API_KEY is not set. " +
        "Copy .env.example to .env.local and add your key.",
    );
    return NextResponse.json(
      { error: "The causality engine is not configured." },
      { status: 503 },
    );
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Malformed JSON." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    // Field paths only - never echo the submitted values back.
    return NextResponse.json(
      {
        error: "Invalid request.",
        fields: parsed.error.issues.map((i) => i.path.join(".")),
      },
      { status: 400 },
    );
  }

  const limit = consume(clientKey(req));
  if (!limit.ok) {
    const message =
      limit.reason === "daily"
        ? "Daily causality budget exhausted. The archive is closed until UTC midnight."
        : "Too many temporal edits. Slow down, custodian.";
    return NextResponse.json(
      { error: message },
      {
        status: 429,
        headers: { "retry-after": String(limit.retryAfter ?? 60) },
      },
    );
  }

  try {
    const input = parsed.data;

    if (input.mode === "epitaph") {
      const { data, degraded } = await generateEpitaph({
        branchLabel: input.branchLabel,
        doomedTitles: input.doomedTitles,
      });
      return NextResponse.json({ ...data, degraded });
    }

    const { data, degraded } =
      input.mode === "branch"
        ? await generateCascade({
            mode: "branch",
            anchorYear: input.anchorYear,
            anchorTitle: input.anchorTitle,
            premise: input.premise,
          })
        : await generateCascade({
            mode: "rewrite",
            anchorYear: input.anchorYear,
            oldTitle: input.oldTitle,
            newTitle: input.newTitle,
          });

    return NextResponse.json({ ...data, degraded });
  } catch (err) {
    // Never leak internals to the client; the reason stays in the server log.
    console.error(
      "[causality] unhandled:",
      err instanceof Error ? err.name : "unknown error",
    );
    return NextResponse.json(
      { error: "The causality engine is unreachable." },
      { status: 500 },
    );
  }
}

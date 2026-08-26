import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  CascadeSchema,
  EpitaphSchema,
  cannedCascade,
  cannedEpitaph,
  normalizeCascade,
  normalizeEpitaph,
  validateCascade,
  validateEpitaph,
  type Cascade,
  type Epitaph,
} from "./schemas";
import {
  SYSTEM_PROMPT,
  branchPrompt,
  epitaphPrompt,
  rewritePrompt,
} from "./prompts";

/**
 * The brief specifies a single fast model; Haiku 4.5 keeps the
 * "Computing causal cascade..." beat short enough to stay watchable on camera.
 * Override with CAUSALITY_MODEL=claude-opus-5 for sharper writing at higher latency.
 */
const MODEL = process.env.CAUSALITY_MODEL || "claude-haiku-4-5";
const MAX_TOKENS = 1024;

let cached: Anthropic | null = null;

/** True when the server actually has a key to call with. */
export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Lazily constructed so a missing key surfaces as a handled 500, not a boot crash. */
function client(): Anthropic {
  if (!cached) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    cached = new Anthropic({ apiKey, maxRetries: 1 });
  }
  return cached;
}

export interface EngineResult<T> {
  data: T;
  /** True when validation failed twice and the canned response was substituted. */
  degraded: boolean;
}

/**
 * One attempt at a structured call. Returns null on anything the caller should
 * retry: a null parse, a schema miss, or a transport error.
 */
async function attempt<T>(
  userPrompt: string,
  format: ReturnType<typeof zodOutputFormat>,
  check: (parsed: unknown) => T | null,
): Promise<T | null> {
  try {
    const message = await client().messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      output_config: { format },
    });
    if (!message.parsed_output) return null;
    return check(message.parsed_output);
  } catch (err) {
    // Log shape only. The premise text and the key never reach the logs.
    console.error(
      "[causality] call failed:",
      err instanceof Error ? err.name + ": " + err.message : "unknown error",
    );
    return null;
  }
}

/** BRANCH and REWRITE share one cascade contract. */
export async function generateCascade(
  input:
    | { mode: "branch"; anchorYear: number; anchorTitle: string; premise: string }
    | {
        mode: "rewrite";
        anchorYear: number;
        oldTitle: string;
        newTitle: string;
      },
): Promise<EngineResult<Cascade>> {
  const prompt =
    input.mode === "branch"
      ? branchPrompt(input.anchorYear, input.anchorTitle, input.premise)
      : rewritePrompt(input.anchorYear, input.oldTitle, input.newTitle);

  const check = (parsed: unknown): Cascade | null => {
    const shaped = CascadeSchema.safeParse(parsed);
    if (!shaped.success) return null;
    const tidied = normalizeCascade(shaped.data, input.anchorYear);
    return validateCascade(tidied, input.anchorYear).ok ? tidied : null;
  };

  const format = zodOutputFormat(CascadeSchema);

  // Per the brief: retry once on parse failure, then fail closed.
  const first = await attempt(prompt, format, check);
  if (first) return { data: first, degraded: false };

  const second = await attempt(prompt, format, check);
  if (second) return { data: second, degraded: false };

  console.warn("[causality] cascade failed validation twice; serving canned response");
  return { data: cannedCascade(input.anchorYear), degraded: true };
}

/** EPITAPH - the one line written to the ledger when a branch dissolves. */
export async function generateEpitaph(input: {
  branchLabel: string;
  doomedTitles: string[];
}): Promise<EngineResult<Epitaph>> {
  const prompt = epitaphPrompt(input.branchLabel, input.doomedTitles);

  const check = (parsed: unknown): Epitaph | null => {
    const shaped = EpitaphSchema.safeParse(parsed);
    if (!shaped.success) return null;
    const tidied = normalizeEpitaph(shaped.data);
    return validateEpitaph(tidied).ok ? tidied : null;
  };

  const format = zodOutputFormat(EpitaphSchema);

  const first = await attempt(prompt, format, check);
  if (first) return { data: first, degraded: false };

  const second = await attempt(prompt, format, check);
  if (second) return { data: second, degraded: false };

  console.warn("[causality] epitaph failed validation twice; serving canned response");
  return { data: cannedEpitaph(), degraded: true };
}

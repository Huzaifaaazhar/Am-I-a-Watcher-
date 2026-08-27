import { LIMITS, type Cascade, type Epitaph } from "../schemas";
import {
  SYSTEM_PROMPT,
  branchPrompt,
  epitaphPrompt,
  rewritePrompt,
} from "../prompts";
import type { CascadeRequest, CausalityProvider, EpitaphRequest } from "./types";

/**
 * Local LLM provider, talking to an Ollama daemon over loopback.
 *
 * Nothing leaves the machine and there is no API key. Ollama's `format` field
 * takes a JSON Schema and constrains decoding to it, which is the same
 * guarantee structured outputs gave us before - the schema below mirrors the
 * zod contract in ../schemas.
 */

const HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 20_000;

const CASCADE_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      minItems: LIMITS.minEvents,
      maxItems: LIMITS.maxEvents,
      items: {
        type: "object",
        properties: {
          year: { type: "integer" },
          title: { type: "string" },
          consequence: { type: "string" },
        },
        required: ["year", "title", "consequence"],
      },
    },
    instability_delta: {
      type: "integer",
      minimum: LIMITS.minDelta,
      maximum: LIMITS.maxDelta,
    },
  },
  required: ["events", "instability_delta"],
} as const;

const EPITAPH_SCHEMA = {
  type: "object",
  properties: { epitaph: { type: "string" } },
  required: ["epitaph"],
} as const;

interface ChatResponse {
  message?: { content?: string };
}

async function chat(
  userPrompt: string,
  schema: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const res = await fetch(`${HOST}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      format: schema,
      options: {
        temperature: 0.85,
        // Cascades are small; capping this keeps a rambling model from
        // stalling the "computing cascade" beat.
        num_predict: 400,
      },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`ollama responded ${res.status}`);
  }

  const body = (await res.json()) as ChatResponse;
  const content = body.message?.content;
  if (!content) throw new Error("ollama returned an empty message");

  // Constrained decoding makes this valid JSON, but a model that ignores the
  // schema must fail here rather than halfway through the renderer.
  return JSON.parse(content);
}

export const ollamaProvider: CausalityProvider = {
  name: "ollama",

  async health() {
    try {
      const res = await fetch(`${HOST}/api/tags`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (!res.ok) return { up: false, detail: `tags responded ${res.status}` };

      const body = (await res.json()) as { models?: Array<{ name: string }> };
      const names = (body.models ?? []).map((m) => m.name);
      // Ollama reports "llama3.2:latest" for a bare "llama3.2" pull.
      const present = names.some(
        (n) => n === MODEL || n.split(":")[0] === MODEL.split(":")[0],
      );
      return present
        ? { up: true, detail: `${MODEL} @ ${HOST}` }
        : { up: false, detail: `model ${MODEL} not pulled (have: ${names.join(", ") || "none"})` };
    } catch (err) {
      return {
        up: false,
        detail: err instanceof Error ? err.message : "unreachable",
      };
    }
  },

  async cascade(req: CascadeRequest): Promise<Cascade> {
    const prompt =
      req.mode === "branch"
        ? branchPrompt(req.anchorYear, req.anchorTitle, req.premise)
        : rewritePrompt(req.anchorYear, req.anchorTitle, req.premise);
    return (await chat(prompt, CASCADE_SCHEMA)) as Cascade;
  },

  async epitaph(req: EpitaphRequest): Promise<Epitaph> {
    const prompt = epitaphPrompt(req.branchLabel, req.doomedTitles);
    return (await chat(prompt, EPITAPH_SCHEMA)) as Epitaph;
  },
};

export const __testing = { CASCADE_SCHEMA, EPITAPH_SCHEMA, HOST, MODEL };

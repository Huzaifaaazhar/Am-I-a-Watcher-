import type { Cascade, Epitaph } from "../schemas";

export type ProviderName = "procedural" | "ollama";

export interface CascadeRequest {
  mode: "branch" | "rewrite";
  anchorYear: number;
  /** The event being branched from, or the pre-rewrite title. */
  anchorTitle: string;
  /** The custodian's free text - a what-if, or the rewritten event. */
  premise: string;
}

export interface EpitaphRequest {
  branchLabel: string;
  doomedTitles: string[];
}

export interface CausalityProvider {
  readonly name: ProviderName;
  /** Cheap liveness probe. Procedural is always up; Ollama is pinged. */
  health(): Promise<{ up: boolean; detail?: string }>;
  cascade(req: CascadeRequest): Promise<Cascade>;
  epitaph(req: EpitaphRequest): Promise<Epitaph>;
}

/** What the route returns, plus how the answer was actually obtained. */
export interface EngineResult<T> {
  data: T;
  provider: ProviderName;
  /** True when the primary provider failed and a fallback answered. */
  fellBack: boolean;
  durationMs: number;
}

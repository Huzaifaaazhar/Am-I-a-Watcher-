/** Core in-memory timeline graph. No database - state lives in React. */

export type NodeStatus =
  | "alive"
  /** Mid prune dissolve; still rendered by the particle system, not the tree. */
  | "pruned"
  /** Superseded by a rewrite - desaturating out while replacements grow in. */
  | "fading";

export type NodeOrigin = "seed" | "generated" | "rewritten";

/**
 * Which strand of the archive a seeded event belongs to. Only the canvas's
 * own copy reads it - the geometry and the engine treat all three alike,
 * because on the Sacred Timeline there is only one sequence.
 */
export type NodeStrand = "recorded" | "saga" | "anomaly";

export interface TimelineNode {
  id: string;
  parentId: string | null;
  branchId: string;
  year: number;
  title: string;
  /** One-line downstream consequence, shown on select. */
  consequence?: string;
  status: NodeStatus;
  origin: NodeOrigin;
  /** Set on seeded events only. */
  strand?: NodeStrand;
  /** ms timestamp used to stagger growth animations. */
  bornAt: number;
}

export type BranchStatus = "alive" | "pruned";

export interface Branch {
  id: string;
  label: string;
  status: BranchStatus;
  /** Node this branch splays off. null for the prime timeline. */
  originNodeId: string | null;
  /** How many branch-hops from the prime timeline. Drives splay radius. */
  depth: number;
  /** Stable index used for the golden-angle splay. */
  index: number;
  prunedAt?: number;
}

export type LedgerKind =
  | "branch"
  | "prune"
  | "rewrite"
  | "reset"
  | "system"
  | "error";

export interface LedgerEntry {
  id: string;
  ts: number;
  kind: LedgerKind;
  text: string;
}

export interface Timeline {
  nodes: TimelineNode[];
  branches: Branch[];
  instability: number;
  ledger: LedgerEntry[];
  /** Bumped on reset so the scene can remount cleanly. */
  epoch: number;
}

/** Verbs the custodian can perform on a node. */
export type Verb = "branch" | "prune" | "rewrite";

/** Layout output consumed by the 3D scene. */
export interface LayoutPoint {
  x: number;
  y: number;
  z: number;
}

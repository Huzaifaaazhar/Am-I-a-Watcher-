import { PRIME_BRANCH_ID, makeId } from "./seed";
import type {
  Branch,
  LayoutPoint,
  LedgerEntry,
  LedgerKind,
  Timeline,
  TimelineNode,
} from "./types";
import type { CausalEvent } from "./schemas";

/* ------------------------------------------------------------------ layout */

const YEAR_MIN = 1400;
const YEAR_MAX = 2120;
const TRUNK_HEIGHT = 30;
/** Golden angle - distributes branches around the trunk without clustering. */
const GOLDEN_ANGLE = 2.399963229728653;
const SPLAY_RADIUS = 4.4;
/** Minimum vertical separation between consecutive events, so labels never collide. */
const MIN_GAP = 2.6;

export function yForYear(year: number): number {
  const t = (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN);
  if (t > 1) return TRUNK_HEIGHT + (year - YEAR_MAX) * 0.004;
  if (t < 0) return t * 6;
  return t * TRUNK_HEIGHT;
}

function branchCenter(branch: Branch): { x: number; z: number } {
  if (branch.depth === 0) return { x: 0, z: 0 };
  const angle = branch.index * GOLDEN_ANGLE;
  const radius = branch.depth * SPLAY_RADIUS;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Time runs up the Y axis; branches splay outward from the node they fork off.
 * Branches are laid out shallowest-first so a child branch can anchor to its
 * parent's already-resolved position.
 */
export function layoutTimeline(t: Timeline): Map<string, LayoutPoint> {
  const pos = new Map<string, LayoutPoint>();
  const byBranch = new Map<string, TimelineNode[]>();
  for (const n of t.nodes) {
    const list = byBranch.get(n.branchId) ?? [];
    list.push(n);
    byBranch.set(n.branchId, list);
  }
  for (const list of byBranch.values()) list.sort((a, b) => a.year - b.year);

  const branches = t.branches.slice().sort((a, b) => a.depth - b.depth);

  for (const branch of branches) {
    const center = branchCenter(branch);
    const origin = branch.originNodeId ? pos.get(branch.originNodeId) : null;
    const from = origin ?? { x: center.x, z: center.z };
    const nodes = byBranch.get(branch.id) ?? [];

    // Events clustered in the same decade would stack their labels on top of
    // each other. Walk the branch in order and push each node up to at least
    // MIN_GAP above the previous one - the tree stops being a true linear time
    // axis, but it stays readable on camera, which is what it is for.
    let floor = origin ? origin.y + MIN_GAP : -Infinity;

    nodes.forEach((node, i) => {
      const y = Math.max(yForYear(node.year), floor);
      floor = y + MIN_GAP;

      // Ease out to the branch's own lane over the first ~3 events.
      const t2 = branch.depth === 0 ? 1 : Math.min(1, (i + 1) / 2.5);
      pos.set(node.id, {
        x: lerp(from.x, center.x, t2),
        y,
        z: lerp(from.z, center.z, t2),
      });
    });
  }
  return pos;
}

/* ------------------------------------------------------------- graph utils */

function childMap(nodes: TimelineNode[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const list = m.get(n.parentId) ?? [];
    list.push(n.id);
    m.set(n.parentId, list);
  }
  return m;
}

/** Every node downstream of `rootId`, inclusive or exclusive of the root. */
export function descendantsOf(
  nodes: TimelineNode[],
  rootId: string,
  includeRoot: boolean,
): Set<string> {
  const kids = childMap(nodes);
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const c of kids.get(id) ?? []) stack.push(c);
  }
  if (!includeRoot) out.delete(rootId);
  return out;
}

export function nodeById(t: Timeline, id: string): TimelineNode | undefined {
  return t.nodes.find((n) => n.id === id);
}

export function aliveNodes(t: Timeline): TimelineNode[] {
  return t.nodes.filter((n) => n.status !== "pruned");
}

export function logEntry(kind: LedgerKind, text: string): LedgerEntry {
  return { id: makeId("l"), ts: Date.now(), kind, text };
}

const MAX_LEDGER = 60;
function pushLog(t: Timeline, ...entries: LedgerEntry[]): LedgerEntry[] {
  return [...entries, ...t.ledger].slice(0, MAX_LEDGER);
}

export const clampInstability = (v: number) => Math.max(0, Math.min(100, v));

/* -------------------------------------------------------------- operations */

/** BRANCH - grow a new fork of consequence events off `nodeId`. */
export function applyBranch(
  t: Timeline,
  nodeId: string,
  premise: string,
  events: CausalEvent[],
  instabilityDelta: number,
): Timeline {
  const anchor = nodeById(t, nodeId);
  if (!anchor) return t;

  const branch: Branch = {
    id: makeId("b"),
    label: premise.slice(0, 48).toUpperCase(),
    status: "alive",
    originNodeId: nodeId,
    depth: (t.branches.find((b) => b.id === anchor.branchId)?.depth ?? 0) + 1,
    index: t.branches.length,
  };

  const now = Date.now();
  const newNodes: TimelineNode[] = [];
  let parentId = nodeId;
  events.forEach((e, i) => {
    const node: TimelineNode = {
      id: makeId("n"),
      parentId,
      branchId: branch.id,
      year: e.year,
      title: e.title,
      consequence: e.consequence,
      status: "alive",
      origin: "generated",
      // Stagger so the branch visibly draws itself outward on camera.
      bornAt: now + i * 260,
    };
    newNodes.push(node);
    parentId = node.id;
  });

  return {
    ...t,
    nodes: [...t.nodes, ...newNodes],
    branches: [...t.branches, branch],
    instability: clampInstability(t.instability + instabilityDelta),
    ledger: pushLog(
      t,
      logEntry(
        "branch",
        'BRANCHED ' + branch.id + ' from "' + anchor.title + '" - ' + premise,
      ),
    ),
  };
}

/**
 * PRUNE - kill `nodeId` and everything downstream of it. Any branch left with
 * no surviving nodes is marked pruned too.
 */
export function applyPrune(
  t: Timeline,
  nodeId: string,
  epitaph: string,
  instabilityDelta: number,
): { next: Timeline; prunedNodeIds: string[] } {
  const doomed = descendantsOf(t.nodes, nodeId, true);
  const prunedNodeIds = t.nodes
    .filter((n) => doomed.has(n.id) && n.status !== "pruned")
    .map((n) => n.id);

  if (prunedNodeIds.length === 0) return { next: t, prunedNodeIds: [] };

  const now = Date.now();
  const nodes = t.nodes.map((n) =>
    doomed.has(n.id) ? { ...n, status: "pruned" as const } : n,
  );

  const survivorsByBranch = new Set(
    nodes.filter((n) => n.status !== "pruned").map((n) => n.branchId),
  );
  const branches = t.branches.map((b) =>
    b.status === "alive" && !survivorsByBranch.has(b.id)
      ? { ...b, status: "pruned" as const, prunedAt: now }
      : b,
  );

  const target = nodeById(t, nodeId);
  const label =
    t.branches.find((b) => b.id === target?.branchId)?.id ?? "unknown";

  return {
    next: {
      ...t,
      nodes,
      branches,
      instability: clampInstability(t.instability + instabilityDelta),
      ledger: pushLog(
        t,
        logEntry("prune", 'PRUNED ' + label + ' - "' + epitaph + '"'),
      ),
    },
    prunedNodeIds,
  };
}

/**
 * REWRITE - replace `nodeId`'s title, fade everything downstream, and grow
 * the regenerated cascade in its place on the same branch.
 */
export function applyRewrite(
  t: Timeline,
  nodeId: string,
  newTitle: string,
  events: CausalEvent[],
  instabilityDelta: number,
): { next: Timeline; fadedNodeIds: string[] } {
  const anchor = nodeById(t, nodeId);
  if (!anchor) return { next: t, fadedNodeIds: [] };

  const downstream = descendantsOf(t.nodes, nodeId, false);
  const fadedNodeIds = t.nodes
    .filter((n) => downstream.has(n.id) && n.status === "alive")
    .map((n) => n.id);

  const now = Date.now();
  const nodes = t.nodes.map((n) => {
    if (n.id === nodeId) {
      return {
        ...n,
        title: newTitle,
        origin: "rewritten" as const,
        bornAt: now,
      };
    }
    return downstream.has(n.id) ? { ...n, status: "fading" as const } : n;
  });

  const grown: TimelineNode[] = [];
  let parentId = nodeId;
  events.forEach((e, i) => {
    const node: TimelineNode = {
      id: makeId("n"),
      parentId,
      branchId: anchor.branchId,
      year: e.year,
      title: e.title,
      consequence: e.consequence,
      status: "alive",
      origin: "generated",
      // Sequential so the cascade reads as causal, not simultaneous.
      bornAt: now + 420 + i * 300,
    };
    grown.push(node);
    parentId = node.id;
  });

  return {
    next: {
      ...t,
      nodes: [...nodes, ...grown],
      instability: clampInstability(t.instability + instabilityDelta),
      ledger: pushLog(
        t,
        logEntry("rewrite", 'REWROTE "' + anchor.title + '" -> "' + newTitle + '"'),
      ),
    },
    fadedNodeIds,
  };
}

/** Drops nodes that finished their fade-out so the graph does not grow forever. */
export function sweepFaded(t: Timeline, fadedIds: string[]): Timeline {
  const drop = new Set(fadedIds);
  return { ...t, nodes: t.nodes.filter((n) => !drop.has(n.id)) };
}

export { PRIME_BRANCH_ID };

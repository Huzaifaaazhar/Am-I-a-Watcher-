/**
 * Where the timeline graph lives on the painting.
 *
 * Every coordinate here is in *art space*: the viewBox below, which has the
 * painting's own aspect ratio. Nothing in this module knows about pixels or
 * breakpoints - the stage scales art space to the screen, and because the
 * image and the overlay are handed the identical box they cannot drift apart.
 *
 * The shape of this changed completely in Phase 7. Events used to be strung
 * up the trunk, which drew a vertical line of dots through the middle of the
 * painting and turned a multiverse into a column chart. They now sit out on
 * the boughs: each event belongs to a limb that leaves the trunk at its own
 * height and sweeps off to its own side, so the Sacred Timeline reads as a
 * tree of places rather than a ladder.
 *
 * The boughs are traced onto the painting - origins on the trunk, tips in the
 * canopy and the root tangle where the artwork actually has branches. The
 * limbs a deviation grows are generated, because the graph is live: a branch
 * created at runtime needs geometry too, and hand-written path data only ever
 * covers the events that happened to exist when it was typed.
 */

import { PRIME_BRANCH_ID } from "./seed";
import type { Branch, Timeline, TimelineNode } from "./types";

/** Art space. 736x414 source, scaled so the numbers are easy to read. */
export const ART = { w: 1000, h: 563, ratio: 736 / 414 };

export interface Pt {
  x: number;
  y: number;
}

/* --------------------------------------------------------------- geometry */

type Cubic = [Pt, Pt, Pt, Pt];

function cubicAt([p0, p1, p2, p3]: Cubic, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** The direction of travel at `t`, normalised. */
function cubicTangent([p0, p1, p2, p3]: Cubic, t: number): Pt {
  const u = 1 - t;
  const x =
    3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
  const y =
    3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

const r = (n: number) => Math.round(n * 10) / 10;

function cubicD([p0, p1, p2, p3]: Cubic): string {
  return (
    `M${r(p0.x)},${r(p0.y)} C${r(p1.x)},${r(p1.y)} ` +
    `${r(p2.x)},${r(p2.y)} ${r(p3.x)},${r(p3.y)}`
  );
}

/* ------------------------------------------------------------------ boughs */

/**
 * The limbs of the Sacred Timeline, traced onto the painting.
 *
 * `o` is where the bough leaves the trunk and `t` where it ends; `bow` lifts
 * its middle off the straight line between them, which is what makes it a
 * branch rather than a spoke - positive bows upward on screen.
 *
 * Written oldest-first: the sorted events are dealt out across the table in
 * order, so the sequence here is also the order time moves through the tree -
 * out along the roots, then up and alternating across the canopy. Alternating
 * sides is deliberate: walking up one side and down the other puts every
 * marker on one edge of the painting.
 *
 * Each bough carries a run of consecutive years rather than a single event.
 * With the whole archive on the tree there are too many for one each, and a
 * bough strung with five is what a branch hung with lights looks like.
 */
const BOUGHS: Array<{ o: Pt; t: Pt; bow: number }> = [
  { o: { x: 539, y: 498 }, t: { x: 676, y: 512 }, bow: 38 },
  { o: { x: 535, y: 488 }, t: { x: 338, y: 508 }, bow: 36 },
  { o: { x: 537, y: 460 }, t: { x: 724, y: 472 }, bow: 44 },
  { o: { x: 533, y: 452 }, t: { x: 302, y: 466 }, bow: 42 },
  { o: { x: 535, y: 424 }, t: { x: 748, y: 416 }, bow: 44 },
  { o: { x: 531, y: 418 }, t: { x: 294, y: 422 }, bow: 44 },
  { o: { x: 530, y: 388 }, t: { x: 734, y: 352 }, bow: 38 },
  { o: { x: 528, y: 382 }, t: { x: 290, y: 342 }, bow: 38 },
  { o: { x: 528, y: 352 }, t: { x: 710, y: 278 }, bow: 34 },
  { o: { x: 526, y: 346 }, t: { x: 312, y: 262 }, bow: 34 },
  { o: { x: 525, y: 320 }, t: { x: 668, y: 196 }, bow: 28 },
  { o: { x: 524, y: 314 }, t: { x: 356, y: 180 }, bow: 28 },
  { o: { x: 523, y: 292 }, t: { x: 606, y: 104 }, bow: 22 },
  { o: { x: 522, y: 286 }, t: { x: 428, y: 96 }, bow: 22 },
  { o: { x: 521, y: 274 }, t: { x: 520, y: 86 }, bow: 14 },
];

export const BOUGH_COUNT = BOUGHS.length;

/** Builds the curve for bough `i`, bowed off the straight line o -> t. */
function boughCurve(i: number): Cubic {
  const { o, t, bow } = BOUGHS[i % BOUGHS.length];
  const dx = t.x - o.x;
  const dy = t.y - o.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular, pointing up-screen for a bough heading outward either way.
  const nx = (-dy / len) * Math.sign(dx || 1);
  const ny = (dx / len) * Math.sign(dx || 1);
  return [
    o,
    { x: o.x + dx * 0.34 + nx * bow, y: o.y + dy * 0.34 + ny * bow },
    { x: o.x + dx * 0.7 + nx * bow * 0.72, y: o.y + dy * 0.7 + ny * bow * 0.72 },
    t,
  ];
}

/* ------------------------------------------------------------------- plan */

export interface BoughPlan {
  /** Every event strung along it, so it can light when any of them is live. */
  nodeIds: string[];
  d: string;
}

export interface LimbPlan {
  branchId: string;
  d: string;
  /** Where it leaves its parent - the event that was changed. */
  origin: Pt;
  tip: Pt;
  depth: number;
}

export interface NodePlan {
  node: TimelineNode;
  point: Pt;
  /** Which way to throw the label so it never lands back on the trunk. */
  side: -1 | 1;
  branchId: string;
}

export interface TreePlan {
  boughs: BoughPlan[];
  limbs: LimbPlan[];
  nodes: NodePlan[];
  byNode: Map<string, NodePlan>;
}

/** Nodes are set in from a limb's ends so the first is clear of the fork. */
const LIMB_FROM = 0.34;
const LIMB_TO = 0.96;
/** The same, along a bough. Wider, because a bough carries more of them. */
const BOUGH_FROM = 0.3;
const BOUGH_TO = 0.96;

/**
 * The curve a deviation grows, leaving the event that caused it.
 *
 * It continues the direction its parent was already travelling, turned by a
 * deterministic splay, so a new branch reads as growth off that limb rather
 * than as a line that happens to start there. Deeper branches are shorter,
 * which is what keeps the canopy from turning into a starburst.
 */
function limbCurve(from: Pt, heading: Pt, index: number, depth: number): Cubic {
  const wrap = Math.floor(index / 5);
  const splay = (((index % 5) - 2) * 26 + wrap * 11) * (Math.PI / 180);
  const len = 168 * Math.pow(0.7, Math.max(0, depth - 1));

  const turn = (v: Pt, a: number): Pt => ({
    x: v.x * Math.cos(a) - v.y * Math.sin(a),
    y: v.x * Math.sin(a) + v.y * Math.cos(a),
  });

  const d1 = turn(heading, splay * 0.45);
  const d2 = turn(heading, splay);
  // The tip lifts toward vertical, the way a growing shoot does.
  const d3 = { x: d2.x * 0.72, y: d2.y * 0.72 - 0.42 };

  const p1 = { x: from.x + d1.x * len * 0.4, y: from.y + d1.y * len * 0.4 };
  const p2 = { x: p1.x + d2.x * len * 0.36, y: p1.y + d2.y * len * 0.36 };
  const p3 = { x: p2.x + d3.x * len * 0.34, y: p2.y + d3.y * len * 0.34 };
  return [from, p1, p2, p3];
}

/**
 * Lays the whole live graph onto the painting.
 *
 * Prime events are handed out along the bough table in year order. Deviations
 * are grown from the point of the event they left, shallowest first, so a
 * branch forking off another branch can anchor to a point already placed.
 */
export function planTree(timeline: Timeline): TreePlan {
  const alive = timeline.nodes.filter((n) => n.status !== "pruned");
  const byBranch = new Map<string, TimelineNode[]>();
  for (const n of alive) {
    const list = byBranch.get(n.branchId) ?? [];
    list.push(n);
    byBranch.set(n.branchId, list);
  }
  for (const list of byBranch.values()) list.sort((a, b) => a.year - b.year);

  const nodes: NodePlan[] = [];
  const boughs: BoughPlan[] = [];
  const limbs: LimbPlan[] = [];
  const byNode = new Map<string, NodePlan>();
  /** Remembers which way each node was travelling, for anything growing off it. */
  const heading = new Map<string, Pt>();

  const prime = byBranch.get(PRIME_BRANCH_ID) ?? [];

  // Deal the sorted run across the boughs: contiguous chunks, as even as the
  // count allows, so each bough carries consecutive years and time still
  // moves outward and up through the tree.
  const perBough = Math.ceil(prime.length / BOUGHS.length) || 1;
  for (let b = 0; b < BOUGHS.length; b++) {
    const members = prime.slice(b * perBough, (b + 1) * perBough);
    if (members.length === 0) break;

    const curve = boughCurve(b);
    const ids: string[] = [];

    members.forEach((node, i) => {
      const u =
        members.length === 1
          ? 0.72
          : BOUGH_FROM + (i / (members.length - 1)) * (BOUGH_TO - BOUGH_FROM);
      const point = cubicAt(curve, u);
      const tangent = cubicTangent(curve, u);
      // A hair off the curve, alternating, so a run of markers reads as
      // grown along a branch rather than as beads threaded on a wire.
      const off = (i % 2 === 0 ? 1 : -1) * 4;
      const placed = { x: point.x - tangent.y * off, y: point.y + tangent.x * off };

      const plan: NodePlan = {
        node,
        point: placed,
        side: placed.x >= 520 ? 1 : -1,
        branchId: PRIME_BRANCH_ID,
      };
      nodes.push(plan);
      byNode.set(node.id, plan);
      heading.set(node.id, tangent);
      ids.push(node.id);
    });

    boughs.push({ nodeIds: ids, d: cubicD(curve) });
  }

  const branches = timeline.branches
    .filter((b): b is Branch => b.status === "alive" && b.id !== PRIME_BRANCH_ID)
    .sort((a, b) => a.depth - b.depth || a.index - b.index);

  for (const branch of branches) {
    const members = byBranch.get(branch.id) ?? [];
    if (members.length === 0) continue;

    const anchor = branch.originNodeId ? byNode.get(branch.originNodeId) : undefined;
    const origin = anchor?.point ?? { x: 520, y: 300 };
    const head =
      (branch.originNodeId ? heading.get(branch.originNodeId) : undefined) ??
      { x: 0, y: -1 };
    const curve = limbCurve(origin, head, branch.index, branch.depth);

    limbs.push({
      branchId: branch.id,
      d: cubicD(curve),
      origin,
      tip: curve[3],
      depth: branch.depth,
    });

    const side: -1 | 1 = curve[3].x >= origin.x ? 1 : -1;
    members.forEach((node, i) => {
      const u =
        members.length === 1
          ? 0.7
          : LIMB_FROM + (i / (members.length - 1)) * (LIMB_TO - LIMB_FROM);
      const plan: NodePlan = { node, point: cubicAt(curve, u), side, branchId: branch.id };
      nodes.push(plan);
      byNode.set(node.id, plan);
      heading.set(node.id, cubicTangent(curve, u));
    });
  }

  return { boughs, limbs, nodes, byNode };
}

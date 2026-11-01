/**
 * Where the timeline graph lives on the painting.
 *
 * The canvas is one piece of artwork with a transparent SVG over it, so every
 * coordinate in this module is in *art space*: the viewBox below, which has
 * the painting's own aspect ratio. Nothing here knows about pixels or
 * breakpoints - the stage scales art space to the screen, and because the
 * image and the overlay are handed the identical box they cannot drift apart.
 *
 * The spine was traced off the painting: the trunk core sits at x ~0.52 of
 * the image width and runs from the root flare at y ~0.90 up to where the
 * crown opens. It was measured, then corrected against a screenshot - the
 * first trace came from a brightness centroid, and the broad glow around the
 * trunk pulled it twenty units to the left of the trunk itself. Limbs leave the spine and sweep outward
 * and then back toward vertical - the arc a real bough makes reaching for
 * light, and the shape the painted branches actually have.
 *
 * Limbs are generated from a tuned table rather than hand-written path data
 * because the graph is live: a branch the custodian creates at runtime has to
 * get a limb too, and hand-authored `d` strings only cover the events that
 * happened to be there when they were written.
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

function cubicD([p0, p1, p2, p3]: Cubic): string {
  return (
    `M${r(p0.x)},${r(p0.y)} C${r(p1.x)},${r(p1.y)} ` +
    `${r(p2.x)},${r(p2.y)} ${r(p3.x)},${r(p3.y)}`
  );
}

const r = (n: number) => Math.round(n * 10) / 10;

/** Unit vector `deg` away from straight up, positive is clockwise (screen). */
function dir(deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return { x: Math.sin(a), y: -Math.cos(a) };
}

/* ------------------------------------------------------------------ spine */

/**
 * The trunk, traced from the painting's glowing core. Four cubics so the lean
 * is continuous rather than kinked - the painted trunk is not a straight rod.
 */
const SPINE: Cubic[] = [
  [
    { x: 537, y: 508 },
    { x: 536, y: 490 },
    { x: 535, y: 470 },
    { x: 533, y: 452 },
  ],
  [
    { x: 533, y: 452 },
    { x: 532, y: 432 },
    { x: 530, y: 412 },
    { x: 529, y: 392 },
  ],
  [
    { x: 529, y: 392 },
    { x: 528, y: 370 },
    { x: 526, y: 346 },
    { x: 525, y: 322 },
  ],
  [
    { x: 525, y: 322 },
    { x: 524, y: 300 },
    { x: 522, y: 275 },
    { x: 521, y: 248 },
  ],
];

export const SPINE_D =
  SPINE.map((c, i) => (i === 0 ? cubicD(c) : cubicD(c).replace(/^M[^C]*/, ""))).join(" ");

/** A point on the trunk. `t` runs 0 at the root flare to 1 at the crown. */
export function spineAt(t: number): Pt {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * SPINE.length;
  const index = Math.min(SPINE.length - 1, Math.floor(scaled));
  return cubicAt(SPINE[index], scaled - index);
}

/**
 * Where the prime events sit on the trunk: the oldest just above the roots,
 * the newest at the crown. Kept off both ends - at t=0 a marker lands in the
 * root tangle, at t=1 it is swallowed by the canopy glow.
 */
const PRIME_FROM = 0.06;
const PRIME_TO = 0.94;

export function primeT(index: number, count: number): number {
  if (count <= 1) return 0.5;
  return PRIME_FROM + (index / (count - 1)) * (PRIME_TO - PRIME_FROM);
}

/* ------------------------------------------------------------------ limbs */

/**
 * Per-limb character, indexed by branch. Twelve entries, alternating sides,
 * with spread and length varied so no two limbs are the same gesture; past
 * twelve branches it wraps and the small deterministic jitter below keeps the
 * repeats from landing on top of each other.
 *
 * `spread` is the angle from vertical at the tip, `len` the reach in art
 * units, `lift` how hard the limb curls back toward vertical as it extends.
 */
const LIMB_SHAPE = [
  { side: -1, spread: 62, len: 268, lift: 0.5 },
  { side: 1, spread: 58, len: 282, lift: 0.46 },
  { side: -1, spread: 44, len: 236, lift: 0.56 },
  { side: 1, spread: 71, len: 248, lift: 0.4 },
  { side: -1, spread: 76, len: 222, lift: 0.36 },
  { side: 1, spread: 38, len: 262, lift: 0.6 },
  { side: -1, spread: 52, len: 206, lift: 0.52 },
  { side: 1, spread: 66, len: 214, lift: 0.44 },
  { side: -1, spread: 34, len: 244, lift: 0.62 },
  { side: 1, spread: 48, len: 196, lift: 0.5 },
  { side: -1, spread: 69, len: 188, lift: 0.42 },
  { side: 1, spread: 80, len: 230, lift: 0.34 },
];

/**
 * Builds a limb leaving `from`. The three segments turn progressively back
 * toward vertical, which is what stops a limb reading as a spoke: it leaves
 * the trunk at a wide angle and finishes nearly upright, like the painted
 * boughs do.
 */
function limbCurve(from: Pt, index: number, depth: number): Cubic {
  const shape = LIMB_SHAPE[index % LIMB_SHAPE.length];
  // Deterministic wobble so the 13th branch is not a copy of the 1st.
  const wrap = Math.floor(index / LIMB_SHAPE.length);
  const jitter = wrap * 11;
  const taper = Math.pow(0.68, Math.max(0, depth - 1));

  const len = shape.len * taper;
  const spread = (shape.spread + jitter) * shape.side;

  const p1 = {
    x: from.x + dir(spread * 0.5).x * len * 0.42,
    y: from.y + dir(spread * 0.5).y * len * 0.42,
  };
  const p2 = {
    x: p1.x + dir(spread).x * len * 0.36,
    y: p1.y + dir(spread).y * len * 0.36,
  };
  const p3 = {
    x: p2.x + dir(spread * (1 - shape.lift)).x * len * 0.34,
    y: p2.y + dir(spread * (1 - shape.lift)).y * len * 0.34,
  };
  return [from, p1, p2, p3];
}

/* ------------------------------------------------------------------- plan */

export interface LimbPlan {
  branchId: string;
  /** Path data for both the visible stroke and the wide invisible hit area. */
  d: string;
  /** Where it leaves its parent - used to draw the deviation connector. */
  origin: Pt;
  tip: Pt;
  depth: number;
}

export interface NodePlan {
  node: TimelineNode;
  point: Pt;
  /** Which way the label should be thrown so it never lands on the trunk. */
  side: -1 | 1;
  branchId: string;
}

export interface TreePlan {
  limbs: LimbPlan[];
  nodes: NodePlan[];
  byNode: Map<string, NodePlan>;
}

/** Nodes are set in from a limb's ends so the first is clear of the fork. */
const LIMB_FROM = 0.3;
const LIMB_TO = 0.96;

/**
 * Lays the whole live graph onto the painting.
 *
 * Shallowest branch first, so a limb that forks off another limb can anchor
 * to a point that has already been placed.
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
  const limbs: LimbPlan[] = [];
  const byNode = new Map<string, NodePlan>();

  const prime = byBranch.get(PRIME_BRANCH_ID) ?? [];
  prime.forEach((node, i) => {
    const point = spineAt(primeT(i, prime.length));
    // Alternate so consecutive trunk labels never stack on the same side.
    const plan: NodePlan = {
      node,
      point,
      side: i % 2 === 0 ? -1 : 1,
      branchId: PRIME_BRANCH_ID,
    };
    nodes.push(plan);
    byNode.set(node.id, plan);
  });

  const branches = timeline.branches
    .filter((b): b is Branch => b.status === "alive" && b.id !== PRIME_BRANCH_ID)
    .sort((a, b) => a.depth - b.depth || a.index - b.index);

  for (const branch of branches) {
    const members = byBranch.get(branch.id) ?? [];
    if (members.length === 0) continue;

    const anchor = branch.originNodeId ? byNode.get(branch.originNodeId) : undefined;
    const origin = anchor?.point ?? spineAt(0.8);
    const curve = limbCurve(origin, branch.index, branch.depth);

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
          ? 0.66
          : LIMB_FROM + (i / (members.length - 1)) * (LIMB_TO - LIMB_FROM);
      const plan: NodePlan = { node, point: cubicAt(curve, u), side, branchId: branch.id };
      nodes.push(plan);
      byNode.set(node.id, plan);
    });
  }

  return { limbs, nodes, byNode };
}

/**
 * The trunk split into one hit segment per prime event, so the trunk is not a
 * single clickable object: each segment selects the event that sits on it.
 */
export function spineSegments(count: number): Array<{ d: string; index: number }> {
  if (count === 0) return [];
  const out: Array<{ d: string; index: number }> = [];
  for (let i = 0; i < count; i++) {
    const t0 = i === 0 ? 0 : (primeT(i - 1, count) + primeT(i, count)) / 2;
    const t1 = i === count - 1 ? 1 : (primeT(i, count) + primeT(i + 1, count)) / 2;
    const steps = 6;
    let d = "";
    for (let s = 0; s <= steps; s++) {
      const p = spineAt(t0 + ((t1 - t0) * s) / steps);
      d += `${s === 0 ? "M" : "L"}${r(p.x)},${r(p.y)} `;
    }
    out.push({ d: d.trim(), index: i });
  }
  return out;
}

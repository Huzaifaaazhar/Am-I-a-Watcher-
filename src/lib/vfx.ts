import type { LayoutPoint } from "./types";

/** Buffers handed straight to the prune shader. */
export interface PointCloud {
  position: Float32Array;
  /** Per-point dispersal direction, biased upward so embers rise. */
  dir: Float32Array;
  /** Per-point 0..1 randomness: drives colour, size and timing jitter. */
  seed: Float32Array;
  count: number;
}

/** Total points in one dissolve. Enough to read as ash, cheap enough to stay 60fps. */
const MAX_POINTS = 6000;
const POINTS_PER_UNIT = 26;
const POINTS_PER_NODE = 130;

export const EMPTY_CLOUD: PointCloud = {
  position: new Float32Array(0),
  dir: new Float32Array(0),
  seed: new Float32Array(0),
  count: 0,
};

function randomDirection(): [number, number, number] {
  // Uniform on the sphere, then biased upward - ash falls, embers climb.
  const u = Math.random() * 2 - 1;
  const theta = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return [r * Math.cos(theta), u * 0.6 + 0.55, r * Math.sin(theta)];
}

/**
 * Converts the doomed branch's geometry into a point cloud: dense beads along
 * each edge plus a puff around every node marker. This is what the snap-dissolve
 * disperses, so it has to trace the shape the tree had a frame earlier.
 */
export function samplePruneCloud(
  segments: Array<[LayoutPoint, LayoutPoint]>,
  nodes: LayoutPoint[],
): PointCloud {
  const pts: number[] = [];
  const dirs: number[] = [];
  const seeds: number[] = [];

  const push = (x: number, y: number, z: number) => {
    if (seeds.length >= MAX_POINTS) return;
    const [dx, dy, dz] = randomDirection();
    pts.push(x, y, z);
    dirs.push(dx, dy, dz);
    seeds.push(Math.random());
  };

  for (const [a, b] of segments) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dy, dz);
    const n = Math.max(2, Math.round(length * POINTS_PER_UNIT));
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      // Slight jitter so the tube reads as volume, not a wire.
      push(
        a.x + dx * t + (Math.random() - 0.5) * 0.12,
        a.y + dy * t + (Math.random() - 0.5) * 0.12,
        a.z + dz * t + (Math.random() - 0.5) * 0.12,
      );
    }
  }

  for (const node of nodes) {
    for (let i = 0; i < POINTS_PER_NODE; i++) {
      const [ux, uy, uz] = randomDirection();
      const r = 0.34 * Math.cbrt(Math.random());
      push(node.x + ux * r, node.y + uy * r, node.z + uz * r);
    }
  }

  return {
    position: new Float32Array(pts),
    dir: new Float32Array(dirs),
    seed: new Float32Array(seeds),
    count: seeds.length,
  };
}

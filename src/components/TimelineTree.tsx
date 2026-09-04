"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import Bough from "./Bough";
import Canopy from "./Canopy";
import ProceduralTree, { growTree } from "./ProceduralTree";
import { hashString } from "@/lib/engine/grammar";
import type { Branch, LayoutPoint, TimelineNode } from "@/lib/types";

/** Animation timings, seconds. */
const GROW = 0.75;
export const FADE = 1.1;

const GOLD = new THREE.Color("#E8C34A");
const GOLD_HOT = new THREE.Color("#FFF3C4");

const easeOutBack = (t: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

function growthOf(node: TimelineNode, now: number): number {
  return THREE.MathUtils.clamp((now - node.bornAt) / (GROW * 1000), 0, 1);
}

/* ------------------------------------------------------------- event dots */

interface DotProps {
  node: TimelineNode;
  point: LayoutPoint;
  selected: boolean;
  implode: number;
  geometry: THREE.SphereGeometry;
  onSelect: (id: string) => void;
}

/**
 * An event on the tree: a small gold bead sitting on its branch, exactly as
 * the reference marks a point in history. Big enough to click, small enough
 * that the tree - not the marker - is what you look at.
 */
function EventDot({ node, point, selected, implode, geometry, onSelect }: DotProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const fadeStart = useRef<number | null>(null);

  const base = useMemo(
    () => new THREE.Vector3(point.x, point.y, point.z),
    [point.x, point.y, point.z],
  );

  useFrame((state) => {
    const m = mesh.current;
    const mat = material.current;
    if (!m || !mat) return;

    const now = Date.now();
    let scale = easeOutBack(growthOf(node, now));
    let alpha = 1;

    if (node.status === "fading") {
      if (fadeStart.current === null) fadeStart.current = now;
      const f = THREE.MathUtils.clamp((now - fadeStart.current) / (FADE * 1000), 0, 1);
      scale *= 1 - f;
      alpha = 1 - f;
    }

    // The selected bead pulses so it is findable without a bigger marker.
    const pulse = selected ? 1 + Math.sin(state.clock.elapsedTime * 4) * 0.14 : 1;
    m.scale.setScalar((selected ? 0.62 : 0.4) * Math.max(scale, 0) * pulse);
    mat.opacity = alpha;
    mat.color.copy(selected ? GOLD_HOT : GOLD);

    m.position.set(
      THREE.MathUtils.lerp(base.x, 0, implode),
      THREE.MathUtils.lerp(base.y, 15, implode),
      THREE.MathUtils.lerp(base.z, 0, implode),
    );
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <meshBasicMaterial ref={material} color={GOLD} transparent toneMapped={false} />
    </mesh>
  );
}

/* -------------------------------------------------------------------- tree */

interface TreeProps {
  nodes: TimelineNode[];
  branches: Branch[];
  layout: Map<string, LayoutPoint>;
  selectedId: string | null;
  implode: number;
  onSelect: (id: string) => void;
}

export default function TimelineTree({
  nodes,
  branches,
  layout,
  selectedId,
  implode,
  onSelect,
}: TreeProps) {
  const dot = useMemo(() => new THREE.SphereGeometry(1, 12, 10), []);

  const visible = nodes.filter((n) => n.status !== "pruned" && layout.has(n.id));

  /** One limb per branch, threaded through its events and rooted at its fork. */
  const limbs = useMemo(() => {
    return branches
      .filter((b) => b.status === "alive")
      .map((branch) => {
        const own = visible
          .filter((n) => n.branchId === branch.id)
          .sort((a, b) => a.year - b.year);
        if (own.length === 0) return null;

        const path: LayoutPoint[] = [];
        if (branch.depth === 0) {
          // Run the vein a little below the first event so it does not start
          // in mid-air - but not past the trunk's own base, or it pokes out of
          // the bottom of the tree as a bright rod.
          const first = layout.get(own[0].id)!;
          path.push({ x: 0, y: first.y - 3, z: 0 });
        } else if (branch.originNodeId && layout.has(branch.originNodeId)) {
          path.push(layout.get(branch.originNodeId)!);
        }
        for (const n of own) path.push(layout.get(n.id)!);
        if (path.length < 2) return null;

        return {
          id: branch.id,
          path,
          depth: branch.depth,
          seed: ((hashString(branch.id) % 1000) / 1000) * 6.283,
          bornAt: Math.max(...own.map((n) => n.bornAt)),
          fading: own.some((n) => n.status === "fading"),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [branches, visible, layout]);

  /**
   * Foliage hangs off the outer half of the tree: the last events on every
   * bough, plus the top of the trunk. Clustering it there keeps the lower
   * trunk clear, the way a real canopy sits.
   */
  const canopyPoints = useMemo(() => {
    const out: LayoutPoint[] = [];
    for (const branch of branches) {
      if (branch.status !== "alive") continue;
      const own = visible
        .filter((n) => n.branchId === branch.id)
        .sort((a, b) => a.year - b.year);
      const from = branch.depth === 0 ? Math.max(0, own.length - 2) : Math.floor(own.length / 2);
      for (let i = from; i < own.length; i++) {
        const p = layout.get(own[i].id);
        if (p) out.push(p);
      }
    }
    return out;
  }, [branches, visible, layout]);

  const trunkBase = useMemo(() => {
    let min = Infinity;
    for (const p of layout.values()) min = Math.min(min, p.y);
    return Number.isFinite(min) ? min - 6 : 0;
  }, [layout]);

  const trunkTop = useMemo(() => {
    let max = -Infinity;
    for (const p of layout.values()) max = Math.max(max, p.y);
    return Number.isFinite(max) ? max + 2 : 30;
  }, [layout]);

  /**
   * The world tree's own branch tips carry most of the foliage; the timeline's
   * boughs only add to it. Grown from the same fixed seed as the geometry, so
   * the leaves land on the branches rather than beside them.
   *
   * Only tips in the upper half get foliage. Hanging it off every tip drew the
   * canopy down over the trunk as a milky wash, and the trunk is the thing the
   * reference keeps clear and lit.
   */
  const treeTips = useMemo(() => {
    const span = Math.max(14, trunkTop - trunkBase);
    const floorY = trunkBase + span * 0.56;
    return growTree(trunkBase, trunkTop)
      .tips.filter((v) => v.y > floorY)
      .map((v) => ({ x: v.x, y: v.y, z: v.z }));
  }, [trunkBase, trunkTop]);

  return (
    <group>
      <ProceduralTree baseY={trunkBase} topY={trunkTop} />

      {limbs.map((limb) => (
        <Bough
          key={limb.id}
          path={limb.path}
          bornAt={limb.bornAt}
          fading={limb.fading}
          depth={limb.depth}
          seed={limb.seed}
          implode={implode}
        />
      ))}

      <Canopy points={[...treeTips, ...canopyPoints]} implode={implode} />

      {visible.map((node) => (
        <EventDot
          key={node.id}
          node={node}
          point={layout.get(node.id)!}
          selected={selectedId === node.id}
          implode={implode}
          geometry={dot}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

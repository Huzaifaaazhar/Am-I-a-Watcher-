"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { LayoutPoint, TimelineNode } from "@/lib/types";

/** Animation timings, seconds. */
const GROW = 0.75;
export const FADE = 1.1;

const COLORS = {
  seed: new THREE.Color("#3d7a58"),
  generated: new THREE.Color("#5a9c74"),
  rewritten: new THREE.Color("#e0b840"),
  selected: new THREE.Color("#f0cf68"),
  edge: new THREE.Color("#3d7a58"),
  edgeHot: new THREE.Color("#c69a24"),
};

const UP = new THREE.Vector3(0, 1, 0);
const easeOutBack = (t: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/** How far through its birth animation a node is, 0..1. */
function growthOf(node: TimelineNode, now: number): number {
  return THREE.MathUtils.clamp((now - node.bornAt) / (GROW * 1000), 0, 1);
}

/* ------------------------------------------------------------------- nodes */

interface NodeProps {
  node: TimelineNode;
  point: LayoutPoint;
  selected: boolean;
  implode: number;
  geometry: THREE.SphereGeometry;
  onSelect: (id: string) => void;
}

function NodeMarker({
  node,
  point,
  selected,
  implode,
  geometry,
  onSelect,
}: NodeProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
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
    const t = state.clock.elapsedTime;

    // Birth: ease out with a slight overshoot so growth reads as organic.
    let scale = easeOutBack(growthOf(node, now));

    if (node.status === "fading") {
      // Rewrite ripple - superseded nodes desaturate and shrink out of the way.
      if (fadeStart.current === null) fadeStart.current = now;
      const f = THREE.MathUtils.clamp(
        (now - fadeStart.current) / (FADE * 1000),
        0,
        1,
      );
      scale *= 1 - f;
      mat.emissiveIntensity = 2.4 * (1 - f);
      mat.opacity = 1 - f;
    } else {
      // Idle breathing keeps the tree alive between actions.
      const pulse = 1 + Math.sin(t * 1.6 + base.y) * 0.05;
      mat.emissiveIntensity = selected ? 2.6 + Math.sin(t * 6) * 0.5 : 1.5 * pulse;
      mat.opacity = 1;
    }

    const size = (selected ? 0.7 : 0.5) * Math.max(scale, 0);
    m.scale.setScalar(size);

    // Reset implosion: everything collapses toward the trunk's midpoint.
    m.position.set(
      THREE.MathUtils.lerp(base.x, 0, implode),
      THREE.MathUtils.lerp(base.y, 15, implode),
      THREE.MathUtils.lerp(base.z, 0, implode),
    );
  });

  const colour = selected
    ? COLORS.selected
    : node.origin === "rewritten"
      ? COLORS.rewritten
      : node.origin === "generated"
        ? COLORS.generated
        : COLORS.seed;

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
      <meshStandardMaterial
        ref={material}
        color={colour}
        emissive={colour}
        emissiveIntensity={1.5}
        transparent
        roughness={0.35}
        metalness={0.1}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------- edges */

interface EdgeProps {
  from: LayoutPoint;
  to: LayoutPoint;
  child: TimelineNode;
  implode: number;
  geometry: THREE.CylinderGeometry;
}

/**
 * A luminous tube between two events. It draws itself progressively as the
 * child node is born, and carries a pulse of light along the new path.
 */
function Edge({ from, to, child, implode, geometry }: EdgeProps) {
  const group = useRef<THREE.Group>(null);
  const tube = useRef<THREE.Mesh>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const fadeStart = useRef<number | null>(null);

  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const g = group.current;
    const t = tube.current;
    const p = pulse.current;
    const mat = material.current;
    if (!g || !t || !p || !mat) return;

    const now = Date.now();

    a.set(
      THREE.MathUtils.lerp(from.x, 0, implode),
      THREE.MathUtils.lerp(from.y, 15, implode),
      THREE.MathUtils.lerp(from.z, 0, implode),
    );
    b.set(
      THREE.MathUtils.lerp(to.x, 0, implode),
      THREE.MathUtils.lerp(to.y, 15, implode),
      THREE.MathUtils.lerp(to.z, 0, implode),
    );

    let grow = growthOf(child, now);
    let alpha = 1;

    if (child.status === "fading") {
      if (fadeStart.current === null) fadeStart.current = now;
      const f = THREE.MathUtils.clamp(
        (now - fadeStart.current) / (FADE * 1000),
        0,
        1,
      );
      alpha = 1 - f;
      grow *= 1 - f;
    }

    if (grow <= 0.001) {
      g.visible = false;
      return;
    }
    g.visible = true;

    dir.subVectors(b, a);
    const length = dir.length();
    if (length < 1e-4) {
      g.visible = false;
      return;
    }
    dir.normalize();
    quat.setFromUnitVectors(UP, dir);

    // Grow the tube from the parent end toward the child.
    const drawn = length * grow;
    g.quaternion.copy(quat);
    g.position.copy(a).addScaledVector(dir, drawn * 0.5);
    t.scale.set(1, drawn, 1);

    mat.opacity = 0.82 * alpha;
    // The tube glows hot while it is still drawing, then settles.
    mat.emissiveIntensity = grow < 1 ? 3.4 : 1.35;

    // A light pulse rides the path as it completes.
    if (grow < 1) {
      p.visible = true;
      p.position.set(0, drawn * 0.5 - 0.001, 0);
      p.scale.setScalar(0.26 * (1 - grow * 0.4));
    } else {
      p.visible = false;
    }
  });

  return (
    <group ref={group}>
      <mesh ref={tube} geometry={geometry}>
        <meshStandardMaterial
          ref={material}
          color={COLORS.edge}
          emissive={COLORS.edgeHot}
          emissiveIntensity={1.35}
          transparent
          opacity={0.82}
        />
      </mesh>
      <mesh ref={pulse}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={COLORS.selected} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------- tree */

interface TreeProps {
  nodes: TimelineNode[];
  layout: Map<string, LayoutPoint>;
  selectedId: string | null;
  implode: number;
  onSelect: (id: string) => void;
}

export default function TimelineTree({
  nodes,
  layout,
  selectedId,
  implode,
  onSelect,
}: TreeProps) {
  // Shared geometry - one allocation for every marker and every tube.
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 20, 20), []);
  const cylinder = useMemo(
    () => new THREE.CylinderGeometry(0.1, 0.1, 1, 8, 1, true),
    [],
  );

  const visible = nodes.filter((n) => n.status !== "pruned" && layout.has(n.id));
  const byId = new Map(visible.map((n) => [n.id, n]));

  return (
    <group>
      {visible.map((node) => {
        const parent = node.parentId ? byId.get(node.parentId) : undefined;
        if (!parent) return null;
        const from = layout.get(parent.id)!;
        const to = layout.get(node.id)!;
        return (
          <Edge
            key={"e_" + node.id}
            from={from}
            to={to}
            child={node}
            implode={implode}
            geometry={cylinder}
          />
        );
      })}

      {visible.map((node) => (
        <NodeMarker
          key={node.id}
          node={node}
          point={layout.get(node.id)!}
          selected={selectedId === node.id}
          implode={implode}
          geometry={sphere}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

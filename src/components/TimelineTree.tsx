"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import Tentacle from "./Tentacle";
import { hashString } from "@/lib/engine/grammar";
import type { Branch, LayoutPoint, TimelineNode } from "@/lib/types";

/** Animation timings, seconds. */
const GROW = 0.75;
export const FADE = 1.1;

const COLORS = {
  /** Worlds on the untouched spine. */
  seed: new THREE.Color("#17a866"),
  /** Worlds the engine created. */
  generated: new THREE.Color("#25c97f"),
  /** A world whose history was rewritten under it. */
  rewritten: new THREE.Color("#e0b840"),
  selected: new THREE.Color("#8affc8"),
};

const easeOutBack = (t: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/** How far through its birth animation a node is, 0..1. */
function growthOf(node: TimelineNode, now: number): number {
  return THREE.MathUtils.clamp((now - node.bornAt) / (GROW * 1000), 0, 1);
}

/* ------------------------------------------------------------------ worlds */

/** Backside shell whose rim burns brightest - a world's atmosphere. */
const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // Rendered on the back faces, so the strongest fresnel lands on the limb
    // of the sphere and reads as an atmosphere rather than a glow sprite.
    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.6);
    gl_FragColor = vec4(uColor, rim * uAlpha);
  }
`;

interface WorldProps {
  node: TimelineNode;
  point: LayoutPoint;
  selected: boolean;
  implode: number;
  core: THREE.SphereGeometry;
  shell: THREE.SphereGeometry;
  onSelect: (id: string) => void;
}

function World({
  node,
  point,
  selected,
  implode,
  core,
  shell,
  onSelect,
}: WorldProps) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const atmosphere = useRef<THREE.ShaderMaterial>(null);
  const fadeStart = useRef<number | null>(null);

  const base = useMemo(
    () => new THREE.Vector3(point.x, point.y, point.z),
    [point.x, point.y, point.z],
  );

  // Every world is its own place: a stable per-node tilt, spin and hue shift.
  const identity = useMemo(() => {
    const h = hashString(node.id);
    return {
      spin: 0.06 + ((h >>> 3) % 100) / 900,
      tilt: ((h >>> 7) % 360) * (Math.PI / 180),
      hue: (((h >>> 11) % 100) / 100 - 0.5) * 0.06,
    };
  }, [node.id]);

  const colour = useMemo(() => {
    const c = (
      selected
        ? COLORS.selected
        : node.origin === "rewritten"
          ? COLORS.rewritten
          : node.origin === "generated"
            ? COLORS.generated
            : COLORS.seed
    ).clone();
    if (!selected && node.origin !== "rewritten") {
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      c.setHSL((hsl.h + identity.hue + 1) % 1, hsl.s, hsl.l);
    }
    return c;
  }, [selected, node.origin, identity.hue]);

  useFrame((state, delta) => {
    const g = group.current;
    const b = body.current;
    const mat = material.current;
    const atm = atmosphere.current;
    if (!g || !b || !mat || !atm) return;

    const now = Date.now();
    const t = state.clock.elapsedTime;

    let scale = easeOutBack(growthOf(node, now));
    let alpha = 1;

    if (node.status === "fading") {
      if (fadeStart.current === null) fadeStart.current = now;
      const f = THREE.MathUtils.clamp((now - fadeStart.current) / (FADE * 1000), 0, 1);
      scale *= 1 - f;
      alpha = 1 - f;
    }

    mat.emissiveIntensity = selected ? 1.5 + Math.sin(t * 5) * 0.35 : 0.55;
    mat.opacity = alpha;
    atm.uniforms.uAlpha.value = alpha * (selected ? 1.1 : 0.6);

    const size = (selected ? 0.78 : 0.55) * Math.max(scale, 0);
    g.scale.setScalar(size);
    b.rotation.y += identity.spin * delta;

    g.position.set(
      THREE.MathUtils.lerp(base.x, 0, implode),
      THREE.MathUtils.lerp(base.y, 15, implode),
      THREE.MathUtils.lerp(base.z, 0, implode),
    );
  });

  const atmosphereUniforms = useMemo(
    () => ({ uColor: { value: colour }, uAlpha: { value: 1 } }),
    [colour],
  );

  return (
    <group ref={group} rotation={[identity.tilt, 0, identity.tilt * 0.5]}>
      <mesh
        ref={body}
        geometry={core}
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
          emissiveIntensity={0.55}
          transparent
          roughness={0.55}
          metalness={0.15}
          flatShading
        />
      </mesh>

      <mesh geometry={shell} scale={1.35}>
        <shaderMaterial
          ref={atmosphere}
          uniforms={atmosphereUniforms}
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
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
  // Low-poly spheres, flat-shaded: worlds should read as bodies, not billiards.
  const core = useMemo(() => new THREE.SphereGeometry(1, 14, 10), []);
  const shell = useMemo(() => new THREE.SphereGeometry(1, 16, 12), []);

  const visible = nodes.filter((n) => n.status !== "pruned" && layout.has(n.id));

  /**
   * One tendril per branch, threaded through every surviving world on it and
   * rooted at the world it forked from.
   */
  const limbs = useMemo(() => {
    return branches
      .filter((b) => b.status === "alive")
      .map((branch) => {
        const own = visible
          .filter((n) => n.branchId === branch.id)
          .sort((a, b) => a.year - b.year);
        if (own.length === 0) return null;

        const path: LayoutPoint[] = [];
        if (branch.originNodeId && layout.has(branch.originNodeId)) {
          path.push(layout.get(branch.originNodeId)!);
        }
        for (const n of own) path.push(layout.get(n.id)!);
        if (path.length < 2) return null;

        // The tube is gated on its newest world, so it never runs ahead of
        // the bodies it threads. Tentacle turns this into progress per frame.
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

  return (
    <group>
      {limbs.map((limb) => (
        <Tentacle
          key={limb.id}
          path={limb.path}
          bornAt={limb.bornAt}
          fading={limb.fading}
          depth={limb.depth}
          seed={limb.seed}
          implode={implode}
        />
      ))}

      {visible.map((node) => (
        <World
          key={node.id}
          node={node}
          point={layout.get(node.id)!}
          selected={selectedId === node.id}
          implode={implode}
          core={core}
          shell={shell}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

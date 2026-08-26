"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import TimelineTree from "./TimelineTree";
import CameraRig from "./CameraRig";
import PruneBurst from "./PruneBurst";
import type { LayoutPoint, TimelineNode } from "@/lib/types";
import type { PointCloud } from "@/lib/vfx";

export interface Burst {
  id: string;
  cloud: PointCloud;
}

interface Props {
  nodes: TimelineNode[];
  layout: Map<string, LayoutPoint>;
  selectedId: string | null;
  bursts: Burst[];
  implode: number;
  onSelect: (id: string | null) => void;
  onBurstDone: (id: string) => void;
  /** DOM nodes for the floating event labels, positioned by Projector. */
  labelRefs: MutableRefObject<Map<string, HTMLElement>>;
}

const CAMERA_FOV = 42;

/**
 * Frames the whole tree. Recomputed only when Scene mounts - Scene is keyed on
 * the timeline epoch, so this runs on first load and after each reset, and
 * never yanks the camera out from under the custodian mid-session.
 */
function fitToTree(layout: Map<string, LayoutPoint>) {
  const points = [...layout.values()];
  if (points.length === 0) return { centerY: 15, distance: 40 };

  let minY = Infinity;
  let maxY = -Infinity;
  let spread = 0;
  for (const p of points) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    spread = Math.max(spread, Math.hypot(p.x, p.z));
  }

  const height = Math.max(maxY - minY, 6);
  // Distance that puts the vertical extent inside the frustum, plus headroom
  // for the labels that float above each marker and the branches' splay.
  const halfFov = (CAMERA_FOV / 2) * (Math.PI / 180);
  const distance = height / 2 / Math.tan(halfFov) + spread + 6;

  return {
    centerY: (minY + maxY) / 2,
    distance: THREE.MathUtils.clamp(distance, 18, 80),
  };
}

/* ------------------------------------------------------------------ halos */

/** Soft radial sprite - fakes bloom without pulling in a postprocessing addon. */
function useHaloTexture() {
  return useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    g.addColorStop(0, "rgba(233,255,240,0.95)");
    g.addColorStop(0.18, "rgba(142,195,162,0.5)");
    g.addColorStop(0.45, "rgba(90,156,116,0.18)");
    g.addColorStop(1, "rgba(61,122,88,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

function Halos({
  nodes,
  layout,
  implode,
}: {
  nodes: TimelineNode[];
  layout: Map<string, LayoutPoint>;
  implode: number;
}) {
  const texture = useHaloTexture();
  const points = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const alive = nodes.filter(
      (n) => n.status !== "pruned" && layout.has(n.id),
    );
    const arr = new Float32Array(alive.length * 3);
    alive.forEach((n, i) => {
      const p = layout.get(n.id)!;
      arr[i * 3] = THREE.MathUtils.lerp(p.x, 0, implode);
      arr[i * 3 + 1] = THREE.MathUtils.lerp(p.y, 15, implode);
      arr[i * 3 + 2] = THREE.MathUtils.lerp(p.z, 0, implode);
    });
    return arr;
  }, [nodes, layout, implode]);

  const count = positions.length / 3;
  if (count === 0) return null;

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={4.6}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.8}
      />
    </points>
  );
}

/* -------------------------------------------------------------- projector */

/**
 * Projects every visible node to screen space and writes the transform straight
 * onto its DOM label. Bypassing React here keeps 200 labels at 60fps - a state
 * update per frame would not survive the recording.
 */
function Projector({
  nodes,
  layout,
  implode,
  labelRefs,
}: {
  nodes: TimelineNode[];
  layout: Map<string, LayoutPoint>;
  implode: number;
  labelRefs: MutableRefObject<Map<string, HTMLElement>>;
}) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    for (const node of nodes) {
      const el = labelRefs.current.get(node.id);
      if (!el) continue;
      const p = layout.get(node.id);
      if (!p || node.status === "pruned") {
        el.style.opacity = "0";
        continue;
      }

      v.set(
        THREE.MathUtils.lerp(p.x, 0, implode),
        THREE.MathUtils.lerp(p.y, 15, implode),
        THREE.MathUtils.lerp(p.z, 0, implode),
      );
      const distance = camera.position.distanceTo(v);
      v.project(camera);

      // z > 1 means the point is behind the camera.
      if (v.z > 1) {
        el.style.opacity = "0";
        continue;
      }

      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      // Fade distant labels so the far side of the tree does not turn to soup.
      const fade = THREE.MathUtils.clamp(1.25 - distance / 58, 0, 1);
      el.style.opacity = String(node.status === "fading" ? fade * 0.3 : fade);
    }
  });

  return null;
}

/* ------------------------------------------------------------------ scene */

export default function Scene({
  nodes,
  layout,
  selectedId,
  bursts,
  implode,
  onSelect,
  onBurstDone,
  labelRefs,
}: Props) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fit = useMemo(() => fitToTree(layout), []);

  const focus = useMemo(() => {
    if (!selectedId) return null;
    const p = layout.get(selectedId);
    return p ? new THREE.Vector3(p.x, p.y, p.z) : null;
  }, [selectedId, layout]);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 400, position: [0, 16, 40] }}
      gl={{ antialias: true, alpha: false }}
      onPointerMissed={() => onSelect(null)}
      onCreated={({ gl, scene }) => {
        gl.setClearColor("#07090a");
        scene.fog = new THREE.FogExp2("#07090a", 0.0085);
      }}
    >
      <ambientLight intensity={0.75} color="#8ec3a2" />
      <hemisphereLight args={["#5a9c74", "#0a0d0e", 0.9]} />
      <pointLight position={[14, 30, 16]} intensity={420} color="#e0b840" distance={160} />
      <pointLight position={[-18, 6, -14]} intensity={300} color="#5a9c74" distance={150} />

      <CameraRig focus={focus} idle={bursts.length === 0} fit={fit} />

      <TimelineTree
        nodes={nodes}
        layout={layout}
        selectedId={selectedId}
        implode={implode}
        onSelect={onSelect}
      />

      <Halos nodes={nodes} layout={layout} implode={implode} />

      {bursts.map((b) => (
        <PruneBurst key={b.id} cloud={b.cloud} onDone={() => onBurstDone(b.id)} />
      ))}

      <Projector
        nodes={nodes}
        layout={layout}
        implode={implode}
        labelRefs={labelRefs}
      />
    </Canvas>
  );
}

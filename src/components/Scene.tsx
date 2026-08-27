"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import TimelineTree from "./TimelineTree";
import CameraRig from "./CameraRig";
import PruneBurst from "./PruneBurst";
import Cosmos from "./Cosmos";
import type { Branch, LayoutPoint, TimelineNode } from "@/lib/types";
import type { PointCloud } from "@/lib/vfx";

export interface Burst {
  id: string;
  cloud: PointCloud;
}

interface Props {
  nodes: TimelineNode[];
  branches: Branch[];
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
  selectedId,
  labelRefs,
}: {
  nodes: TimelineNode[];
  layout: Map<string, LayoutPoint>;
  implode: number;
  selectedId: string | null;
  labelRefs: MutableRefObject<Map<string, HTMLElement>>;
}) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  // Measuring a label forces layout, so each is measured once and cached.
  const measured = useMemo(() => new WeakMap<HTMLElement, [number, number]>(), []);
  const placed = useMemo<Array<[number, number, number, number]>>(() => [], []);

  useFrame(() => {
    type Candidate = {
      el: HTMLElement;
      x: number;
      y: number;
      distance: number;
      fading: boolean;
      selected: boolean;
    };
    const candidates: Candidate[] = [];

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

      candidates.push({
        el,
        x,
        y,
        distance,
        fading: node.status === "fading",
        selected: node.id === selectedId,
      });
    }

    // Now that branches reach out in every direction, worlds routinely land on
    // top of each other in screen space. Place labels nearest-first and drop
    // any that would overlap one already placed - the selected world always
    // wins its spot.
    candidates.sort((a, b) => {
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      return a.distance - b.distance;
    });

    placed.length = 0;

    for (const c of candidates) {
      let box = measured.get(c.el);
      if (!box || box[0] === 0) {
        box = [c.el.offsetWidth || 120, c.el.offsetHeight || 16];
        if (box[0] > 0) measured.set(c.el, box);
      }
      const [w, h] = box;
      // The chip sits above the marker; pad so labels never touch.
      const left = c.x - w / 2;
      const top = c.y - 30;
      const right = left + w + 8;
      const bottom = top + h + 6;

      const collides = placed.some(
        ([l, t, r, b]) => left < r && right > l && top < b && bottom > t,
      );

      if (collides && !c.selected) {
        c.el.style.opacity = "0";
        continue;
      }
      placed.push([left, top, right, bottom]);

      const fade = THREE.MathUtils.clamp(1.35 - c.distance / 75, 0, 1);
      c.el.style.opacity = String(c.fading ? fade * 0.3 : fade);
    }
  });

  return null;
}

/* ------------------------------------------------------------------ scene */

export default function Scene({
  nodes,
  branches,
  layout,
  selectedId,
  bursts,
  implode,
  onSelect,
  onBurstDone,
  labelRefs,
}: Props) {
  // Recomputed as the tree grows. CameraRig only acts on it when the custodian
  // is idle, so this frames new limbs without ever yanking the view mid-drag.
  const fit = useMemo(() => fitToTree(layout), [layout]);

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
        gl.setClearColor("#04070a");
        scene.fog = new THREE.FogExp2("#04070a", 0.0035);
      }}
    >
      <ambientLight intensity={0.4} color="#8ec3a2" />
      <hemisphereLight args={["#4dffb0", "#04070a", 0.7]} />
      <pointLight position={[16, 34, 18]} intensity={520} color="#b6ffdc" distance={190} />
      <pointLight position={[-20, 6, -16]} intensity={340} color="#18b06a" distance={170} />

      <Cosmos />

      <CameraRig focus={focus} idle={bursts.length === 0} fit={fit} />

      <TimelineTree
        nodes={nodes}
        branches={branches}
        layout={layout}
        selectedId={selectedId}
        implode={implode}
        onSelect={onSelect}
      />

      {bursts.map((b) => (
        <PruneBurst key={b.id} cloud={b.cloud} onDone={() => onBurstDone(b.id)} />
      ))}

      <Projector
        nodes={nodes}
        layout={layout}
        implode={implode}
        selectedId={selectedId}
        labelRefs={labelRefs}
      />
    </Canvas>
  );
}

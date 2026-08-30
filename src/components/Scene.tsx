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
  if (points.length === 0) return { centerY: 15, height: 40, spread: 18 };

  let minY = Infinity;
  let maxY = -Infinity;
  let spread = 0;
  for (const p of points) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    spread = Math.max(spread, Math.hypot(p.x, p.z));
  }

  // The tree on screen is much bigger than the timeline's own points: the
  // trunk runs below the first event, and the procedural crown reaches about
  // as far above the last one again. Framing on the points alone left the tree
  // as a twig with the crown sliced off, so the extent is derived the same way
  // TimelineTree derives it - from the trunk span.
  const baseY = minY - 6;
  const topY = maxY + 2;
  const span = Math.max(14, topY - baseY);
  // A little taller than the wood itself: the canopy wash puffs out a couple
  // of units past the outermost tips, and framing on the branches alone
  // sliced the top off it.
  const height = span * 1.12;

  // Only the extents are returned. Turning them into a camera distance needs
  // the viewport's aspect ratio, which lives inside the Canvas - on a phone
  // the horizontal field of view is far narrower than the vertical one, and a
  // fit computed from height alone pushed the crown off both sides.
  return {
    // Biased above the geometric middle: the camera looks slightly down at the
    // tree, which pushes the projection up the frame, so aiming at the exact
    // centre cropped the crown and left the bottom of the screen empty.
    centerY: baseY + height * 0.55,
    height,
    spread: Math.max(spread, span * 0.45),
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
  centerY,
  labelRefs,
}: {
  nodes: TimelineNode[];
  layout: Map<string, LayoutPoint>;
  implode: number;
  selectedId: string | null;
  /** Height of the tree's centre, so the depth fade can be scale-relative. */
  centerY: number;
  labelRefs: MutableRefObject<Map<string, HTMLElement>>;
}) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const centre = useMemo(() => new THREE.Vector3(), []);
  // Measuring a label forces layout, so each is measured once and cached.
  const measured = useMemo(() => new WeakMap<HTMLElement, [number, number]>(), []);
  const placed = useMemo<Array<[number, number, number, number]>>(() => [], []);

  useFrame(() => {
    // Chips fade with depth, but "far" only means anything relative to how far
    // back the camera currently sits. A fixed cutoff blanked every label on a
    // phone, where the whole tree has to be framed from much further away.
    centre.set(0, centerY, 0);
    const reference = Math.max(camera.position.distanceTo(centre), 1);

    type Candidate = {
      el: HTMLElement;
      x: number;
      y: number;
      side: number;
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

      candidates.push({
        el,
        x,
        y,
        // Trunk events all share x = 0, so centred chips stacked into a column
        // straight down the trunk and hid it. Each chip is pushed out to the
        // side its branch leans toward; trunk events go right by convention.
        side: p.x < -0.4 ? -1 : 1,
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
      // The chip sits beside the marker, clear of the branch it belongs to,
      // and is flipped or clamped rather than allowed off-screen - on a phone
      // a right-hand chip on a centred trunk runs straight off the edge.
      let left = c.side > 0 ? c.x + 18 : c.x - 18 - w;
      if (left + w > size.width - 8) left = Math.min(c.x - 18 - w, size.width - 8 - w);
      if (left < 8) left = Math.min(8, size.width - 8 - w);
      const top = THREE.MathUtils.clamp(c.y - h / 2, 6, Math.max(6, size.height - h - 6));
      const right = left + w + 8;
      const bottom = top + h + 6;
      c.el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;

      const collides = placed.some(
        ([l, t, r, b]) => left < r && right > l && top < b && bottom > t,
      );

      if (collides && !c.selected) {
        c.el.style.opacity = "0";
        continue;
      }
      placed.push([left, top, right, bottom]);

      const fade = THREE.MathUtils.clamp(1.7 - c.distance / (reference * 0.95), 0, 1);
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
        gl.setClearColor("#0a1f22");
        scene.fog = new THREE.FogExp2("#0d2a2c", 0.0026);
      }}
    >
      <ambientLight intensity={1.15} color="#a8e6cf" />
      <hemisphereLight args={["#b98cf0", "#0a2a22", 1.0]} />
      <pointLight position={[14, 40, 20]} intensity={620} color="#d8b6ff" distance={220} />
      <pointLight position={[-18, 10, -14]} intensity={420} color="#5fe0a8" distance={200} />

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
        centerY={fit.centerY}
        labelRefs={labelRefs}
      />
    </Canvas>
  );
}

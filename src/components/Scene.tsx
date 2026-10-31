"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { Environment, ContactShadows, PerformanceMonitor, AdaptiveDpr } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
  SMAA,
  ToneMapping,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";

import TimelineTree from "./TimelineTree";
import CameraRig from "./CameraRig";
import PruneBurst from "./PruneBurst";
import Cosmos from "./Cosmos";
import Ground from "./Ground";
import { HDRI_URL } from "@/three/textures";
import { useGraphics } from "./GraphicsProvider";
import { freezeAt } from "@/lib/debug";
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

// Checklist item 6 wants 30-40 for a hero shot. A wide lens is the fastest
// way to make a large object read as a toy.
const CAMERA_FOV = 36;

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
  const height = span * 1.2;

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

/** One label's per-frame placement state. Pooled; see Projector. */
interface Candidate {
  el: HTMLElement;
  x: number;
  y: number;
  side: number;
  distance: number;
  fading: boolean;
  selected: boolean;
}

/** True when `a` should sort after `b`: selected wins, then nearest. */
function afterInOrder(a: Candidate, b: Candidate): boolean {
  if (a.selected !== b.selected) return !a.selected;
  return a.distance > b.distance;
}

const EMPTY_CANDIDATE = (): Candidate => ({
  el: null as unknown as HTMLElement,
  x: 0,
  y: 0,
  side: 1,
  distance: 0,
  fading: false,
  selected: false,
});

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

  /**
   * Candidate objects, reused across frames.
   *
   * This loop previously allocated an array and one object literal per label
   * every frame - about two hundred short-lived objects a frame at 60fps,
   * which is exactly the pattern that hands the collector a stutter. The pool
   * grows to the high-water mark and is then rewritten in place.
   */
  const pool = useMemo<Candidate[]>(() => [], []);
  // Measuring a label forces layout, so each is measured once and cached.
  const measured = useMemo(() => new WeakMap<HTMLElement, [number, number]>(), []);
  const placed = useMemo<Array<[number, number, number, number]>>(() => [], []);

  useFrame(() => {
    // Chips fade with depth, but "far" only means anything relative to how far
    // back the camera currently sits. A fixed cutoff blanked every label on a
    // phone, where the whole tree has to be framed from much further away.
    centre.set(0, centerY, 0);
    const reference = Math.max(camera.position.distanceTo(centre), 1);

    let used = 0;

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

      // Rewritten in place rather than pushed, so the frame allocates nothing.
      const slot = pool[used] ?? (pool[used] = EMPTY_CANDIDATE());
      slot.el = el;
      slot.x = x;
      slot.y = y;
      // Trunk events all share x = 0, so centred chips stacked into a column
      // straight down the trunk and hid it. Each chip is pushed out to the
      // side its branch leans toward; trunk events go right by convention.
      slot.side = p.x < -0.4 ? -1 : 1;
      slot.distance = distance;
      slot.fading = node.status === "fading";
      slot.selected = node.id === selectedId;
      used += 1;
    }

    // Now that branches reach out in every direction, worlds routinely land on
    // top of each other in screen space. Place labels nearest-first and drop
    // any that would overlap one already placed - the selected world always
    // wins its spot.
    /*
     * Insertion sort over the live range, in place.
     *
     * Array.sort would do the whole pool including stale tail entries, and
     * slicing first allocates an array a frame - which is the very thing the
     * pool exists to avoid. Insertion sort needs no scratch space and the
     * order barely changes between frames, so it runs close to linear here.
     * Selected first, then nearest.
     */
    for (let i = 1; i < used; i++) {
      const item = pool[i];
      let j = i - 1;
      while (j >= 0 && afterInOrder(pool[j], item)) {
        pool[j + 1] = pool[j];
        j -= 1;
      }
      pool[j + 1] = item;
    }

    placed.length = 0;

    for (let i = 0; i < used; i++) {
      const c = pool[i];
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

/* ------------------------------------------------------------- freezing */

/**
 * Pins the animation clock so the screenshot harness gets identical pixels on
 * every frame and every run.
 *
 * Priority is negative so this lands before any other frame callback and they
 * all read the pinned value. Verified against the installed R3F source: the
 * render gate counts only subscriptions with priority > 0, so a negative one
 * does not disable automatic rendering.
 */
function FreezeClock({ at }: { at: number }) {
  useFrame((state) => {
    state.clock.elapsedTime = at;
  }, -1000);
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
  // Read once: the query string does not change without a reload.
  const frozen = useMemo(() => freezeAt(), []);
  const { budget, reportPerformance } = useGraphics();

  /**
   * The post chain, as a list.
   *
   * EffectComposer types its children as elements, so `{flag && <Effect/>}`
   * does not typecheck - a falsy branch is `false`, not an element. Building
   * the array keeps the tier switch honest instead of reaching for a cast.
   */
  const effects = useMemo(() => {
    const chain = [
      // Edges first, before anything widens them. Kept at every tier:
      // aliasing on thin twigs is the most visible defect in the scene.
      <SMAA key="smaa" />,
      // High threshold on purpose: bloom is for things that are actually
      // emitting - the gold vein and the event beads - not for fogging the
      // whole frame.
      <Bloom
        key="bloom"
        intensity={0.7}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.3}
        mipmapBlur
        radius={0.7}
      />,
      <Vignette
        key="vignette"
        offset={0.3}
        darkness={0.62}
        blendFunction={BlendFunction.NORMAL}
      />,
    ];
    // Grain is a texture cue, not an effect, and the first thing to go when
    // frames are scarce.
    if (budget.post) {
      chain.push(
        <Noise
          key="noise"
          opacity={0.035}
          premultiply
          blendFunction={BlendFunction.OVERLAY}
        />,
      );
    }
    // Last: maps the linear HDR buffer down for display, exactly once.
    chain.push(<ToneMapping key="tone" mode={ToneMappingMode.ACES_FILMIC} />);
    return chain;
  }, [budget.post]);

  const focus = useMemo(() => {
    if (!selectedId) return null;
    const p = layout.get(selectedId);
    return p ? new THREE.Vector3(p.x, p.y, p.z) : null;
  }, [selectedId, layout]);

  return (
    <Canvas
      // Per tier, and lowered further at runtime by AdaptiveDpr when frames
      // get scarce. The post chain is several extra full-screen passes, so
      // resolution is the cheapest thing to give up.
      dpr={budget.dpr}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 2000, position: [0, 16, 40] }}
      shadows
      gl={{
        // Tone mapping happens once, as the last effect in the composer.
        // Leaving it on here as well would map twice and crush the highlights
        // the bloom is meant to find.
        toneMapping: THREE.NoToneMapping,
        antialias: false,
        alpha: false,
      }}
      onPointerMissed={() => onSelect(null)}
      onCreated={({ gl, scene }) => {
        gl.setClearColor("#020a0b");
        scene.fog = new THREE.FogExp2("#04191a", 0.0020);
      }}
    >
      {frozen !== null && <FreezeClock at={frozen} />}

      {/*
        Measured frame rate, not a device guess, decides the tier after the
        first couple of seconds. Frozen runs opt out: the harness pins the
        clock, so "frame rate" there is meaningless and would flap the tier
        mid-screenshot.
      */}
      {frozen === null && (
        <>
          <PerformanceMonitor
            onIncline={() => reportPerformance(true)}
            onDecline={() => reportPerformance(false)}
            onFallback={() => reportPerformance(false)}
          />
          <AdaptiveDpr pixelated={false} />
        </>
      )}

      {/*
        Image-based lighting, from a misty-morning HDRI. This is the whole
        light rig: checklist item 2 rules out lighting a PBR scene with an
        ambient and a directional, which is what this scene used to do, and
        is why its materials never read as real surfaces. `background` stays
        off - the HDRI lights the tree, Cosmos paints behind it.
      */}
      <Environment files={HDRI_URL} environmentIntensity={0.68} />

      {/*
        One real-time shadow light, per the performance budget. Angled to
        match the HDRI's own key so the cast shadow agrees with the ambient.
      */}
      <directionalLight
        position={[-14, 26, 12]}
        intensity={2.6}
        color="#dff0ff"
        castShadow
        shadow-mapSize={[budget.shadowMap, budget.shadowMap]}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={60}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0008}
      />

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

      {/*
        The surface the contact shadow actually lands on. Without it the
        shadow is a dark smudge on a dark void and grounds nothing.
      */}
      <Ground y={fit.centerY - fit.height * 0.55} radius={fit.spread * 3.4} />

      {/*
        Checklist item 4: nothing floats. The tree used to sit on a gradient
        with no contact at all, which no amount of material work can fix.
        Baked continuously rather than once: a single bake lands on the first
        render, before the bark and leaf textures have arrived, and captures
        an empty scene. 512 keeps the extra depth pass cheap.
      */}
      <ContactShadows
        position={[0, fit.centerY - fit.height * 0.55, 0]}
        scale={fit.spread * 2.6}
        resolution={budget.contactShadowRes}
        blur={2.8}
        opacity={0.85}
        far={16}
        color="#010c08"
      />

      <EffectComposer multisampling={0} enableNormalPass={false}>{effects}</EffectComposer>

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

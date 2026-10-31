"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * Live FPS, draw-call and triangle readout, against the budgets the project
 * holds itself to.
 *
 * Rendered inside the Canvas so it can read `gl.info`, but it draws nothing
 * in 3D - it pushes numbers out to a callback and the DOM shows them.
 *
 * Accounting is manual, and it has to be. `gl.info` resets itself at the top
 * of every `render()` call, and the bloom chain issues six of them per frame,
 * so a naive read reports whatever the last one did - a single full-screen
 * quad. That read "calls 1, tris 2" for a scene with a whole tree in it.
 * Instead autoReset is disabled, the counters are cleared once before any
 * pass runs, and they are read once after the last one, giving the true
 * per-frame total across the scene and the post chain.
 */

export interface PerfSample {
  fps: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
}

/** Budgets from the build standard, section 3.5. */
export const BUDGET = {
  desktop: { calls: 150, triangles: 300_000 },
  mobile: { calls: 80, triangles: 120_000 },
};

/** Runs before every pass; priority is below the freeze clock's -1000. */
const RESET_PRIORITY = -1001;
/** Runs after the bloom chain, which owns the loop at priority 1. */
const READ_PRIORITY = 2;

export function PerfProbe({ onSample }: { onSample: (s: PerfSample) => void }) {
  const { gl } = useThree();
  const frames = useRef(0);
  const since = useRef(performance.now());

  useEffect(() => {
    const info = gl.info;
    const previous = info.autoReset;
    info.autoReset = false;
    return () => {
      info.autoReset = previous;
    };
  }, [gl]);

  useFrame(() => {
    gl.info.reset();
  }, RESET_PRIORITY);

  useFrame(() => {
    frames.current += 1;
    const now = performance.now();
    const elapsed = now - since.current;
    // Report about twice a second: often enough to catch a stall, rarely
    // enough that the React update is not itself the bottleneck.
    if (elapsed < 500) return;

    const info = gl.info;
    onSample({
      fps: Math.round((frames.current * 1000) / elapsed),
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
    });

    frames.current = 0;
    since.current = now;
  }, READ_PRIORITY);

  return null;
}

/** The DOM readout. Sits outside the Canvas. */
export function PerfReadout({
  sample,
  viewport,
}: {
  sample: PerfSample | null;
  viewport: "desktop" | "mobile";
}) {
  const budget = BUDGET[viewport];
  if (!sample) {
    return (
      <div className="pointer-events-none fixed left-3 top-3 z-[100] rounded-sm border border-brass/40 bg-black/85 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-ash/70">
        measuring&hellip;
      </div>
    );
  }

  const over = (value: number, max: number) => (value > max ? "text-pill-red" : "text-weave");
  const fpsClass = sample.fps >= 55 ? "text-weave" : sample.fps >= 45 ? "text-warn" : "text-pill-red";

  return (
    <div className="pointer-events-none fixed left-3 top-3 z-[100] rounded-sm border border-brass/40 bg-black/85 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-ash/70">
      <Row label="fps" value={String(sample.fps)} className={fpsClass} />
      <Row
        label="calls"
        value={`${sample.calls} / ${budget.calls}`}
        className={over(sample.calls, budget.calls)}
      />
      <Row
        label="tris"
        value={`${sample.triangles.toLocaleString()} / ${budget.triangles.toLocaleString()}`}
        className={over(sample.triangles, budget.triangles)}
      />
      <Row label="geom" value={String(sample.geometries)} />
      <Row label="tex" value={String(sample.textures)} />
      <Row label="prog" value={String(sample.programs)} />
    </div>
  );
}

function Row({
  label,
  value,
  className = "text-ash/70",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex gap-2">
      <span className="w-10 text-ash/40">{label}</span>
      <span className={className}>{value}</span>
    </div>
  );
}

/** Convenience hook for a page that wants both halves. */
export function usePerfSample() {
  return useState<PerfSample | null>(null);
}

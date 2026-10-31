"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";

import TimelineTree from "@/components/TimelineTree";
import CameraRig from "@/components/CameraRig";
import Cosmos from "@/components/Cosmos";
import Bloom from "@/components/Bloom";
import { PerfProbe, PerfReadout, type PerfSample } from "@/components/PerfOverlay";
import { createSeedTimeline } from "@/lib/seed";
import { layoutTimeline } from "@/lib/graph";
import type { Timeline } from "@/lib/types";

/**
 * Dev-only scene index.
 *
 * Every named camera shot, rendered against the real components with live
 * FPS, draw-call and triangle counters next to the budgets they have to meet.
 * Excluded from production by the guard in src/app/dev/layout.tsx.
 *
 * Shots that depend on app state the reducer owns - a branch growing, a prune
 * dissolving - link into the real app rather than being re-implemented here;
 * duplicating the reducer would mean this page could drift from what actually
 * ships and still look correct.
 */

interface Shot {
  id: string;
  label: string;
  note: string;
  /** Pinned clock time, seconds. */
  freeze: number;
  /** Null renders here; a path opens the real app instead. */
  href: string | null;
}

const SHOTS: Shot[] = [
  { id: "establishing", label: "Establishing", note: "Whole tree at rest", freeze: 2, href: null },
  { id: "hero-orbit", label: "Hero orbit", note: "Mid idle drift", freeze: 9, href: null },
  { id: "crown", label: "Crown detail", note: "Canopy and blossom", freeze: 4, href: null },
  {
    id: "reveal-push-in",
    label: "Reveal push-in",
    note: "Event selected, panel open",
    freeze: 3,
    href: "/?freeze=3&select=1",
  },
  {
    id: "branch-grow",
    label: "Branch grow",
    note: "New limb arriving",
    freeze: 1,
    href: "/?freeze=1",
  },
  {
    id: "prune-dissolve",
    label: "Prune dissolve",
    note: "Gold particle burst",
    freeze: 1,
    href: "/?freeze=1",
  },
];

export default function ScenesPage() {
  const [shot, setShot] = useState<Shot>(SHOTS[0]);
  const [sample, setSample] = useState<PerfSample | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

  // Seeded after mount: createSeedTimeline() uses Math.random, and calling it
  // during render desynchronises server and client markup.
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  useEffect(() => setTimeline(createSeedTimeline()), []);

  useEffect(() => {
    const check = () => setViewport(window.innerWidth < 768 ? "mobile" : "desktop");
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const layout = useMemo(
    () => (timeline ? layoutTimeline(timeline) : new Map()),
    [timeline],
  );

  return (
    <div className="flex h-screen w-screen flex-col bg-hud-black text-ash">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-brass/30 px-4 py-2.5">
        <h1 className="mr-3 font-sans text-[13px] font-bold uppercase tracking-[0.14em] text-brass">
          Scenes
        </h1>
        {SHOTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setShot(s)}
            className={`rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors ${
              shot.id === s.id
                ? "border-brass bg-brass/15 text-brass"
                : "border-brass/30 text-ash/60 hover:border-brass/60 hover:text-brass"
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] text-ash/40">
          {viewport} budget &middot; {shot.note}
        </span>
      </header>

      <div className="relative min-h-0 flex-1">
        {shot.href ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="max-w-md font-mono text-[11px] leading-relaxed text-ash/55">
              This shot depends on app state the reducer owns. Re-implementing it
              here would let the dev page drift from what ships, so it opens the
              real app instead.
            </p>
            <a
              href={shot.href}
              className="rounded-full border-2 border-brass px-5 py-1.5 font-sans text-[12px] font-bold uppercase tracking-[0.08em] text-brass transition-colors hover:bg-brass hover:text-hud-black"
            >
              Open {shot.label}
            </a>
          </div>
        ) : (
          timeline && (
            <>
              <Canvas
                dpr={[1, 1.6]}
                camera={{ fov: 42, near: 0.1, far: 2000, position: [0, 16, 40] }}
                gl={{ antialias: true, alpha: false }}
                onCreated={({ gl }) => gl.setClearColor("#020a0b")}
              >
                <ambientLight intensity={0.9} color="#a8e6cf" />
                <hemisphereLight args={["#7fc8f0", "#08221c", 0.8]} />
                <Cosmos />
                <Bloom />
                <CameraRig focus={null} idle fit={{ centerY: 18, height: 44, spread: 18 }} />
                <TimelineTree
                  nodes={timeline.nodes}
                  branches={timeline.branches}
                  layout={layout}
                  selectedId={null}
                  implode={0}
                  onSelect={() => {}}
                />
                <PerfProbe onSample={setSample} />
              </Canvas>
              <PerfReadout sample={sample} viewport={viewport} />
            </>
          )
        )}
      </div>
    </div>
  );
}

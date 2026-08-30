"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GitBranch, Scroll } from "lucide-react";

import TopBar from "@/components/TopBar";
import Sidebar, { type SidebarPanel } from "@/components/Sidebar";
import EventPanel from "@/components/EventPanel";
import TimelineViewerPanel from "@/components/TimelineViewerPanel";
import CurrentDeviationsPanel from "@/components/CurrentDeviationsPanel";
import MatrixRain from "@/components/MatrixRain";
import SidePanel from "@/components/SidePanel";
import InstabilityGauge from "@/components/InstabilityGauge";
import NodeLabels from "@/components/NodeLabels";
import { Disclaimer, Hint, ResetStamp, Texture, Working } from "@/components/Chrome";
import type { Burst } from "@/components/Scene";
import { FADE } from "@/components/TimelineTree";

import {
  applyBranch,
  applyPrune,
  applyRewrite,
  descendantsOf,
  layoutTimeline,
  logEntry,
  nodeById,
  sweepFaded,
} from "@/lib/graph";
import { createSeedTimeline, makeId, PRIME_BRANCH_ID } from "@/lib/seed";
import { samplePruneCloud } from "@/lib/vfx";
import type { LayoutPoint, Timeline } from "@/lib/types";
import type { Cascade, Epitaph } from "@/lib/schemas";

// The scene touches document/WebGL on mount, so it never server-renders.
const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

const RESET_IMPLODE_MS = 1100;
const RESET_HOLD_MS = 1500;
/** How long the deviation triptych + matrix rain stay up after a branch. */
const DEVIATION_FLASH_MS = 7000;

async function callEngine<T>(payload: unknown): Promise<T> {
  const res = await fetch("/api/causality", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body?.error === "string" ? body.error : "The archive did not respond.",
    );
  }
  return body as T;
}

/** Boot frame shown for the one tick before the client seed exists. */
function Boot() {
  return (
    <main className="relative flex h-screen w-screen items-center justify-center bg-black">
      <div className="animate-flicker font-sans text-[13px] font-bold uppercase tracking-[0.28em] text-brass">
        Initialising sequence
      </div>
    </main>
  );
}

/**
 * createSeedTimeline() shuffles with Math.random, so running it during render
 * would produce different HTML on the server than on the client and blow up
 * hydration. Seed on the client, then hand a settled timeline to the custodian.
 */
export default function Page() {
  const [seed, setSeed] = useState<Timeline | null>(null);
  useEffect(() => setSeed(createSeedTimeline()), []);
  if (!seed) return <Boot />;
  return <Custodian initial={seed} />;
}

interface DeviationFlash {
  id: number;
  premise: string;
  branchLabel: string;
}

function Custodian({ initial }: { initial: Timeline }) {
  const [timeline, setTimeline] = useState<Timeline>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [implode, setImplode] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [panel, setPanel] = useState<SidebarPanel>(null);
  const [deviation, setDeviation] = useState<DeviationFlash | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const labelRefs = useRef<Map<string, HTMLElement>>(new Map());
  const resetGuard = useRef(false);
  const deviationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const layout = useMemo(() => layoutTimeline(timeline), [timeline]);
  const selected = selectedId ? nodeById(timeline, selectedId) : undefined;

  const note = useCallback((kind: "error" | "system", text: string) => {
    setTimeline((t) => ({ ...t, ledger: [logEntry(kind, text), ...t.ledger] }));
  }, []);

  const flashDeviation = useCallback((premise: string, branchLabel: string) => {
    if (deviationTimer.current) clearTimeout(deviationTimer.current);
    setDeviation({ id: Date.now(), premise, branchLabel });
    deviationTimer.current = setTimeout(() => setDeviation(null), DEVIATION_FLASH_MS);
  }, []);

  useEffect(() => () => {
    if (deviationTimer.current) clearTimeout(deviationTimer.current);
  }, []);

  /* ----------------------------------------------------------------- reset */

  useEffect(() => {
    if (timeline.instability < 100 || resetGuard.current) return;
    resetGuard.current = true;

    setResetting(true);
    setSelectedId(null);
    setPanel(null);
    setDeviation(null);

    // Collapse the whole tree toward the origin, then re-seed behind the stamp.
    const start = performance.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / RESET_IMPLODE_MS);
      setImplode(t * t);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    const reseed = window.setTimeout(() => {
      setTimeline((prev) => {
        const fresh = createSeedTimeline();
        return {
          ...fresh,
          epoch: prev.epoch + 1,
          ledger: [
            logEntry("reset", "SEQUENCE RESET // custodian privileges revoked"),
            ...prev.ledger,
          ].slice(0, 60),
        };
      });
      setBursts([]);
      setImplode(0);
    }, RESET_IMPLODE_MS + 120);

    const clear = window.setTimeout(() => {
      setResetting(false);
      resetGuard.current = false;
    }, RESET_IMPLODE_MS + RESET_HOLD_MS);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(reseed);
      clearTimeout(clear);
    };
  }, [timeline.instability]);

  /* ----------------------------------------------------------------- verbs */

  async function runBranch(nodeId: string, premise: string) {
    const anchor = nodeById(timeline, nodeId);
    if (!anchor) return;

    // Matches applyBranch's own label derivation, so the flash names the
    // branch before the graph update round-trips back through state.
    const branchLabel = premise.slice(0, 48).toUpperCase();

    setBusy("Computing causal cascade");
    try {
      const res = await callEngine<Cascade & { degraded?: boolean }>({
        mode: "branch",
        anchorYear: anchor.year,
        anchorTitle: anchor.title,
        premise,
      });
      setTimeline((t) =>
        applyBranch(t, nodeId, premise, res.events, res.instability_delta),
      );
      flashDeviation(premise, branchLabel);
    } catch (err) {
      note("error", err instanceof Error ? err.message : "Cascade failed.");
    } finally {
      setBusy(null);
    }
  }

  async function runRewrite(nodeId: string, newTitle: string) {
    const anchor = nodeById(timeline, nodeId);
    if (!anchor) return;

    setBusy("Regenerating downstream");
    try {
      const res = await callEngine<Cascade & { degraded?: boolean }>({
        mode: "rewrite",
        anchorYear: anchor.year,
        oldTitle: anchor.title,
        newTitle,
      });

      let faded: string[] = [];
      setTimeline((t) => {
        const out = applyRewrite(
          t,
          nodeId,
          newTitle,
          res.events,
          res.instability_delta,
        );
        faded = out.fadedNodeIds;
        return out.next;
      });

      if (faded.length) {
        window.setTimeout(
          () => setTimeline((t) => sweepFaded(t, faded)),
          FADE * 1000 + 120,
        );
      }
    } catch (err) {
      note("error", err instanceof Error ? err.message : "Rewrite failed.");
    } finally {
      setBusy(null);
    }
  }

  async function runPrune(nodeId: string) {
    const anchor = nodeById(timeline, nodeId);
    if (!anchor) return;

    const doomed = descendantsOf(timeline.nodes, nodeId, true);
    const doomedNodes = timeline.nodes.filter(
      (n) => doomed.has(n.id) && n.status !== "pruned",
    );
    if (doomedNodes.length === 0) return;

    const points: LayoutPoint[] = [];
    const segments: Array<[LayoutPoint, LayoutPoint]> = [];
    for (const n of doomedNodes) {
      const p = layout.get(n.id);
      if (!p) continue;
      points.push(p);
      const parent = n.parentId ? layout.get(n.parentId) : null;
      if (parent) segments.push([parent, p]);
    }

    const branchLabel =
      timeline.branches.find((b) => b.id === anchor.branchId)?.label ?? "PRIME";

    setBusy("Composing epitaph");
    setSelectedId(null);
    setDeviation(null);
    try {
      const res = await callEngine<Epitaph & { degraded?: boolean }>({
        mode: "epitaph",
        branchLabel,
        doomedTitles: doomedNodes.map((n) => n.title),
      });

      const delta = Math.max(5, Math.min(25, 6 + doomedNodes.length * 2));

      setBursts((b) => [
        ...b,
        { id: makeId("burst"), cloud: samplePruneCloud(segments, points) },
      ]);
      setTimeline((t) => applyPrune(t, nodeId, res.epitaph, delta).next);
    } catch (err) {
      note("error", err instanceof Error ? err.message : "Prune failed.");
    } finally {
      setBusy(null);
    }
  }

  const onBurstDone = useCallback((id: string) => {
    setBursts((b) => b.filter((x) => x.id !== id));
  }, []);

  /* ------------------------------------------------------------------ view */

  const aliveCount = timeline.nodes.filter((n) => n.status !== "pruned").length;
  const aliveBranches = timeline.branches.filter((b) => b.status === "alive");
  const deviationBranches = aliveBranches.filter((b) => b.id !== PRIME_BRANCH_ID);

  const originLabel = useMemo(() => {
    if (!selected) return "";
    if (selected.branchId === PRIME_BRANCH_ID) return "The Sacred Timeline";
    return timeline.branches.find((b) => b.id === selected.branchId)?.label ?? "Unknown branch";
  }, [selected, timeline.branches]);

  const selectFirstOfBranch = useCallback(
    (branchId: string) => {
      const first = timeline.nodes
        .filter((n) => n.branchId === branchId && n.status !== "pruned")
        .sort((a, b) => a.year - b.year)[0];
      if (first) setSelectedId(first.id);
      setDeviation(null);
    },
    [timeline.nodes],
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-black">
      <TopBar onToggleNav={() => setNavOpen((v) => !v)} />

      <div className="relative flex min-h-0 flex-1">
        <Sidebar
          activePanel={panel}
          open={navOpen}
          onClose={() => setNavOpen(false)}
          onSelectPanel={(p) => setPanel((cur) => (cur === p ? null : p))}
          onResetView={() => {
            setPanel(null);
            setSelectedId(null);
            setDeviation(null);
          }}
        />

        <main className="relative min-w-0 flex-1 overflow-hidden bg-black">
          <Scene
            key={timeline.epoch}
            nodes={timeline.nodes}
            branches={timeline.branches}
            layout={layout}
            selectedId={selectedId}
            bursts={bursts}
            implode={implode}
            onSelect={setSelectedId}
            onBurstDone={onBurstDone}
            labelRefs={labelRefs}
          />

          <NodeLabels
            nodes={timeline.nodes}
            selectedId={selectedId}
            labelRefs={labelRefs}
            onSelect={setSelectedId}
          />

          <Texture />
          <MatrixRain active={Boolean(deviation)} />

          <div className="pointer-events-none absolute right-6 top-6 z-20 hidden md:block">
            <InstabilityGauge value={timeline.instability} />
          </div>

          <Hint visible={!selectedId && !busy && !resetting && !panel && !deviation} />
          <Working label={busy} />
          <ResetStamp visible={resetting} />
          <Disclaimer />

          <AnimatePresence>
            {panel === "branches" && (
              <SidePanel title="Branches" icon={GitBranch} onClose={() => setPanel(null)}>
                <ul className="space-y-2">
                  {timeline.branches.map((b) => {
                    const count = timeline.nodes.filter(
                      (n) => n.branchId === b.id && n.status !== "pruned",
                    ).length;
                    return (
                      <li
                        key={b.id}
                        className={`border-2 px-3 py-2 font-sans text-[12px] ${
                          b.status === "alive"
                            ? "border-brass/50 bg-black text-white"
                            : "border-pill-red/40 bg-pill-red/10 text-pill-red/70 line-through"
                        }`}
                      >
                        <div className="truncate font-bold uppercase tracking-[0.03em]">
                          {b.label}
                        </div>
                        <div className="mt-0.5 text-[10px] normal-case tracking-normal text-ash/50">
                          depth {b.depth} · {count} events
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </SidePanel>
            )}

            {panel === "history" && (
              <SidePanel title="Prune History" icon={Scroll} onClose={() => setPanel(null)}>
                {timeline.ledger.filter((e) => e.kind === "prune").length === 0 ? (
                  <p className="py-4 text-center font-sans text-[12px] text-ash/50">
                    No branches pruned yet.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {timeline.ledger
                      .filter((e) => e.kind === "prune")
                      .map((e) => (
                        <li
                          key={e.id}
                          className="border-b border-brass/20 pb-2.5 font-sans text-[12px] leading-relaxed text-white/85"
                        >
                          {e.text}
                        </li>
                      ))}
                  </ul>
                )}
              </SidePanel>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {deviation && selected ? (
              <motion.div
                key="triptych"
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="pointer-events-auto absolute inset-x-3 bottom-3 top-3 z-30 flex flex-col gap-3 overflow-y-auto md:inset-x-auto md:bottom-auto md:right-6 md:top-6 md:max-h-[calc(100%-3rem)] md:flex-row md:items-start md:gap-4"
              >
                <EventPanel
                  node={selected}
                  originLabel={originLabel}
                  busy={busy}
                  eyebrow="Timeline Editor"
                  warning
                  onClose={() => {
                    setSelectedId(null);
                    setDeviation(null);
                  }}
                  onSave={(newTitle) => void runRewrite(selected.id, newTitle)}
                  onBranch={(premise) => void runBranch(selected.id, premise)}
                  onPrune={() => void runPrune(selected.id)}
                />
                <TimelineViewerPanel
                  premise={deviation.premise}
                  branchLabel={deviation.branchLabel}
                />
                <CurrentDeviationsPanel
                  branches={deviationBranches}
                  onSelect={selectFirstOfBranch}
                />
              </motion.div>
            ) : (
              selected && (
                <motion.div
                  key="single"
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="pointer-events-auto absolute inset-x-3 bottom-3 z-30 max-h-[70%] overflow-y-auto md:inset-x-auto md:bottom-auto md:right-6 md:top-6 md:max-h-[calc(100%-3rem)]"
                >
                  <EventPanel
                    node={selected}
                    originLabel={originLabel}
                    busy={busy}
                    onClose={() => setSelectedId(null)}
                    onSave={(newTitle) => void runRewrite(selected.id, newTitle)}
                    onBranch={(premise) => void runBranch(selected.id, premise)}
                    onPrune={() => void runPrune(selected.id)}
                  />
                </motion.div>
              )
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

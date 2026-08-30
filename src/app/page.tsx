"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { GitBranch, Scroll } from "lucide-react";

import Sidebar, { type SidebarPanel } from "@/components/Sidebar";
import RightDrawer from "@/components/RightDrawer";
import SidePanel from "@/components/SidePanel";
import DeviationBanner from "@/components/DeviationBanner";
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
const DEVIATION_BANNER_MS = 3600;

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
    <main className="relative flex h-screen w-screen items-center justify-center bg-abyss">
      <div className="animate-flicker font-mono text-[11px] uppercase tracking-[0.28em] text-weave-bright">
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

function Custodian({ initial }: { initial: Timeline }) {
  const [timeline, setTimeline] = useState<Timeline>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [implode, setImplode] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [panel, setPanel] = useState<SidebarPanel>(null);
  const [deviation, setDeviation] = useState<{ id: number; year: number } | null>(null);

  const labelRefs = useRef<Map<string, HTMLElement>>(new Map());
  const resetGuard = useRef(false);
  const deviationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const layout = useMemo(() => layoutTimeline(timeline), [timeline]);
  const selected = selectedId ? nodeById(timeline, selectedId) : undefined;

  const note = useCallback((kind: "error" | "system", text: string) => {
    setTimeline((t) => ({ ...t, ledger: [logEntry(kind, text), ...t.ledger] }));
  }, []);

  const flashDeviation = useCallback((year: number) => {
    if (deviationTimer.current) clearTimeout(deviationTimer.current);
    setDeviation({ id: Date.now(), year });
    deviationTimer.current = setTimeout(() => setDeviation(null), DEVIATION_BANNER_MS);
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
      flashDeviation(anchor.year);
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

      // Drop the superseded nodes once their fade-out has finished playing.
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

    // Snapshot the doomed geometry before the graph forgets it.
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
    try {
      const res = await callEngine<Epitaph & { degraded?: boolean }>({
        mode: "epitaph",
        branchLabel,
        doomedTitles: doomedNodes.map((n) => n.title),
      });

      // Bigger branches destabilise the sequence more.
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

  const originLabel = useMemo(() => {
    if (!selected) return "";
    if (selected.branchId === PRIME_BRANCH_ID) return "The Sacred Timeline";
    return timeline.branches.find((b) => b.id === selected.branchId)?.label ?? "Unknown branch";
  }, [selected, timeline.branches]);

  const hasDeviation = useMemo(
    () =>
      Boolean(
        selectedId &&
          timeline.branches.some(
            (b) => b.originNodeId === selectedId && b.status === "alive",
          ),
      ),
    [selectedId, timeline.branches],
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-abyss">
      <Sidebar
        activePanel={panel}
        onSelectPanel={(p) => setPanel((cur) => (cur === p ? null : p))}
        onResetView={() => {
          setPanel(null);
          setSelectedId(null);
        }}
        branchCount={aliveBranches.length}
        eventCount={aliveCount}
      />

      <main className="relative min-w-0 flex-1 overflow-hidden bg-abyss">
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

        <NodeLabels nodes={timeline.nodes} selectedId={selectedId} labelRefs={labelRefs} />

        <Texture />

        <div className="pointer-events-none absolute right-5 top-4 z-30">
          <InstabilityGauge value={timeline.instability} />
        </div>

        <Hint visible={!selectedId && !busy && !resetting && !panel} />
        <Working label={busy} />
        <ResetStamp visible={resetting} />
        <Disclaimer />

        <AnimatePresence>
          {deviation && <DeviationBanner key={deviation.id} year={deviation.year} />}
        </AnimatePresence>

        <AnimatePresence>
          {panel === "branches" && (
            <SidePanel title="Branches" icon={GitBranch} onClose={() => setPanel(null)}>
              <ul className="space-y-1.5">
                {timeline.branches.map((b) => {
                  const count = timeline.nodes.filter(
                    (n) => n.branchId === b.id && n.status !== "pruned",
                  ).length;
                  return (
                    <li
                      key={b.id}
                      className={`rounded-sm border px-2.5 py-2 font-mono text-[9.5px] ${
                        b.status === "alive"
                          ? "border-weave/25 bg-abyss-panel/40 text-ash/80"
                          : "border-warn-deep/30 bg-warn-deep/10 text-warn/60 line-through"
                      }`}
                    >
                      <div className="truncate uppercase tracking-[0.06em]">{b.label}</div>
                      <div className="mt-0.5 text-[8px] normal-case tracking-normal text-ash/40">
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
                <p className="py-4 text-center font-mono text-[10px] text-ash/40">
                  No branches pruned yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {timeline.ledger
                    .filter((e) => e.kind === "prune")
                    .map((e) => (
                      <li key={e.id} className="border-b border-weave/10 pb-2 font-mono text-[9.5px] leading-relaxed text-ash/75">
                        {e.text}
                      </li>
                    ))}
                </ul>
              )}
            </SidePanel>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selected && (
            <RightDrawer
              key={selected.id}
              node={selected}
              originLabel={originLabel}
              hasDeviation={hasDeviation}
              busy={busy}
              onClose={() => setSelectedId(null)}
              onSave={(newTitle) => void runRewrite(selected.id, newTitle)}
              onBranch={(premise) => void runBranch(selected.id, premise)}
              onPrune={() => void runPrune(selected.id)}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

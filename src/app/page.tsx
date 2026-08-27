"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Ledger from "@/components/Ledger";
import InstabilityGauge from "@/components/InstabilityGauge";
import NodeLabels from "@/components/NodeLabels";
import PromptModal from "@/components/PromptModal";
import {
  Disclaimer,
  Hint,
  ResetStamp,
  StatusStrip,
  Texture,
  TitleBlock,
  Working,
} from "@/components/Chrome";
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
import { createSeedTimeline, makeId } from "@/lib/seed";
import { samplePruneCloud } from "@/lib/vfx";
import type { LayoutPoint, Timeline, Verb } from "@/lib/types";
import type { Cascade, Epitaph } from "@/lib/schemas";

// The scene touches document/WebGL on mount, so it never server-renders.
const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

const RESET_IMPLODE_MS = 1100;
const RESET_HOLD_MS = 1500;

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

type ModalState = { verb: Exclude<Verb, "prune">; nodeId: string } | null;

/** Boot frame shown for the one tick before the client seed exists. */
function Boot() {
  return (
    <main className="relative flex h-screen w-screen items-center justify-center bg-void">
      <div className="animate-flicker font-mono text-[11px] uppercase tracking-[0.28em] text-moss-500">
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
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [implode, setImplode] = useState(0);
  const [resetting, setResetting] = useState(false);

  const labelRefs = useRef<Map<string, HTMLElement>>(new Map());
  const resetGuard = useRef(false);

  const layout = useMemo(() => layoutTimeline(timeline), [timeline]);
  const selected = selectedId ? nodeById(timeline, selectedId) : undefined;

  const note = useCallback((kind: "error" | "system", text: string) => {
    setTimeline((t) => ({ ...t, ledger: [logEntry(kind, text), ...t.ledger] }));
  }, []);

  /* ----------------------------------------------------------------- reset */

  useEffect(() => {
    if (timeline.instability < 100 || resetGuard.current) return;
    resetGuard.current = true;

    setResetting(true);
    setSelectedId(null);
    setModal(null);

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

  const onVerb = useCallback(
    (verb: Verb, nodeId: string) => {
      if (busy || resetting) return;
      if (verb === "prune") void runPrune(nodeId);
      else setModal({ verb, nodeId });
    },
    // runPrune is stable for the lifetime of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, resetting, timeline],
  );

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
      setDegraded(Boolean(res.degraded));
      setTimeline((t) =>
        applyBranch(t, nodeId, premise, res.events, res.instability_delta),
      );
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
      setDegraded(Boolean(res.degraded));

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
      setDegraded(Boolean(res.degraded));

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
  const branchCount = timeline.branches.filter((b) => b.status === "alive").length;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-void">
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
        busy={Boolean(busy) || resetting}
        labelRefs={labelRefs}
        onVerb={onVerb}
      />

      <Texture />
      <TitleBlock />

      <div className="pointer-events-none absolute right-5 top-4 z-30">
        <InstabilityGauge value={timeline.instability} />
      </div>

      <div className="pointer-events-auto absolute bottom-16 right-5 z-30 h-[38vh] max-h-[340px] w-[min(340px,32vw)]">
        <Ledger entries={timeline.ledger} />
      </div>

      <StatusStrip
        branches={branchCount}
        events={aliveCount}
        degraded={degraded}
      />
      <Hint visible={!selectedId && !busy && !resetting} />
      <Working label={busy} />
      <ResetStamp visible={resetting} />
      <Disclaimer />

      <PromptModal
        open={modal !== null}
        subtitle={modal?.verb === "rewrite" ? "Amend the record" : "Open a branch"}
        title={
          modal?.verb === "rewrite"
            ? "Rewrite this event"
            : "What if things had gone otherwise?"
        }
        placeholder={
          modal?.verb === "rewrite"
            ? "The moon landing is broadcast in reverse"
            : "the printing press was never invented"
        }
        initialValue={
          modal?.verb === "rewrite"
            ? (nodeById(timeline, modal.nodeId)?.title ?? "")
            : ""
        }
        confirmLabel={modal?.verb === "rewrite" ? "Rewrite" : "Branch"}
        onCancel={() => setModal(null)}
        onConfirm={(value) => {
          if (!modal) return;
          const { verb, nodeId } = modal;
          setModal(null);
          if (verb === "branch") void runBranch(nodeId, value);
          else void runRewrite(nodeId, value);
        }}
      />

      {/* Keeps the selected node's details reachable even when it is off-screen. */}
      {selected && !busy && (
        <div className="pointer-events-none absolute left-5 top-28 z-30 w-[230px]">
          <div className="panel px-3 py-2">
            <div className="font-mono text-[8px] uppercase tracking-[0.22em] text-gold-600">
              Selected
            </div>
            <div className="mt-1 font-mono text-[11px] text-moss-200">
              <span className="tabular-nums text-moss-500">{selected.year}</span>{" "}
              {selected.title}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

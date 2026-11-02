"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import TopBar from "@/components/TopBar";
import Sidebar, { type View } from "@/components/Sidebar";
import WorldTree from "@/components/WorldTree";
import EventPanel from "@/components/EventPanel";
import TimelineViewerPanel from "@/components/TimelineViewerPanel";
import CurrentDeviationsPanel, { type DeviationRow } from "@/components/CurrentDeviationsPanel";
import BranchesPanel from "@/components/BranchesPanel";
import PruneHistoryPanel from "@/components/PruneHistoryPanel";
import PruneConfirm from "@/components/PruneConfirm";
import RailIdle from "@/components/RailIdle";
import LedgerStrip from "@/components/LedgerStrip";
import MatrixRain from "@/components/MatrixRain";
import InstabilityGauge from "@/components/InstabilityGauge";
import FlatTimeline from "@/components/FlatTimeline";
import { CanvasFooter, ResetStamp, Texture, Working } from "@/components/Chrome";

import {
  applyBranch,
  applyPrune,
  applyRewrite,
  descendantsOf,
  logEntry,
  nodeById,
  sweepFaded,
} from "@/lib/graph";
import { createSeedTimeline, PRIME_BRANCH_ID } from "@/lib/seed";
import { forceFlat } from "@/lib/debug";
import { DOCKED, TRIPTYCH, useMediaQuery } from "@/lib/useMediaQuery";
import type { Timeline } from "@/lib/types";
import type { Cascade, Epitaph } from "@/lib/schemas";

/** How long a rewritten cascade's replaced events take to fade out. */
const FADE_MS = 900;
const RESET_HOLD_MS = 1800;
/** The dissolve a pruned limb gets before it leaves the graph for good. */
const PRUNE_DISSOLVE_MS = 760;
/** How long the deviation triptych and the alert rain stay up after a branch. */
const DEVIATION_FLASH_MS = 9000;

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

function Boot() {
  return (
    <main className="flex h-screen w-screen items-center justify-center bg-hud-black">
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

interface Deviation {
  premise: string;
  branchId: string;
  anchorId: string;
}

function Custodian({ initial }: { initial: Timeline }) {
  const [timeline, setTimeline] = useState<Timeline>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [view, setView] = useState<View>("sacred");
  const [navOpen, setNavOpen] = useState(false);
  const [deviation, setDeviation] = useState<Deviation | null>(null);
  const [pruneTarget, setPruneTarget] = useState<string | null>(null);
  const [pruningIds, setPruningIds] = useState<Set<string>>(new Set());
  const [listView, setListView] = useState(false);

  const docked = useMediaQuery(DOCKED);
  const wideEnoughForTriptych = useMediaQuery(TRIPTYCH);
  const sheetRef = useRef<HTMLDivElement>(null);

  const resetGuard = useRef(false);
  const deviationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ?flat=1 keeps the plain operable list reachable on any machine, so it is
  // photographed on every run rather than only where 3D once failed.
  useEffect(() => setListView(forceFlat()), []);

  const selected = selectedId ? nodeById(timeline, selectedId) : undefined;
  const selectedBranch = selected
    ? timeline.branches.find((b) => b.id === selected.branchId)
    : undefined;

  const note = useCallback((kind: "error" | "system", text: string) => {
    setTimeline((t) => ({ ...t, ledger: [logEntry(kind, text), ...t.ledger] }));
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
    setDeviation(null);
    setPruneTarget(null);
    setView("sacred");

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
    }, 900);

    const clear = window.setTimeout(() => {
      setResetting(false);
      resetGuard.current = false;
    }, RESET_HOLD_MS);

    return () => {
      clearTimeout(reseed);
      clearTimeout(clear);
    };
  }, [timeline.instability]);

  /* ----------------------------------------------------------------- verbs */

  const runBranch = useCallback(
    async (nodeId: string, premise: string) => {
      const anchor = nodeById(timeline, nodeId);
      if (!anchor) return;

      setBusy("Computing causal cascade");
      try {
        const res = await callEngine<Cascade>({
          mode: "branch",
          anchorYear: anchor.year,
          anchorTitle: anchor.title,
          premise,
        });

        let created: string | null = null;
        setTimeline((t) => {
          const next = applyBranch(t, nodeId, premise, res.events, res.instability_delta);
          created = next.branches[next.branches.length - 1]?.id ?? null;
          return next;
        });

        if (created) {
          if (deviationTimer.current) clearTimeout(deviationTimer.current);
          setDeviation({ premise, branchId: created, anchorId: nodeId });
          setView("sacred");
          deviationTimer.current = setTimeout(() => setDeviation(null), DEVIATION_FLASH_MS);
        }
      } catch (err) {
        note("error", err instanceof Error ? err.message : "Cascade failed.");
      } finally {
        setBusy(null);
      }
    },
    [timeline, note],
  );

  const runRewrite = useCallback(
    async (nodeId: string, newTitle: string) => {
      const anchor = nodeById(timeline, nodeId);
      if (!anchor) return;

      setBusy("Regenerating downstream");
      try {
        const res = await callEngine<Cascade>({
          mode: "rewrite",
          anchorYear: anchor.year,
          oldTitle: anchor.title,
          newTitle,
        });

        let faded: string[] = [];
        setTimeline((t) => {
          const out = applyRewrite(t, nodeId, newTitle, res.events, res.instability_delta);
          faded = out.fadedNodeIds;
          return out.next;
        });

        if (faded.length) {
          window.setTimeout(() => setTimeline((t) => sweepFaded(t, faded)), FADE_MS);
        }
      } catch (err) {
        note("error", err instanceof Error ? err.message : "Rewrite failed.");
      } finally {
        setBusy(null);
      }
    },
    [timeline, note],
  );

  /** What a prune would cost, computed for the confirmation and for the act. */
  const doomed = useMemo(() => {
    if (!pruneTarget) return null;
    const ids = descendantsOf(timeline.nodes, pruneTarget, true);
    const nodes = timeline.nodes.filter((n) => ids.has(n.id) && n.status !== "pruned");
    const branchIds = new Set(nodes.map((n) => n.branchId));
    // A branch only ends if the prune takes every event it still has.
    const ended = [...branchIds].filter((id) =>
      timeline.nodes
        .filter((n) => n.branchId === id && n.status !== "pruned")
        .every((n) => ids.has(n.id)),
    );
    const anchor = nodeById(timeline, pruneTarget);
    return {
      anchor,
      nodes,
      ended,
      label:
        timeline.branches.find((b) => b.id === anchor?.branchId)?.id === PRIME_BRANCH_ID
          ? "The Sacred Timeline"
          : (timeline.branches.find((b) => b.id === anchor?.branchId)?.label ?? "Unknown"),
    };
  }, [pruneTarget, timeline]);

  const runPrune = useCallback(async () => {
    if (!doomed?.anchor || doomed.nodes.length === 0) return;
    const nodeId = doomed.anchor.id;
    const branchLabel = doomed.label;
    const doomedTitles = doomed.nodes.map((n) => n.title);

    setPruneTarget(null);
    setSelectedId(null);
    setDeviation(null);
    setPruningIds(new Set(doomed.nodes.map((n) => n.id)));
    setBusy("Composing epitaph");

    try {
      const res = await callEngine<Epitaph>({
        mode: "epitaph",
        branchLabel,
        doomedTitles,
      });

      // Hold the dissolve long enough to be seen, then commit. The epitaph
      // usually returns faster than the animation, which is the right way
      // round: the picture is never waiting on the prose.
      await new Promise((r) => setTimeout(r, PRUNE_DISSOLVE_MS));
      const delta = Math.max(5, Math.min(25, 6 + doomedTitles.length * 2));
      setTimeline((t) => applyPrune(t, nodeId, res.epitaph, delta).next);
    } catch (err) {
      note("error", err instanceof Error ? err.message : "Prune failed.");
    } finally {
      setPruningIds(new Set());
      setBusy(null);
    }
  }, [doomed, note]);

  /* ------------------------------------------------------------- selection */

  const selectBranch = useCallback(
    (branchId: string) => {
      const first = timeline.nodes
        .filter((n) => n.branchId === branchId && n.status !== "pruned")
        .sort((a, b) => a.year - b.year)[0];
      if (first) {
        setSelectedId(first.id);
        setView("sacred");
      }
    },
    [timeline.nodes],
  );

  /* ------------------------------------------------------------------ view */

  const deviationRows = useMemo<DeviationRow[]>(
    () =>
      timeline.branches
        .filter((b) => b.status === "alive" && b.id !== PRIME_BRANCH_ID)
        .map((b) => ({
          branch: b,
          anchor: b.originNodeId ? nodeById(timeline, b.originNodeId) : undefined,
          events: timeline.nodes.filter(
            (n) => n.branchId === b.id && n.status !== "pruned",
          ).length,
        })),
    [timeline],
  );

  const flash = useMemo(() => {
    if (!deviation) return null;
    const anchor = nodeById(timeline, deviation.anchorId);
    const branch = timeline.branches.find((b) => b.id === deviation.branchId);
    if (!anchor || !branch) return null;
    const events = timeline.nodes
      .filter((n) => n.branchId === branch.id && n.status !== "pruned")
      .sort((a, b) => a.year - b.year);
    const successors = timeline.nodes
      .filter(
        (n) =>
          n.branchId === anchor.branchId && n.status !== "pruned" && n.year > anchor.year,
      )
      .sort((a, b) => a.year - b.year);
    const parentLabel =
      anchor.branchId === PRIME_BRANCH_ID
        ? "The Sacred Timeline"
        : (timeline.branches.find((b) => b.id === anchor.branchId)?.label ?? "Unknown");
    return { anchor, branch, events, successors, parentLabel };
  }, [deviation, timeline]);

  const siblingCount = selected
    ? timeline.nodes.filter(
        (n) => n.branchId === selected.branchId && n.status !== "pruned",
      ).length
    : 0;

  /** What the right-hand rail is showing, in one place for both layouts. */
  const rail =
    view === "branches" ? (
      <BranchesPanel
        branches={timeline.branches}
        nodes={timeline.nodes}
        selectedBranchId={selected?.branchId ?? null}
        onInspect={selectBranch}
        fill
      />
    ) : view === "history" ? (
      <PruneHistoryPanel entries={timeline.ledger} fill />
    ) : selected ? (
      <EventPanel
        node={selected}
        branch={selectedBranch}
        siblingCount={siblingCount}
        busy={busy}
        warning={Boolean(deviation)}
        fill
        onClose={() => setSelectedId(null)}
        onSave={(newTitle) => void runRewrite(selected.id, newTitle)}
        onBranch={(premise) => void runBranch(selected.id, premise)}
        onPrune={() => setPruneTarget(selected.id)}
      />
    ) : (
      <RailIdle
        branches={deviationRows.length}
        events={timeline.nodes.filter((n) => n.status !== "pruned").length}
      />
    );

  // A sheet left where the last scroll put it opens on the middle of a form.
  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0 });
  }, [selectedId, view, deviation]);


  return (
    <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-hud-black">
      <TopBar onToggleNav={() => setNavOpen((v) => !v)} />

      <div className="relative flex min-h-0 flex-1">
        <Sidebar
          view={view}
          stats={{
            events: timeline.nodes.filter((n) => n.status !== "pruned").length,
            deviations: deviationRows.length,
            instability: timeline.instability,
          }}
          open={navOpen}
          onClose={() => setNavOpen(false)}
          onSelect={(next) => {
            setView(next);
            if (next === "sacred") {
              setSelectedId(null);
              setDeviation(null);
            }
          }}
        />

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {/*
            The canvas is a hero of a known shape on a phone, not whatever is
            left once the dock has had its share. 112.6vw is exactly the
            height at which the painting fills a full-width canvas at the
            safe rectangle's scale (563/500), so it is the one height that
            leaves no blurred band at the top and bottom - whatever the dock
            below happens to contain. `max-h` is the guard for a landscape
            phone, where that height would be the whole window.
          */}
          <div
            className={`relative min-h-0 overflow-hidden ${
              docked ? "flex-1" : "h-[112.6vw] max-h-[58dvh] shrink-0"
            }`}
          >
          {listView ? (
            <FlatTimeline
              nodes={timeline.nodes}
              branches={timeline.branches}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <WorldTree
              key={timeline.epoch}
              timeline={timeline}
              selectedId={selectedId}
              hoveredId={hoveredId}
              pruningIds={pruningIds}
              freshBranchId={deviation?.branchId ?? null}
              onSelect={(id) => {
                setSelectedId(id);
                setView("sacred");
              }}
              onHover={setHoveredId}
              // What is docked over the canvas, so the painting and its
              // labels can keep out of the way of it.
              insetRight={flash && wideEnoughForTriptych ? 316 : 0}
            />
          )}

          <Texture />
          <MatrixRain active={Boolean(deviation)} />

          <div className="pointer-events-none absolute right-4 top-4 z-20 hidden md:block">
            <InstabilityGauge value={timeline.instability} />
          </div>

          {/* Desktop only. On a phone it printed over the painting at a
              contrast nobody could read, and the dock says the same thing. */}
          {docked && (
            <CanvasFooter
              hint={!listView && !selected && !busy && !resetting && view === "sacred"}
            />
          )}
          <Working label={busy} />
          <ResetStamp visible={resetting} />

          {/* The triptych's other two panels. Docked beside the rail where
              there is room for three columns, folded into the rail below. */}
          <AnimatePresence>
            {flash && wideEnoughForTriptych && (
              <motion.div
                key={flash.branch.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ type: "spring", stiffness: 280, damping: 30 }}
                className="absolute bottom-4 right-4 top-4 z-30 flex w-[292px] flex-col gap-3 overflow-y-auto ledger-scroll"
              >
                <TimelineViewerPanel
                  anchor={flash.anchor}
                  parentLabel={flash.parentLabel}
                  branchLabel={flash.branch.label}
                  premise={deviation?.premise ?? ""}
                  events={flash.events}
                  successors={flash.successors}
                />
                <CurrentDeviationsPanel
                  rows={deviationRows}
                  selectedBranchId={selected?.branchId ?? null}
                  onInspect={selectBranch}
                />
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          {/*
            Phones and tablets get a dock rather than a sheet that comes and
            goes. It is a sibling of the canvas in a column, not an overlay
            on it: the canvas owns its height, the dock takes the rest and
            scrolls, and neither can crowd the other out. Idle it is the
            station summary; select an event and it becomes its panel.
          */}
          {!docked && (
            <div
              ref={sheetRef}
              className="ledger-scroll flex min-h-0 flex-1 flex-col overflow-y-auto border-t-2 border-brass bg-hud-green pb-safe-b"
            >
              <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-brass/40" />
              <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
                {rail}
                {flash && (
                  <>
                    <TimelineViewerPanel
                      anchor={flash.anchor}
                      parentLabel={flash.parentLabel}
                      branchLabel={flash.branch.label}
                      premise={deviation?.premise ?? ""}
                      events={flash.events}
                      successors={flash.successors}
                    />
                    <CurrentDeviationsPanel
                      rows={deviationRows}
                      selectedBranchId={selected?.branchId ?? null}
                      onInspect={selectBranch}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          <AnimatePresence>
            {doomed?.anchor && (
              <PruneConfirm
                key="prune"
                timelineLabel={doomed.label}
                anchorTitle={doomed.anchor.title}
                eventCount={doomed.nodes.length}
                branchCount={doomed.ended.length}
                onCancel={() => setPruneTarget(null)}
                onConfirm={() => void runPrune()}
              />
            )}
          </AnimatePresence>
        </main>

        {/* Desktop rail. Docked rather than floating: the references put the
            event panel beside the tree, not on top of it, and a dock is also
            what keeps the canvas a known size instead of a guess. */}
        {docked && (
          <aside className="z-20 flex w-[312px] shrink-0 flex-col gap-3 overflow-hidden border-l-2 border-brass/70 bg-hud-green p-3 pr-safe-r xl:w-[330px] 2xl:w-[356px]">
            <div className="ledger-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {rail}
              {/* At lg the triptych has no third column, so the chart folds
                  into the rail under the editor rather than vanishing. */}
              {flash && !wideEnoughForTriptych && (
                <TimelineViewerPanel
                  anchor={flash.anchor}
                  parentLabel={flash.parentLabel}
                  branchLabel={flash.branch.label}
                  premise={deviation?.premise ?? ""}
                  events={flash.events}
                  successors={flash.successors}
                />
              )}
              {!flash && view === "sacred" && deviationRows.length > 0 && (
                <CurrentDeviationsPanel
                  rows={deviationRows}
                  selectedBranchId={selected?.branchId ?? null}
                  onInspect={selectBranch}
                />
              )}
            </div>
            {/* The foot of the rail, not the foot of the screen: pinned with
                mt-auto it stranded itself below a 440px void on a short
                laptop, and clipped its last line against the bottom edge. */}
            <LedgerStrip entries={timeline.ledger} />
          </aside>
        )}
      </div>
    </div>
  );
}

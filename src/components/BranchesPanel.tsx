"use client";

import Panel from "@/components/ui/Panel";
import { PRIME_BRANCH_ID } from "@/lib/seed";
import type { Branch, TimelineNode } from "@/lib/types";

/**
 * Every timeline on record, pruned ones included - the archive, not just the
 * living set. A pruned branch keeps its row with its history struck through,
 * because "what did I destroy" is a question this interface should answer.
 */
export default function BranchesPanel({
  branches,
  nodes,
  selectedBranchId,
  onInspect,
  fill = false,
}: {
  branches: Branch[];
  nodes: TimelineNode[];
  selectedBranchId: string | null;
  onInspect: (branchId: string) => void;
  /** Stretch to the rail's spare height instead of sitting at the top of it. */
  fill?: boolean;
}) {
  const count = (id: string) =>
    nodes.filter((n) => n.branchId === id && n.status !== "pruned").length;

  return (
    <Panel title="Branches" eyebrow="Timeline registry" fill={fill}
      className="w-full"
    >
      <ul className="space-y-2">
        {branches.map((b) => {
          const alive = b.status === "alive";
          const prime = b.id === PRIME_BRANCH_ID;
          const active = b.id === selectedBranchId;
          return (
            <li key={b.id}>
              <button
                type="button"
                disabled={!alive}
                onClick={() => onInspect(b.id)}
                className={`w-full border px-3 py-2 text-left transition-colors ${
                  !alive
                    ? "cursor-default border-pill-red/35 bg-pill-red/10"
                    : active
                      ? "border-brass bg-hud-black/70"
                      : "border-brass/30 bg-hud-black/40 hover:border-brass/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      !alive ? "bg-pill-red/60" : prime ? "bg-weave" : "bg-brass"
                    }`}
                  />
                  <span
                    className={`truncate font-sans text-[12px] font-bold uppercase tracking-[0.03em] ${
                      alive ? "text-white" : "text-pill-red/70 line-through"
                    }`}
                  >
                    {prime ? "The Sacred Timeline" : b.label}
                  </span>
                </div>
                <div className="mt-1 font-sans text-[10px] uppercase tracking-[0.14em] text-ash/50">
                  {alive ? (
                    <>
                      depth {b.depth} · <span className="tabular-nums">{count(b.id)}</span> events
                    </>
                  ) : (
                    "Pruned"
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

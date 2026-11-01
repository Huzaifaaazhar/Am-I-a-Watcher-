"use client";

import Panel from "@/components/ui/Panel";
import type { Branch, TimelineNode } from "@/lib/types";

/**
 * Every branch currently off the Sacred Timeline, with the event it split
 * from and a way into it. The row is the control - a list that names
 * deviations but cannot open them is a report, not an interface.
 */

export interface DeviationRow {
  branch: Branch;
  anchor: TimelineNode | undefined;
  events: number;
}

export default function CurrentDeviationsPanel({
  rows,
  selectedBranchId,
  onInspect,
}: {
  rows: DeviationRow[];
  selectedBranchId: string | null;
  onInspect: (branchId: string) => void;
}) {
  return (
    <Panel title="Current Deviations" className="w-full">
      {rows.length === 0 ? (
        <p className="py-2 font-sans text-[12px] text-ash/50">
          No active deviations. The Sacred Timeline is whole.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ branch, anchor, events }) => {
            const active = branch.id === selectedBranchId;
            return (
              <li key={branch.id}>
                <button
                  type="button"
                  onClick={() => onInspect(branch.id)}
                  className={`w-full border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-brass bg-hud-black/70"
                      : "border-brass/30 bg-hud-black/40 hover:border-brass/70"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-pill-red" />
                    <span className="truncate font-sans text-[12px] font-bold uppercase tracking-[0.03em] text-white">
                      {branch.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 font-sans text-[10px] uppercase tracking-[0.12em] text-ash/55">
                    <span className="truncate">
                      {anchor ? `From ${anchor.year} ${anchor.title}` : "Origin lost"}
                    </span>
                    <span className="shrink-0 tabular-nums text-brass/80">{events} ev</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

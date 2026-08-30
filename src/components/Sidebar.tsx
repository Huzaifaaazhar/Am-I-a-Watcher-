"use client";

import { Clock, GitBranch, Scroll } from "lucide-react";

import HornBadge from "./HornBadge";

export type SidebarPanel = "branches" | "history" | null;

interface Props {
  activePanel: SidebarPanel;
  onSelectPanel: (panel: SidebarPanel) => void;
  onResetView: () => void;
  branchCount: number;
  eventCount: number;
}

const NAV = [
  { key: "sacred" as const, label: "The Sacred\nTimeline", icon: Clock },
  { key: "branches" as const, label: "Branches", icon: GitBranch },
  { key: "history" as const, label: "Prune\nHistory", icon: Scroll },
];

/**
 * Fixed left HUD column: wordmark, primary nav, custodian status pip.
 * Purely chrome - the 3D canvas and the right drawer do the actual work.
 */
export default function Sidebar({
  activePanel,
  onSelectPanel,
  onResetView,
  branchCount,
  eventCount,
}: Props) {
  return (
    <aside className="relative z-30 flex h-full w-[220px] shrink-0 flex-col border-r border-weave/25 bg-abyss/95">
      <div className="pointer-events-none absolute inset-0 crt-scanlines opacity-[0.18]" />

      <div className="relative border-b border-weave/20 px-5 py-6">
        <div className="flex items-center gap-2.5">
          <HornBadge size={30} ringClassName="text-brass" fillClassName="text-abyss-deep" />
          <div className="font-display text-[15px] font-extrabold leading-[1.05] tracking-[0.06em] text-brass">
            AM I A
            <br />
            WATCHER
          </div>
        </div>
      </div>

      <nav className="relative flex-1 px-3 py-4">
        {NAV.map(({ key, label, icon: Icon }) => {
          const active = key === "sacred" ? activePanel === null : activePanel === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => (key === "sacred" ? onResetView() : onSelectPanel(key))}
              className={`mb-2 flex w-full items-center gap-3 rounded-sm border px-3 py-3 text-left font-mono text-[10.5px] uppercase leading-tight tracking-[0.1em] transition-colors ${
                active
                  ? "border-weave-bright/60 bg-weave/15 text-weave-bright"
                  : "border-weave/15 bg-abyss-panel/40 text-ash/70 hover:border-weave/40 hover:text-ash"
              }`}
            >
              <Icon size={15} strokeWidth={1.75} className="shrink-0" />
              <span className="whitespace-pre-line">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="relative border-t border-weave/20 px-3 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-ash/50">
        <div className="mb-2 flex items-center justify-between px-1">
          <span>Branches</span>
          <span className="tabular-nums text-weave-bright">{branchCount}</span>
        </div>
        <div className="flex items-center justify-between px-1">
          <span>Events</span>
          <span className="tabular-nums text-weave-bright">{eventCount}</span>
        </div>
      </div>

      <div className="relative flex items-center gap-2.5 border-t border-weave/25 px-4 py-3.5">
        <div className="relative">
          <HornBadge size={34} ringClassName="text-brass" fillClassName="text-abyss-deep" />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-abyss bg-weave-bright shadow-[0_0_6px_2px_rgba(0,255,204,0.6)]" />
        </div>
        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-ash">
            Custodian
          </div>
          <div className="truncate font-mono text-[8px] uppercase tracking-[0.16em] text-weave-bright">
            Status: God of Stories
          </div>
        </div>
      </div>
    </aside>
  );
}

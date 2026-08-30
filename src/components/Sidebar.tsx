"use client";

import HornBadge from "./HornBadge";

export type SidebarPanel = "branches" | "history" | null;

interface Props {
  activePanel: SidebarPanel;
  onSelectPanel: (panel: SidebarPanel) => void;
  onResetView: () => void;
}

const NAV = [
  { key: "sacred" as const, label: "The Sacred\nTimeline" },
  { key: "branches" as const, label: "Branches" },
  { key: "history" as const, label: "Prune\nHistory" },
];

/**
 * Left HUD column. Big gold nav blocks on black, a diagonal gold accent
 * notched into the top-right corner, and the active row carries a chevron
 * that bites into the canvas margin - matching the reference's TVA-panel cut.
 */
export default function Sidebar({ activePanel, onSelectPanel, onResetView }: Props) {
  return (
    <aside className="relative z-30 flex h-full w-[300px] shrink-0 flex-col bg-black">
      {/* Diagonal gold accent notched into the top-right corner. */}
      <svg
        className="pointer-events-none absolute -right-px -top-px h-[120px] w-[120px]"
        viewBox="0 0 120 120"
        preserveAspectRatio="none"
      >
        <polygon points="0,0 120,0 120,26 40,26 0,90" fill="#D4AF37" />
        <polygon points="0,0 120,0 120,14 46,14 8,64" fill="#0B3D2E" />
      </svg>

      <nav className="relative px-0 pt-8">
        {NAV.map(({ key, label }) => {
          const active = key === "sacred" ? activePanel === null : activePanel === key;
          return (
            <div key={key} className="relative mb-3">
              <button
                type="button"
                onClick={() => (key === "sacred" ? onResetView() : onSelectPanel(key))}
                className={`block w-[254px] border-2 px-6 py-6 text-left font-sans text-[26px] font-extrabold uppercase leading-[1.08] tracking-[0.01em] transition-colors ${
                  active
                    ? "border-brass bg-black text-brass"
                    : "border-weave/50 bg-black text-brass/90 hover:border-weave-bright/70"
                }`}
              >
                <span className="whitespace-pre-line">{label}</span>
              </button>
              {active && (
                <svg
                  className="pointer-events-none absolute -right-[46px] top-0 h-full w-[54px]"
                  viewBox="0 0 54 100"
                  preserveAspectRatio="none"
                >
                  <polygon points="0,0 40,50 0,100" fill="#D4AF37" opacity="0.9" />
                </svg>
              )}
            </div>
          );
        })}
      </nav>

      <div className="relative mt-auto flex justify-center pb-10 pt-6">
        <div className="rounded-full border-[3px] border-brass bg-brass p-[3px]">
          <div className="rounded-full bg-black p-3">
            <HornBadge size={54} ringClassName="text-brass" fillClassName="text-black" />
          </div>
        </div>
      </div>
    </aside>
  );
}

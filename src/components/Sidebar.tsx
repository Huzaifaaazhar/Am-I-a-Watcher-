"use client";

import HornBadge from "./HornBadge";

export type SidebarPanel = "branches" | "history" | null;

interface Props {
  activePanel: SidebarPanel;
  onSelectPanel: (panel: SidebarPanel) => void;
  onResetView: () => void;
  /** Mobile only: the drawer is off-canvas until the hamburger opens it. */
  open: boolean;
  onClose: () => void;
}

const NAV = [
  { key: "sacred" as const, label: "The Sacred\nTimeline" },
  { key: "branches" as const, label: "Branches" },
  { key: "history" as const, label: "Prune\nHistory" },
];

/**
 * Left navigation column: green ground, near-black nav blocks with gold text,
 * a gold diagonal notched into the top-right corner and a gold chevron on the
 * active row that bites into the canvas.
 *
 * Below `md` it becomes an off-canvas drawer with a scrim - at phone widths a
 * fixed 300px column would eat two thirds of the screen.
 */
export default function Sidebar({
  activePanel,
  onSelectPanel,
  onResetView,
  open,
  onClose,
}: Props) {
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-hud-green transition-transform duration-200 md:relative md:z-30 md:w-[260px] md:translate-x-0 lg:w-[300px] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Gold diagonal notched into the top-right corner. */}
        <svg
          className="pointer-events-none absolute -right-px top-0 h-[104px] w-[104px]"
          viewBox="0 0 104 104"
          preserveAspectRatio="none"
        >
          <polygon points="0,0 104,0 104,22 34,22 0,78" fill="#E8C34A" />
          <polygon points="0,0 104,0 104,11 40,11 6,55" fill="#0B4A34" />
        </svg>

        <nav className="relative pt-6 md:pt-8">
          {NAV.map(({ key, label }) => {
            const active = key === "sacred" ? activePanel === null : activePanel === key;
            return (
              <div key={key} className="relative mb-2.5 md:mb-3">
                <button
                  type="button"
                  onClick={() => {
                    if (key === "sacred") onResetView();
                    else onSelectPanel(key);
                    onClose();
                  }}
                  className={`block w-[212px] border-2 bg-hud-black px-5 py-4 text-left font-sans text-[19px] font-extrabold uppercase leading-[1.1] tracking-[0.01em] transition-colors md:w-[224px] md:px-6 md:py-5 md:text-[22px] lg:w-[254px] lg:text-[26px] ${
                    active
                      ? "border-brass text-brass"
                      : "border-weave/45 text-brass/85 hover:border-brass/70 hover:text-brass"
                  }`}
                >
                  <span className="whitespace-pre-line">{label}</span>
                </button>
                {active && (
                  <svg
                    className="pointer-events-none absolute -right-[40px] top-0 hidden h-full w-[46px] md:block"
                    viewBox="0 0 46 100"
                    preserveAspectRatio="none"
                  >
                    <polygon points="0,0 34,50 0,100" fill="#E8C34A" />
                  </svg>
                )}
              </div>
            );
          })}
        </nav>

        <div className="relative mt-auto flex justify-center pb-8 pt-6 md:pb-10">
          <div className="rounded-full border-[3px] border-brass bg-brass p-[3px]">
            <div className="rounded-full bg-hud-black p-2.5 md:p-3">
              <HornBadge size={44} ringClassName="text-brass" fillClassName="text-hud-black" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

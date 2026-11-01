"use client";

import HornBadge from "./HornBadge";

export type View = "sacred" | "branches" | "history";

interface Props {
  view: View;
  onSelect: (view: View) => void;
  /** Below lg the rail is an off-canvas drawer rather than a column. */
  open: boolean;
  onClose: () => void;
}

const NAV: Array<{ key: View; label: string }> = [
  { key: "sacred", label: "The Sacred\nTimeline" },
  { key: "branches", label: "Branches" },
  { key: "history", label: "Prune\nHistory" },
];

/**
 * Left navigation: green ground, near-black blocks with gold type, a gold
 * diagonal notched into the top-right corner and a chevron on the active row
 * that bites into the canvas.
 *
 * Below `lg` it is an off-canvas drawer. It used to dock at `md`, but at 768
 * a docked rail plus the event panel left the canvas a 168px strip - the
 * tree, which is the entire point of the screen, became a sliver.
 */
export default function Sidebar({ view, onSelect, open, onClose }: Props) {
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-hud-green pl-safe-l pt-safe-t transition-transform duration-200 lg:relative lg:z-30 lg:w-[268px] lg:translate-x-0 lg:pt-0 xl:w-[300px] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Gold diagonal notched into the top-right corner. */}
        <svg
          className="pointer-events-none absolute -right-px top-0 h-[104px] w-[104px]"
          viewBox="0 0 104 104"
          preserveAspectRatio="none"
          aria-hidden
        >
          <polygon points="0,0 104,0 104,22 34,22 0,78" fill="#E8C34A" />
          <polygon points="0,0 104,0 104,11 40,11 6,55" fill="#0B4A34" />
        </svg>

        <nav className="relative pt-6 md:pt-8">
          {NAV.map(({ key, label }) => {
            const active = view === key;
            return (
              <div key={key} className="relative mb-2.5 md:mb-3">
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    onSelect(key);
                    onClose();
                  }}
                  className={`block w-[212px] border-2 bg-hud-black px-5 py-4 text-left font-sans text-[19px] font-extrabold uppercase leading-[1.1] tracking-[0.01em] transition-colors md:w-[224px] md:px-6 md:py-5 md:text-[22px] lg:w-[232px] lg:text-[23px] xl:w-[254px] xl:text-[26px] ${
                    active
                      ? "border-brass text-brass"
                      : "border-weave/45 text-brass/85 hover:border-brass/70 hover:text-brass"
                  }`}
                >
                  <span className="whitespace-pre-line">{label}</span>
                </button>
                {active && (
                  <svg
                    className="pointer-events-none absolute -right-[40px] top-0 hidden h-full w-[46px] lg:block"
                    viewBox="0 0 46 100"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <polygon points="0,0 34,50 0,100" fill="#E8C34A" />
                  </svg>
                )}
              </div>
            );
          })}
        </nav>

        <div className="relative mt-auto flex justify-center pb-[calc(2rem+var(--safe-bottom))] pt-6 md:pb-[calc(2.5rem+var(--safe-bottom))]">
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

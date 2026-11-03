"use client";

import HornBadge from "./HornBadge";

export type View = "sacred" | "branches" | "history";

interface Props {
  view: View;
  onSelect: (view: View) => void;
  /** Live counts, shown in the drawer where the gauge is off screen. */
  stats: { events: number; deviations: number; instability: number };
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
 * Every block is the same object. They used to size themselves to their own
 * text, so "Branches" was a short box between two tall ones and the column
 * read as three separately positioned buttons; now one fixed height, one
 * padding, one border weight, one gap, and the labels are centred in it.
 *
 * The gold rail down its right edge is the same line the diagonal notch at
 * the top runs into, and it is what frames the canvas rather than leaving the
 * painting to start against bare green.
 *
 * Below `lg` it is an off-canvas drawer. It used to dock at `md`, but at 768
 * a docked rail plus the event panel left the canvas a 168px strip - the
 * tree, which is the entire point of the screen, became a sliver.
 */
export default function Sidebar({ view, onSelect, stats, open, onClose }: Props) {
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[244px] flex-col bg-hud-green pl-safe-l pt-safe-t shadow-[8px_0_32px_-12px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-out lg:relative lg:z-30 lg:w-[228px] lg:translate-x-0 lg:border-r-2 lg:border-brass/60 lg:pt-0 lg:shadow-none xl:w-[252px] 2xl:w-[292px] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Gold diagonal notched into the top-right corner. */}
        <svg
          className="pointer-events-none absolute -right-px top-0 h-[92px] w-[92px]"
          viewBox="0 0 104 104"
          preserveAspectRatio="none"
          aria-hidden
        >
          <polygon points="0,0 104,0 104,22 34,22 0,78" fill="#E8C34A" />
          <polygon points="0,0 104,0 104,11 40,11 6,55" fill="#0B4A34" />
        </svg>

        <nav className="relative flex flex-col gap-3 px-4 pt-7 md:pt-8">
          {NAV.map(({ key, label }) => {
            const active = view === key;
            return (
              <div key={key} className="relative">
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    onSelect(key);
                    onClose();
                  }}
                  className={`flex h-[68px] w-full items-center border-2 bg-hud-black px-4 text-left font-sans text-[17px] font-extrabold uppercase leading-[1.08] tracking-[0.01em] transition-colors md:h-[72px] md:px-5 md:text-[19px] 2xl:h-[84px] 2xl:text-[22px] ${
                    active
                      ? "border-brass text-brass"
                      : "border-weave/40 text-brass/85 hover:border-brass/70 hover:text-brass"
                  }`}
                >
                  <span className="whitespace-pre-line">{label}</span>
                </button>
                {active && (
                  <svg
                    className="pointer-events-none absolute -right-[18px] top-0 hidden h-full w-[22px] lg:block"
                    viewBox="0 0 22 100"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <polygon points="0,0 22,50 0,100" fill="#E8C34A" />
                  </svg>
                )}
              </div>
            );
          })}
        </nav>

        {/*
          The drawer only. On a phone the instability gauge sits off screen
          behind the dock, and the column under the nav was a tall empty
          green field; this is the one place that readout can live.
        */}
        <dl className="mt-6 space-y-2 px-4 lg:hidden">
          {[
            ["Events held", String(stats.events)],
            ["Deviations", String(stats.deviations)],
            ["Instability", `${Math.round(stats.instability)}%`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between border-b border-brass/20 pb-1.5"
            >
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-brass/60">
                {label}
              </dt>
              <dd className="font-sans text-[13px] font-extrabold tabular-nums text-ash">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {/*
          The custodian's mark. It was a 44px pip lost in a tall empty column;
          at this size it is the thing that closes the sidebar off, which is
          what it is doing in the reference.
        */}
        <div className="relative mt-auto flex flex-col items-center gap-3 px-4 pb-[calc(2.25rem+var(--safe-bottom))] pt-8">
          <span className="h-px w-16 bg-brass/30" />
          {/*
            A struck disc: solid brass with the silhouette cut out of it, and
            a darker ring inside the rim. It was a thin gold outline on a
            near-black fill, which at this size read as an empty slot.
          */}
          <div className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full bg-brass shadow-[0_4px_14px_-6px_rgba(0,0,0,0.9)] 2xl:h-[96px] 2xl:w-[96px]">
            <span className="absolute inset-[7px] rounded-full border border-hud-black/40" />
            <HornBadge
              size={54}
              className="2xl:hidden"
              ringClassName="text-hud-black"
              fillClassName="text-brass"
            />
            <HornBadge
              size={62}
              className="hidden 2xl:block"
              ringClassName="text-hud-black"
              fillClassName="text-brass"
            />
          </div>
          <span className="font-sans text-[10px] font-bold uppercase tracking-[0.24em] text-brass/60">
            Custodian
          </span>
        </div>
      </aside>
    </>
  );
}

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
 * Left navigation.
 *
 * The rows are one stack, not three buttons. They used to be inset blocks
 * floating on the green with a gutter either side, each carrying its own
 * two-pixel border - which read as three things dropped on a field rather
 * than as a column of chrome. Now they run from the left edge to the gold
 * rail, divided by hairlines, and the only thing that moves between states is
 * the active row: brighter type, a gold edge, and the arrow on the rail.
 *
 * The rail down the right edge is continuous with the stepped notch at the
 * top and the diagonal at the foot. It frames the canvas instead of letting
 * the painting start against bare green.
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
        className={`fixed inset-y-0 left-0 z-50 flex w-[244px] flex-col overflow-hidden bg-gradient-to-b from-hud-panel via-hud-green to-hud-green-dark pl-safe-l pt-safe-t shadow-[8px_0_32px_-12px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-out lg:relative lg:z-30 lg:w-[228px] lg:translate-x-0 lg:border-r-2 lg:border-brass/60 lg:pt-0 lg:shadow-none xl:w-[252px] 2xl:w-[292px] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* The stepped corner. A solid gold shape that the rail runs out of,
            rather than the thin stray diagonal this used to draw. */}
        <svg
          className="pointer-events-none absolute -right-px top-0 h-[56px] w-[112px]"
          viewBox="0 0 112 56"
          preserveAspectRatio="none"
          aria-hidden
        >
          <polygon points="112,0 112,56 98,56 98,13 34,13 0,0" fill="#E8C34A" />
        </svg>

        <nav className="relative mt-[62px] border-y border-brass/45">
          {NAV.map(({ key, label }, i) => {
            const active = view === key;
            return (
              <div key={key} className="relative">
                {i > 0 && <div className="h-px bg-brass/45" />}
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    onSelect(key);
                    onClose();
                  }}
                  className={`relative flex h-[88px] w-full items-center overflow-hidden bg-hud-black pl-6 pr-7 text-left font-sans text-[22px] font-extrabold uppercase leading-[1.04] tracking-[-0.012em] transition-colors before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/[0.055] before:to-transparent before:to-55% md:h-[94px] md:text-[24px] 2xl:h-[104px] 2xl:text-[27px] ${
                    active ? "text-brass" : "text-brass/70 hover:text-brass"
                  }`}
                >
                  {/* The active edge. A four-pixel bar, not a border swap:
                      swapping borders moved the text by a pixel on every
                      selection, which the eye reads as a twitch. */}
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 w-1 transition-colors ${
                      active ? "bg-brass" : "bg-transparent"
                    }`}
                  />
                  <span className="whitespace-pre-line">{label}</span>
                </button>

                {/* The arrow sits on the rail and points back into its row. */}
                {active && (
                  <svg
                    className="pointer-events-none absolute -right-[9px] top-1/2 hidden h-[30px] w-[16px] -translate-y-1/2 lg:block"
                    viewBox="0 0 16 30"
                    aria-hidden
                  >
                    <polygon points="16,0 16,30 0,15" fill="#E8C34A" />
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
        <dl className="mt-6 space-y-2 px-6 lg:hidden">
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

        {/* The rail steps inward for a stretch, then returns to the edge.
            It is the detail that stops a 700px gold line reading as a border
            somebody forgot to style. Placed clear of the nav stack: its top
            diagonal was cutting across the last row's right edge. */}
        <svg
          className="pointer-events-none absolute -right-px top-[56%] hidden h-[170px] w-[20px] lg:block"
          viewBox="0 0 20 190"
          aria-hidden
        >
          <polyline
            points="19,0 19,18 6,34 6,136 19,152 19,170"
            fill="none"
            stroke="#E8C34A"
            strokeWidth="2"
          />
        </svg>

        {/* A stripe at the foot, mirroring the notch at the head. A filled
            wedge was tried first and read as a dropped triangle; what the
            reference has is a line, running off the rail. */}
        <svg
          className="pointer-events-none absolute -right-px bottom-0 hidden h-[150px] w-[112px] lg:block"
          viewBox="0 0 112 150"
          preserveAspectRatio="none"
          aria-hidden
        >
          <polygon points="112,34 112,54 26,150 6,150" fill="#E8C34A" />
        </svg>

        <div className="relative mt-auto flex flex-col items-center px-4 pb-[calc(2.75rem+var(--safe-bottom))] pt-8">
          {/*
            A struck disc: solid brass with the silhouette cut out of it, and
            a darker ring inside the rim. It was a thin gold outline on a
            near-black fill, which at this size read as an empty slot.
          */}
          <div className="relative flex h-[112px] w-[112px] items-center justify-center rounded-full bg-brass shadow-[0_6px_20px_-8px_rgba(0,0,0,0.95)] 2xl:h-[126px] 2xl:w-[126px]">
            <span className="absolute inset-[8px] rounded-full border border-hud-black/35" />
            <HornBadge size={74} bare ringClassName="text-hud-black" className="2xl:hidden" />
            <HornBadge
              size={84}
              bare
              ringClassName="text-hud-black"
              className="hidden 2xl:block"
            />
          </div>
        </div>
      </aside>
    </>
  );
}

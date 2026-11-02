"use client";

import Panel from "@/components/ui/Panel";

/**
 * What the rail says before anything is selected.
 *
 * An empty column reads as a loading state, and the references never show
 * one. This states where the custodian is and what the tree is for, which is
 * also the only place the interaction is explained on a touch device.
 */
export default function RailIdle({
  branches,
  events,
}: {
  branches: number;
  events: number;
}) {
  return (
    <Panel title="The Sacred Timeline" eyebrow="Custodian station" className="w-full">
      <p className="mb-4 font-sans text-[12.5px] leading-relaxed text-ash/85">
        Every marker out on the boughs is a recorded event. Choose one to read
        it, rewrite it, or let it grow a universe of its own.
      </p>

      <dl className="grid grid-cols-2 gap-px border border-brass/25 bg-brass/20">
        <div className="bg-hud-black/55 px-3 py-2.5">
          <dt className="font-sans text-[9px] font-bold uppercase tracking-[0.18em] text-brass/65">
            Events held
          </dt>
          <dd className="font-sans text-[18px] font-extrabold text-white tabular-nums">
            {events}
          </dd>
        </div>
        <div className="bg-hud-black/55 px-3 py-2.5">
          <dt className="font-sans text-[9px] font-bold uppercase tracking-[0.18em] text-brass/65">
            Deviations
          </dt>
          <dd
            className={`font-sans text-[18px] font-extrabold tabular-nums ${
              branches > 0 ? "text-warn" : "text-weave"
            }`}
          >
            {branches}
          </dd>
        </div>
      </dl>

      {/* The paragraph above already says this; on a phone the dock is
          competing with the tree for height and the line is a duplicate. */}
      <p className="mt-4 hidden font-sans text-[10px] uppercase leading-relaxed tracking-[0.14em] text-ash/40 lg:block">
        Gold marks a recorded event · choose one to open its timeline
      </p>

      {/* The canvas footer carries this on a desktop, where there is room for
          it over the painting. On a phone the dock is the only place left. */}
      <p className="mt-3 font-sans text-[9px] leading-relaxed text-ash/30 lg:hidden">
        Unofficial fan project. Not affiliated with, endorsed by, or sponsored
        by Marvel or Disney.
      </p>
    </Panel>
  );
}

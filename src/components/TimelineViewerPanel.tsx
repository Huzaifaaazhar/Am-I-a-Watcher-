"use client";

import Panel from "@/components/ui/Panel";
import type { TimelineNode } from "@/lib/types";

/**
 * The deviation, drawn as two timelines rather than described in prose.
 *
 * One curve for the Sacred Timeline, one peeling away from it at the exact
 * event that was changed, and a marker where they part. Curved, not the
 * straight polyline a chart library would give: these are branches of a tree,
 * and a right angle would say "graph" where the whole interface says "growth".
 *
 * Both lines are drawn from the live graph - the sacred markers are the real
 * events either side of the fork, and the deviant ones are the cascade the
 * engine returned.
 */

interface Props {
  /** Where the split happened. */
  anchor: TimelineNode;
  parentLabel: string;
  branchLabel: string;
  premise: string;
  /** Events the new branch grew, in year order. */
  events: TimelineNode[];
  /** The sacred events that follow the anchor, which the branch replaces. */
  successors: TimelineNode[];
}

const W = 260;
const H = 128;
const FORK_X = 96;
const SPINE_Y = 46;

export default function TimelineViewerPanel({
  anchor,
  parentLabel,
  branchLabel,
  premise,
  events,
  successors,
}: Props) {
  const sacredTail = successors.slice(0, 3);
  const deviantTail = events.slice(0, 3);

  const along = (i: number, n: number) =>
    FORK_X + 26 + (n <= 1 ? 60 : (i / (n - 1)) * 128);

  // The deviant line drops away from the spine and then flattens out, so the
  // split reads as a departure that settles into its own history.
  const deviant =
    `M${FORK_X},${SPINE_Y} C${FORK_X + 34},${SPINE_Y + 2} ` +
    `${FORK_X + 46},${SPINE_Y + 40} ${W - 12},${SPINE_Y + 44}`;

  const sacred =
    `M12,${SPINE_Y + 6} C${FORK_X - 42},${SPINE_Y + 6} ${FORK_X - 30},${SPINE_Y} ` +
    `${FORK_X},${SPINE_Y} C${FORK_X + 60},${SPINE_Y} ${W - 70},${SPINE_Y - 16} ${W - 12},${SPINE_Y - 22}`;

  const sacredY = (i: number, n: number) => SPINE_Y - 4 - (n <= 1 ? 8 : (i / (n - 1)) * 16);
  const deviantY = (i: number, n: number) => SPINE_Y + 28 + (n <= 1 ? 10 : (i / (n - 1)) * 14);

  return (
    <Panel title="Timeline Viewer" className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Deviation chart">
        {/* Axes, kept faint - they are a frame, not data. */}
        <line x1="12" y1={H - 10} x2={W - 8} y2={H - 10} stroke="rgb(232 195 74 / 0.3)" />
        <line x1="12" y1="8" x2="12" y2={H - 10} stroke="rgb(232 195 74 / 0.3)" />

        <path d={sacred} fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" />
        <path
          d={deviant}
          fill="none"
          stroke="#B03A2E"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray="5 4"
        />

        {sacredTail.map((n, i) => (
          <circle
            key={n.id}
            cx={along(i, sacredTail.length)}
            cy={sacredY(i, sacredTail.length)}
            r="2.6"
            fill="#10B981"
          />
        ))}
        {deviantTail.map((n, i) => (
          <circle
            key={n.id}
            cx={along(i, deviantTail.length)}
            cy={deviantY(i, deviantTail.length)}
            r="2.6"
            fill="#B03A2E"
          />
        ))}

        <circle cx={FORK_X} cy={SPINE_Y} r="4.5" fill="#E8C34A" />
        <circle cx={FORK_X} cy={SPINE_Y} r="8" fill="none" stroke="#E8C34A" strokeOpacity="0.4" />

        <text
          x={FORK_X + 12}
          y={SPINE_Y - 14}
          className="fill-weave"
          style={{ font: "700 8px var(--font-mono), monospace", letterSpacing: "0.08em" }}
        >
          SACRED TIMELINE
        </text>
        <text
          x={FORK_X + 12}
          y={SPINE_Y + 64}
          className="fill-pill-red"
          style={{ font: "700 8px var(--font-mono), monospace", letterSpacing: "0.08em" }}
        >
          DEVIATION CREATED
        </text>
      </svg>

      <div className="mt-2 border border-brass/45 bg-hud-black/55 px-3 py-2.5">
        <div className="mb-1 font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brass/70">
          Point of deviation
        </div>
        <p className="font-sans text-[12px] leading-snug text-white">
          <span className="tabular-nums text-brass">{anchor.year}</span>{" "}
          {anchor.title}
          <span className="mt-1 block text-[11px] text-ash/70">on {parentLabel}</span>
        </p>
      </div>

      <div className="mt-2 border border-warn/50 bg-hud-black/40 px-3 py-2.5">
        <p className="font-sans text-[12px] leading-snug text-white">
          {premise}
          <span className="mt-1 block font-extrabold uppercase tracking-[0.06em] text-warn">
            results in…
          </span>
          <span className="block truncate font-extrabold uppercase text-brass">
            {branchLabel}
          </span>
        </p>
      </div>
    </Panel>
  );
}

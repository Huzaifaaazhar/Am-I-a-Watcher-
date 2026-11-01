"use client";

import { useMemo } from "react";

import type { Branch, TimelineNode } from "@/lib/types";

/**
 * The timeline as a plain list.
 *
 * The canvas is now a painting with an SVG over it, so there is no longer a
 * class of machine that cannot render it and this is not a fallback. It is
 * kept because it is still the fastest way to read the whole graph at once,
 * and because a screen reader on a 40-event tree wants a list, not a map.
 * Reach it with `?flat=1`.
 *
 * It drives exactly the same selection state and the same action panel as
 * the tree does - a list that cannot act is a report.
 */

interface Props {
  nodes: TimelineNode[];
  branches: Branch[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function FlatTimeline({
  nodes,
  branches,
  selectedId,
  onSelect,
}: Props) {
  const grouped = useMemo(() => {
    const alive = branches.filter((b) => b.status === "alive");
    return alive
      .map((branch) => ({
        branch,
        events: nodes
          .filter((n) => n.branchId === branch.id && n.status !== "pruned")
          .sort((a, b) => a.year - b.year),
      }))
      .filter((group) => group.events.length > 0)
      .sort((a, b) => a.branch.depth - b.branch.depth || a.branch.index - b.branch.index);
  }, [nodes, branches]);

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-4 py-5 md:px-8 md:py-7">
      <div
        role="note"
        className="mb-5 max-w-[60ch] border-l-2 border-brass/60 bg-hud-black/50 px-3.5 py-2.5 font-sans text-[12px] leading-relaxed text-ash/80"
      >
        Showing the Sacred Timeline as a plain list, as requested by
        ?flat=1. Every event remains fully operable.
      </div>

      {grouped.map(({ branch, events }) => (
        <section key={branch.id} className="mb-7 last:mb-0">
          <h2 className="mb-2.5 flex items-baseline gap-2 font-sans text-[13px] font-bold uppercase tracking-[0.14em] text-brass">
            <span
              aria-hidden
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                branch.depth === 0 ? "bg-weave" : "bg-warn"
              }`}
            />
            {branch.depth === 0 ? "The Sacred Timeline" : branch.label}
          </h2>

          <ol className="relative ml-[3px] border-l border-brass/25 pl-4">
            {events.map((node) => {
              const selected = node.id === selectedId;
              return (
                <li key={node.id} className="relative mb-1.5 last:mb-0">
                  <span
                    aria-hidden
                    className={`absolute -left-[21px] top-[11px] h-1.5 w-1.5 rounded-full ${
                      selected ? "bg-brass" : "bg-brass/45"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => onSelect(node.id)}
                    aria-current={selected ? "true" : undefined}
                    className={`w-full rounded-sm border px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${
                      selected
                        ? "border-brass bg-brass/10"
                        : "border-transparent hover:border-brass/40 hover:bg-hud-black/40"
                    }`}
                  >
                    <span className="flex flex-wrap items-baseline gap-x-2.5">
                      <span className="font-mono text-[11px] tabular-nums text-brass/70">
                        {node.year}
                      </span>
                      <span
                        className={`font-sans text-[13.5px] font-bold uppercase leading-snug ${
                          selected ? "text-brass" : "text-ash"
                        }`}
                      >
                        {node.title}
                      </span>
                    </span>
                    {node.consequence && (
                      <span className="mt-1 block max-w-[60ch] font-sans text-[12px] leading-relaxed text-ash/55">
                        {node.consequence}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

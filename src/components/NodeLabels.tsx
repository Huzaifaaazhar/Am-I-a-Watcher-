"use client";

import { useCallback, type MutableRefObject } from "react";

import type { TimelineNode, Verb } from "@/lib/types";

interface Props {
  nodes: TimelineNode[];
  selectedId: string | null;
  busy: boolean;
  labelRefs: MutableRefObject<Map<string, HTMLElement>>;
  onVerb: (verb: Verb, nodeId: string) => void;
}

/** Radial offsets in px from the node marker. */
const VERBS: Array<{
  verb: Verb;
  label: string;
  dx: number;
  dy: number;
  hint: string;
  tone: string;
}> = [
  {
    verb: "branch",
    label: "BRANCH",
    dx: -78,
    dy: -46,
    hint: "fork a what-if",
    tone: "border-moss-400/70 text-moss-200 hover:bg-moss-600/40 hover:border-moss-300",
  },
  {
    verb: "prune",
    label: "PRUNE",
    dx: 78,
    dy: -46,
    hint: "terminate branch",
    tone: "border-gold-600/70 text-gold-300 hover:bg-gold-800/40 hover:border-gold-400",
  },
  {
    verb: "rewrite",
    label: "REWRITE",
    dx: 0,
    dy: 84,
    hint: "edit the event",
    tone: "border-gold-700/60 text-gold-400 hover:bg-gold-900/60 hover:border-gold-500",
  },
];

/**
 * Floating DOM chrome for each event. These divs are positioned every frame by
 * Scene's Projector writing directly to style.transform, so this component only
 * re-renders when the node set or the selection changes.
 */
export default function NodeLabels({
  nodes,
  selectedId,
  busy,
  labelRefs,
  onVerb,
}: Props) {
  const register = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) labelRefs.current.set(id, el);
      else labelRefs.current.delete(id);
    },
    [labelRefs],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {nodes
        .filter((n) => n.status !== "pruned")
        .map((node) => {
          const selected = node.id === selectedId;
          return (
            <div
              key={node.id}
              ref={register(node.id)}
              className="absolute left-0 top-0 will-change-transform"
              style={{ opacity: 0 }}
            >
              <div className="-translate-x-1/2 -translate-y-1/2">
                {/* Event chip */}
                <div
                  className={`whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-mono text-[10px] leading-none backdrop-blur-[2px] transition-colors ${
                    selected
                      ? "border-gold-500/80 bg-void/90 text-gold-200 text-glow-gold"
                      : "border-moss-600/40 bg-void/70 text-moss-200"
                  }`}
                  style={{ transform: "translateY(-22px)" }}
                >
                  <span className="tabular-nums text-moss-400">{node.year}</span>
                  <span className="mx-1 text-moss-700">/</span>
                  <span>{node.title}</span>
                </div>

                {selected && (
                  <>
                    {/* Radial verb menu */}
                    {VERBS.map(({ verb, label, dx, dy, hint, tone }) => (
                      <button
                        key={verb}
                        type="button"
                        disabled={busy}
                        onClick={() => onVerb(verb, node.id)}
                        style={{
                          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`,
                        }}
                        className={`pointer-events-auto absolute left-0 top-0 flex w-[92px] flex-col items-center gap-0.5 rounded-sm border bg-void/95 px-2 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${tone}`}
                      >
                        <span className="font-bold">{label}</span>
                        <span className="text-[7.5px] normal-case tracking-normal text-moss-500">
                          {hint}
                        </span>
                      </button>
                    ))}

                    {/* Case-file card: the consequence this event caused */}
                    {node.consequence && (
                      <div
                        className="absolute left-0 top-0 w-[210px] -translate-x-1/2 rounded-sm border border-moss-700/60 bg-void/95 px-2.5 py-2"
                        style={{ transform: "translate(-50%, -118px)" }}
                      >
                        <div className="mb-1 font-mono text-[7.5px] uppercase tracking-[0.2em] text-gold-600">
                          Case file
                        </div>
                        <p className="font-mono text-[9.5px] leading-relaxed text-ash/80">
                          {node.consequence}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}

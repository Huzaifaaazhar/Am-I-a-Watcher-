"use client";

import { useCallback, type MutableRefObject } from "react";

import type { TimelineNode } from "@/lib/types";

interface Props {
  nodes: TimelineNode[];
  selectedId: string | null;
  labelRefs: MutableRefObject<Map<string, HTMLElement>>;
}

/**
 * Floating year/title chips for each event. These divs are positioned every
 * frame by Scene's Projector writing directly to style.transform, so this
 * component only re-renders when the node set or the selection changes.
 * Selecting and acting on a world both happen through the right drawer now -
 * this is read-only chrome.
 */
export default function NodeLabels({ nodes, selectedId, labelRefs }: Props) {
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
              <div
                className={`-translate-x-1/2 whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-mono text-[10px] leading-none backdrop-blur-[2px] transition-colors ${
                  selected
                    ? "border-weave-bright/80 bg-abyss/90 text-weave-bright"
                    : "border-weave/30 bg-abyss/70 text-ash/80"
                }`}
                style={{ transform: "translate(-50%, -22px)" }}
              >
                <span className="tabular-nums text-weave-bright/70">{node.year}</span>
                <span className="mx-1 text-weave/40">/</span>
                <span>{node.title}</span>
              </div>
            </div>
          );
        })}
    </div>
  );
}

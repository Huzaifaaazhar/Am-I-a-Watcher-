"use client";

import { useCallback, type MutableRefObject } from "react";

import type { TimelineNode } from "@/lib/types";

interface Props {
  nodes: TimelineNode[];
  selectedId: string | null;
  labelRefs: MutableRefObject<Map<string, HTMLElement>>;
  onSelect: (id: string) => void;
}

/**
 * Floating year/title chips for each event. These divs are positioned every
 * frame by Scene's Projector writing directly to style.transform, so this
 * component only re-renders when the node set or the selection changes.
 * The chip is also the click target for its event. The gold bead on the
 * branch projects to only a few pixels across, which is not something anyone
 * can reliably hit - least of all with a thumb - so the chip carries the hit
 * area and the bead stays a marker.
 */
export default function NodeLabels({ nodes, selectedId, labelRefs, onSelect }: Props) {
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
              {/*
                No transform of its own: Projector writes the chip's top-left
                corner directly, having already offset it to the clear side of
                its marker. A second transform here fought that and dragged
                every chip back over the branch it was meant to sit beside.
              */}
              <button
                type="button"
                onClick={() => onSelect(node.id)}
                className={`pointer-events-auto max-w-[46vw] cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-sm border-2 px-2 py-1 md:max-w-none font-sans text-[9px] font-bold uppercase leading-none tracking-[0.04em] md:text-[10px] backdrop-blur-[2px] transition-colors ${
                  selected
                    ? "border-brass bg-hud-black/90 text-brass"
                    : "border-brass/45 bg-hud-black/70 text-brass/80"
                }`}
              >
                <span className="tabular-nums text-brass/60">{node.year}</span>
                <span className="mx-1 text-brass/35">/</span>
                <span>{node.title}</span>
              </button>
            </div>
          );
        })}
    </div>
  );
}

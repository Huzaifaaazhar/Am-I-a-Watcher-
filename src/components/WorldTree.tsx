"use client";

import { useMemo } from "react";

import { useStage } from "@/lib/useStage";
import { ART, planTree, type NodePlan, type Pt } from "@/lib/treeMap";
import { PRIME_BRANCH_ID } from "@/lib/seed";
import type { Timeline } from "@/lib/types";
import { isFrozen } from "@/lib/debug";

/**
 * The Sacred Timeline canvas: the painting, with the live graph laid over it.
 *
 * The painting is the subject. At rest the overlay is nothing but a scatter
 * of small gold markers out on the boughs - no labels, no leader lines, no
 * drawn trunk. A name appears only for the marker under the pointer or the
 * one that is selected, and the bough it sits on lights with it, so the tree
 * answers questions instead of shouting the answers.
 *
 * Image, overlay and labels are all positioned from one box (`useStage`), so
 * they scale as a single object and cannot fall out of register.
 *
 * Interaction is per bough and per marker, never one rectangle over the whole
 * tree: each has its own wide transparent hit area, far wider than the
 * hairline or dot it selects, because a 3px marker is not a touch target.
 */

interface Props {
  timeline: Timeline;
  selectedId: string | null;
  hoveredId: string | null;
  /** Branch created most recently - its limb draws itself in. */
  freshBranchId: string | null;
  /** Events mid-prune: held on screen for one dissolve before they go. */
  pruningIds: Set<string>;
  onSelect: (nodeId: string) => void;
  onHover: (nodeId: string | null) => void;
  /**
   * Slices of the canvas something is docked over, in pixels. The bottom one
   * moves the painting clear; the right one only keeps the labels out.
   */
  insetRight?: number;
  insetBottom?: number;
}

/** Hit stroke width in art units - roughly a 40px target at desktop scale. */
const HIT_LIMB = 30;
/**
 * Radius of a marker's hit circle. Generous against the 3.8-unit dot, but no
 * wider than half the gap between two markers on the same bough - past that
 * the circles overlap and a neighbour becomes unreachable.
 */
const HIT_MARKER = 15;

/** How far a label is thrown clear of its marker, in art units. */
const LABEL_REACH = 22;
/** A label needs at least this many pixels on its side, or it flips. */
const LABEL_MIN_ROOM = 170;
/** Keep-out from the canvas edges, so a pill is never half off it. */
const LABEL_EDGE = 20;

const MOTES = 24;

/** Deterministic, so two screenshots of the same commit are the same pixels. */
function seeded(n: number): () => number {
  let s = n >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shortTitle(title: string): string {
  return title.length > 34 ? title.slice(0, 33).trimEnd() + "…" : title;
}

export default function WorldTree({
  timeline,
  selectedId,
  hoveredId,
  freshBranchId,
  pruningIds,
  onSelect,
  onHover,
  insetRight = 0,
  insetBottom = 0,
}: Props) {
  const [stageRef, box] = useStage<HTMLDivElement>({
    right: insetRight,
    bottom: insetBottom,
  });
  const plan = useMemo(() => planTree(timeline), [timeline]);

  const motes = useMemo(() => {
    const rng = seeded(97);
    return Array.from({ length: MOTES }, () => ({
      x: 180 + rng() * 660,
      y: 110 + rng() * 400,
      r: 1 + rng() * 2,
      dx: (rng() - 0.5) * 56,
      dy: -60 - rng() * 110,
      dur: 12 + rng() * 14,
      delay: -rng() * 22,
      peak: 0.2 + rng() * 0.26,
    }));
  }, []);

  const selected = selectedId ? plan.byNode.get(selectedId) : undefined;
  const hovered = hoveredId ? plan.byNode.get(hoveredId) : undefined;
  const activeBranch = selected?.branchId ?? null;

  /** A limb is dissolving when every event on it is in the doomed set. */
  const limbDying = (branchId: string) =>
    pruningIds.size > 0 &&
    plan.nodes
      .filter((n) => n.branchId === branchId)
      .every((n) => pruningIds.has(n.node.id));

  /** Which side a label actually lands on once the edges are accounted for. */
  const labelSide = (n: NodePlan): -1 | 1 => {
    const room = (side: -1 | 1) =>
      side === 1
        ? box.freeWidth - (box.left + (n.point.x + LABEL_REACH) * box.scale)
        : box.left + (n.point.x - LABEL_REACH) * box.scale;
    return room(n.side) >= LABEL_MIN_ROOM ? n.side : ((-n.side) as -1 | 1);
  };

  /** Art units -> pixels inside the stage. */
  const px = (p: Pt) => ({
    left: box.left + p.x * box.scale,
    top: box.top + p.y * box.scale,
  });

  // At rest, nothing is named. Only what the pointer is on and what has been
  // chosen - at most two, so they can never pile up on each other.
  const labelled: NodePlan[] = useMemo(() => {
    const picked = new Map<string, NodePlan>();
    if (selected) picked.set(selected.node.id, selected);
    if (hovered) picked.set(hovered.node.id, hovered);
    return [...picked.values()];
  }, [selected, hovered]);

  const boxStyle = {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
  };

  const lit = (nodeId: string) => nodeId === hoveredId || nodeId === selectedId;

  return (
    <div
      ref={stageRef}
      className="absolute inset-0 overflow-hidden bg-hud-black"
      onPointerLeave={() => onHover(null)}
    >
      {/*
        The painting, twice. The blurred plate underneath fills whatever the
        clamped fit leaves over, so a canvas that cannot take the whole 16:9
        ends in the artwork's own colour instead of a black band; the sharp
        copy sits on it exactly.

        `max-w-none` is not decoration: Tailwind's preflight sets
        `img { max-width: 100% }`, which silently overrode the computed width
        and slid the painting out of register with its own overlay.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/art/world-tree_1k.webp"
        alt=""
        aria-hidden
        draggable={false}
        style={{ opacity: box.ready ? 0.42 : 0 }}
        className="pointer-events-none absolute inset-0 h-full w-full max-w-none scale-110 select-none object-cover blur-2xl brightness-75 transition-opacity duration-700"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/art/world-tree_2k.webp"
        srcSet="/art/world-tree_1k.webp 736w, /art/world-tree_2k.webp 1472w"
        sizes="(max-width: 860px) 100vw, 1472px"
        alt="A luminous world tree, its canopy spread through a dark nebula"
        draggable={false}
        style={{ ...boxStyle, opacity: box.ready ? 1 : 0 }}
        className="pointer-events-none absolute max-w-none select-none transition-[opacity,left,top,width,height] duration-500"
      />

      <div className="vignette pointer-events-none absolute inset-0 opacity-80" />

      {box.ready && (
        <svg
          viewBox={`0 0 ${ART.w} ${ART.h}`}
          style={boxStyle}
          className="absolute overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id="bough-lit" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.1" />
              <stop offset="55%" stopColor="#E8C34A" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#F3E2A4" stopOpacity="0.5" />
            </linearGradient>

            <linearGradient id="limb-alive" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#9BE8C4" stopOpacity="0.45" />
            </linearGradient>

            <linearGradient id="limb-hot" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#E8C34A" />
              <stop offset="100%" stopColor="#F3E2A4" />
            </linearGradient>

            <filter id="bloom" x="-70%" y="-70%" width="240%" height="240%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="bloom-soft" x="-70%" y="-70%" width="240%" height="240%">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ------------------------------------------------------ boughs */}
          {/*
            Drawn only when they are the subject of attention. A Sacred
            Timeline bough is already painted into the artwork; tracing all
            eleven of them in gold would be drawing a second tree over a
            picture of a tree, which is the thing this canvas exists not to do.
          */}
          <g style={{ mixBlendMode: "screen" }}>
            {plan.boughs.map((bough) =>
              bough.nodeIds.some(lit) ? (
                <g key={bough.nodeIds[0]}>
                  <path
                    d={bough.d}
                    fill="none"
                    stroke="url(#bough-lit)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    filter="url(#bloom)"
                    opacity="0.4"
                  />
                  <path
                    d={bough.d}
                    fill="none"
                    stroke="url(#bough-lit)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    opacity="0.95"
                  />
                </g>
              ) : null,
            )}
          </g>

          {/* ------------------------------------------------------- limbs */}
          {/*
            Deviations are drawn always. They are not in the painting - they
            are what the custodian added to it, and the whole point of the
            screen is being able to see that a universe is now growing there.
          */}
          {plan.limbs.map((limb) => {
            const hot =
              limb.branchId === activeBranch || limb.branchId === freshBranchId;
            const dying = limbDying(limb.branchId);
            return (
              <g
                key={limb.branchId}
                style={{ mixBlendMode: "screen" }}
                className={dying ? "prune-dissolve" : undefined}
              >
                {hot && !dying && (
                  <path
                    d={limb.d}
                    fill="none"
                    stroke="url(#limb-hot)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    filter="url(#bloom)"
                    opacity="0.45"
                  />
                )}
                <path
                  d={limb.d}
                  fill="none"
                  stroke={dying ? "#B03A2E" : hot ? "url(#limb-hot)" : "url(#limb-alive)"}
                  strokeWidth={hot ? 2.8 : 1.9}
                  strokeLinecap="round"
                  filter="url(#bloom-soft)"
                  className={[
                    hot || isFrozen() ? "" : "limb-live",
                    limb.branchId === freshBranchId && !isFrozen() ? "limb-draw" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={
                    { opacity: hot ? 1 : 0.6, "--limb-len": 300 } as React.CSSProperties
                  }
                />
              </g>
            );
          })}

          {/* -------------------------------------------------------- motes */}
          <g style={{ mixBlendMode: "screen" }}>
            {motes.map((m, i) => (
              <circle
                key={i}
                cx={m.x}
                cy={m.y}
                r={m.r}
                fill="#BFE8CE"
                className={isFrozen() ? undefined : "mote"}
                style={
                  {
                    opacity: isFrozen() ? m.peak : 0,
                    "--mote-dx": `${m.dx}px`,
                    "--mote-dy": `${m.dy}px`,
                    "--mote-dur": `${m.dur}s`,
                    "--mote-delay": `${m.delay}s`,
                    "--mote-peak": m.peak,
                  } as React.CSSProperties
                }
              />
            ))}
          </g>

          {/* ------------------------------------------------------ markers */}
          <g>
            {plan.nodes.map((n) => {
              const isSelected = n.node.id === selectedId;
              const active = lit(n.node.id);
              const fading = n.node.status === "fading";
              const dying = pruningIds.has(n.node.id);
              const deviant = n.branchId !== PRIME_BRANCH_ID;
              return (
                <g
                  key={n.node.id}
                  opacity={fading ? 0.3 : 1}
                  className={dying ? "prune-dissolve" : undefined}
                >
                  {isSelected && (
                    <circle
                      cx={n.point.x}
                      cy={n.point.y}
                      r={6}
                      fill="none"
                      stroke="#E8C34A"
                      strokeWidth="1.1"
                      className="marker-ping"
                    />
                  )}
                  {active && (
                    <circle
                      cx={n.point.x}
                      cy={n.point.y}
                      r={7}
                      fill={deviant ? "#B03A2E" : "#E8C34A"}
                      opacity="0.4"
                      filter="url(#bloom)"
                    />
                  )}
                  <circle
                    cx={n.point.x}
                    cy={n.point.y}
                    r={active ? 4.6 : 3.1}
                    fill={
                      dying
                        ? "#B03A2E"
                        : active
                          ? "#F3E2A4"
                          : deviant
                            ? "#C46A5C"
                            : "#D9B243"
                    }
                    stroke="#06331F"
                    strokeWidth="0.9"
                    className="transition-all duration-200"
                    style={{ opacity: active ? 1 : 0.78 }}
                  />
                </g>
              );
            })}
          </g>

          {/* ---------------------------------------------------- hit areas */}
          {/*
            Drawn last so they sit above every painted path, and kept to the
            stroke only: `pointer-events: stroke` responds to the stroke area
            whatever its paint, which is what lets an invisible 30-unit band
            catch a tap aimed at a 2-unit limb. Only deviation limbs get one:
            a Sacred Timeline bough carries a run of events, so there is no
            single event a tap on the band could mean, and the markers
            themselves are the targets.
          */}
          <g>
            {plan.limbs.map((limb) => {
              const first = plan.nodes.find((n) => n.branchId === limb.branchId);
              if (!first) return null;
              return (
                <path
                  key={`hit-${limb.branchId}`}
                  d={limb.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={HIT_LIMB}
                  strokeLinecap="round"
                  pointerEvents="stroke"
                  className="cursor-pointer focus:outline-none"
                  onClick={() => onSelect(first.node.id)}
                  onPointerEnter={() => onHover(first.node.id)}
                />
              );
            })}

            {plan.nodes.map((n) => (
              <circle
                key={`hit-${n.node.id}`}
                cx={n.point.x}
                cy={n.point.y}
                r={HIT_MARKER}
                fill="transparent"
                pointerEvents="all"
                tabIndex={0}
                role="button"
                aria-label={`${n.node.year} ${n.node.title}`}
                className="cursor-pointer focus:outline-none"
                onClick={() => onSelect(n.node.id)}
                onPointerEnter={() => onHover(n.node.id)}
                onFocus={() => onHover(n.node.id)}
                onBlur={() => onHover(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(n.node.id);
                  }
                }}
              />
            ))}
          </g>
        </svg>
      )}

      {/* ------------------------------------------------------------ labels */}
      {box.ready &&
        labelled.map((n) => {
          // Thrown to whichever side has room: a marker near the right edge
          // with its label thrown right pushes it under the rail, or off the
          // canvas entirely.
          const side = labelSide(n);
          const room =
            side === 1
              ? box.freeWidth - (box.left + (n.point.x + LABEL_REACH) * box.scale)
              : box.left + (n.point.x - LABEL_REACH) * box.scale;
          const anchor = px({ x: n.point.x + side * LABEL_REACH, y: n.point.y });
          // A marker on the lowest bough sat its label half under the rail's
          // top border; the canvas is the frame, so the label stays inside it.
          const top = Math.min(
            Math.max(anchor.top, LABEL_EDGE),
            Math.max(LABEL_EDGE, box.stageHeight - LABEL_EDGE),
          );
          const isSelected = n.node.id === selectedId;
          return (
            <button
              key={n.node.id}
              type="button"
              onClick={() => onSelect(n.node.id)}
              style={{
                left: anchor.left,
                top,
                maxWidth: Math.max(110, room - 12),
                transform: `translate(${side === 1 ? "0" : "-100%"}, -50%)`,
              }}
              className={`label-in absolute z-10 flex items-center gap-2 overflow-hidden border px-2 py-[5px] font-sans text-[10px] font-bold uppercase leading-none tracking-[0.1em] backdrop-blur-[2px] md:text-[11px] ${
                isSelected
                  ? "border-brass bg-hud-black/85 text-brass"
                  : "border-brass/60 bg-hud-black/75 text-brass/90"
              }`}
            >
              <span className="shrink-0 tabular-nums">{n.node.year}</span>
              <span className="h-[9px] w-px shrink-0 bg-brass/40" />
              {/* `min-w-0`: without it the title's min-content width wins
                  over the pill's maxWidth, the label refuses to shrink, and
                  it runs off the edge of the canvas instead of truncating. */}
              <span className="min-w-0 truncate font-semibold tracking-[0.06em] text-ash/90">
                {shortTitle(n.node.title)}
              </span>
            </button>
          );
        })}
    </div>
  );
}

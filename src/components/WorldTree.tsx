"use client";

import { useMemo } from "react";

import { useStage } from "@/lib/useStage";
import {
  ART,
  planTree,
  spineSegments,
  SPINE_D,
  type NodePlan,
  type Pt,
} from "@/lib/treeMap";
import { PRIME_BRANCH_ID } from "@/lib/seed";
import type { Timeline } from "@/lib/types";
import { isFrozen } from "@/lib/debug";

/**
 * The Sacred Timeline canvas: the painting, with the live graph laid over it
 * in SVG.
 *
 * The painting is the subject - every path here is thin, mostly transparent
 * and sits *inside* the artwork's own light. Drawing a second opaque tree on
 * top is the failure mode this replaced; what the overlay adds is structure
 * you can point at, not a second drawing.
 *
 * Image, overlay and labels are all positioned from one box (`useStage`), so
 * they scale as a single object and cannot fall out of register.
 *
 * Interaction is per limb and per trunk segment, never one rectangle over the
 * whole tree: each has its own wide transparent hit stroke, far wider than
 * the hairline it selects, because a 2px branch is not a touch target.
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

/** Hit stroke width in art units. ~34 is a 40px target at desktop scale. */
const HIT_TRUNK = 46;
const HIT_LIMB = 34;

/** How far a label is thrown clear of its marker, in art units. */
const LABEL_REACH = 74;
/** A label needs at least this many pixels on its side, or it flips. */
const LABEL_MIN_ROOM = 150;

/**
 * Below this *stage* width only the selected and hovered events are named.
 * Keyed off the stage rather than the art: on a phone the art is wider than
 * the screen, so measuring the art declared a 390px canvas roomy and buried
 * the painting under nine labels.
 */
const DENSE_LABELS_FROM = 620;

const MOTES = 26;

/** Deterministic, so two screenshots of the same commit are the same pixels. */
function seeded(n: number): () => number {
  let s = n >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shortTitle(title: string): string {
  return title.length > 26 ? title.slice(0, 25).trimEnd() + "…" : title;
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

  const primeNodes = useMemo(
    () => plan.nodes.filter((n) => n.branchId === PRIME_BRANCH_ID),
    [plan],
  );

  const segments = useMemo(() => spineSegments(primeNodes.length), [primeNodes.length]);

  const motes = useMemo(() => {
    const rng = seeded(97);
    return Array.from({ length: MOTES }, () => ({
      x: 150 + rng() * 700,
      y: 120 + rng() * 420,
      r: 1 + rng() * 2.2,
      dx: (rng() - 0.5) * 60,
      dy: -60 - rng() * 120,
      dur: 11 + rng() * 13,
      delay: -rng() * 20,
      peak: 0.22 + rng() * 0.3,
    }));
  }, []);

  const selected = selectedId ? plan.byNode.get(selectedId) : undefined;
  const activeBranch = selected?.branchId ?? null;
  const hovered = hoveredId ? plan.byNode.get(hoveredId) : undefined;

  const dense = box.freeWidth >= DENSE_LABELS_FROM;

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

  const labelled: NodePlan[] = useMemo(() => {
    const picked = new Map<string, NodePlan>();
    if (dense) {
      for (const n of plan.nodes) {
        // Everything on the trunk, plus everything on whichever limb is in
        // play. Naming every event on every limb at once buries the painting.
        if (n.branchId === PRIME_BRANCH_ID || n.branchId === activeBranch) {
          picked.set(n.node.id, n);
        }
      }
    }
    if (selected) picked.set(selected.node.id, selected);
    if (hovered) picked.set(hovered.node.id, hovered);
    return [...picked.values()];
  }, [dense, plan.nodes, activeBranch, selected, hovered]);

  const boxStyle = {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
  };

  return (
    <div
      ref={stageRef}
      className="absolute inset-0 overflow-hidden bg-hud-black"
      onPointerLeave={() => onHover(null)}
    >
      {/*
        The painting, twice. The blurred plate underneath fills whatever the
        clamped fit leaves over, so a portrait canvas ends in the artwork's own
        colour instead of in a black band; the sharp copy sits on it exactly.

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
        style={{ opacity: box.ready ? 0.55 : 0 }}
        className="pointer-events-none absolute inset-0 h-full w-full max-w-none scale-110 select-none object-cover blur-2xl transition-opacity duration-700"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/art/world-tree_2k.webp"
        srcSet="/art/world-tree_1k.webp 736w, /art/world-tree_2k.webp 1472w"
        sizes="(max-width: 860px) 100vw, 1472px"
        alt="A luminous world tree, its canopy spread through a dark nebula"
        draggable={false}
        style={{ ...boxStyle, opacity: box.ready ? 1 : 0 }}
        className="pointer-events-none absolute max-w-none select-none transition-opacity duration-700"
      />

      {/* Ambient lift under the canopy, so the canvas edge is not a hard seam. */}
      <div className="moss-wash pointer-events-none absolute inset-0" />
      <div className="vignette pointer-events-none absolute inset-0" />

      {box.ready && (
        <svg
          viewBox={`0 0 ${ART.w} ${ART.h}`}
          style={boxStyle}
          className="absolute overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id="sap" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0" />
              <stop offset="45%" stopColor="#7CF2C0" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#E8C34A" stopOpacity="0.9" />
            </linearGradient>

            <linearGradient id="limb-alive" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#9BE8C4" stopOpacity="0.4" />
            </linearGradient>

            <linearGradient id="limb-hot" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#E8C34A" />
              <stop offset="100%" stopColor="#F3E2A4" />
            </linearGradient>

            <filter id="bloom" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="bloom-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ------------------------------------------------- trunk energy */}
          <g style={{ mixBlendMode: "screen" }}>
            <path
              d={SPINE_D}
              fill="none"
              stroke="url(#sap)"
              strokeWidth="5"
              strokeLinecap="round"
              filter="url(#bloom)"
              className={isFrozen() ? undefined : "sap"}
              opacity="0.5"
            />
            <path
              d={SPINE_D}
              fill="none"
              stroke="url(#sap)"
              strokeWidth="2.6"
              strokeLinecap="round"
              className={isFrozen() ? undefined : "sap sap-2"}
              opacity="0.45"
            />
            <path
              d={SPINE_D}
              fill="none"
              stroke="#CFF7E4"
              strokeWidth="1.1"
              strokeLinecap="round"
              className={isFrozen() ? undefined : "sap sap-3"}
              opacity="0.4"
            />
          </g>

          {/* -------------------------------------------------------- limbs */}
          {plan.limbs.map((limb) => {
            // A branch is lit while it is selected, and also for as long as
            // the deviation it caused is being announced - it is the thing
            // the three panels are talking about.
            const hot =
              limb.branchId === activeBranch || limb.branchId === freshBranchId;
            const dying = limbDying(limb.branchId);
            return (
              <g
                key={limb.branchId}
                style={{ mixBlendMode: "screen" }}
                className={dying ? "prune-dissolve" : undefined}
              >
                {hot && (
                  <path
                    d={limb.d}
                    fill="none"
                    stroke="url(#limb-hot)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    filter="url(#bloom)"
                    opacity="0.5"
                  />
                )}
                <path
                  d={limb.d}
                  fill="none"
                  stroke={dying ? "#B03A2E" : hot ? "url(#limb-hot)" : "url(#limb-alive)"}
                  strokeWidth={hot ? 3 : 2.1}
                  strokeLinecap="round"
                  filter="url(#bloom-soft)"
                  className={[
                    hot || isFrozen() ? "" : "limb-live",
                    limb.branchId === freshBranchId && !isFrozen() ? "limb-draw" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={
                    { opacity: hot ? 1 : 0.55, "--limb-len": 420 } as React.CSSProperties
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

          {/* ------------------------------------------ label leader lines */}
          <g>
            {labelled.map((n) => (
              <line
                key={n.node.id}
                x1={n.point.x + labelSide(n) * 7}
                y1={n.point.y}
                x2={n.point.x + labelSide(n) * (LABEL_REACH - 4)}
                y2={n.point.y}
                stroke="#E8C34A"
                strokeWidth="0.9"
                opacity={n.node.id === selectedId ? 0.8 : 0.4}
              />
            ))}
          </g>

          {/* ------------------------------------------------------ markers */}
          <g>
            {plan.nodes.map((n) => {
              const isSelected = n.node.id === selectedId;
              const isHovered = n.node.id === hoveredId;
              const fading = n.node.status === "fading";
              const dying = pruningIds.has(n.node.id);
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
                      r={7}
                      fill="none"
                      stroke="#E8C34A"
                      strokeWidth="1.2"
                      className="marker-ping"
                    />
                  )}
                  <circle
                    cx={n.point.x}
                    cy={n.point.y}
                    r={isSelected ? 5.6 : isHovered ? 5 : 3.6}
                    fill={dying ? "#B03A2E" : isSelected || isHovered ? "#E8C34A" : "#C9A63B"}
                    stroke="#06331F"
                    strokeWidth="1"
                    filter={isSelected ? "url(#bloom-soft)" : undefined}
                    className="transition-all duration-200"
                  />
                </g>
              );
            })}
          </g>

          {/* --------------------------------------------------- hit areas */}
          {/*
           * Drawn last so they sit above every painted path, and kept to the
           * stroke only: `pointer-events: stroke` responds to the stroke area
           * whatever its paint, which is what lets an invisible 34-unit band
           * catch a tap aimed at a 2-unit branch.
           */}
          <g>
            {segments.map((seg) => {
              const target = primeNodes[seg.index];
              if (!target) return null;
              return (
                <path
                  key={`seg-${seg.index}`}
                  d={seg.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={HIT_TRUNK}
                  strokeLinecap="round"
                  pointerEvents="stroke"
                  className="cursor-pointer focus:outline-none"
                  tabIndex={0}
                  role="button"
                  aria-label={`${target.node.year} ${target.node.title}`}
                  onClick={() => onSelect(target.node.id)}
                  onPointerEnter={() => onHover(target.node.id)}
                  onFocus={() => onHover(target.node.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(target.node.id);
                    }
                  }}
                />
              );
            })}

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
                  tabIndex={0}
                  role="button"
                  aria-label={`Branch ${first.node.title}`}
                  onClick={() => onSelect(first.node.id)}
                  onPointerEnter={() => onHover(first.node.id)}
                  onFocus={() => onHover(first.node.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(first.node.id);
                    }
                  }}
                />
              );
            })}
          </g>
        </svg>
      )}

      {/* ------------------------------------------------------------ labels */}
      {box.ready &&
        labelled.map((n) => {
          // Thrown to whichever side has room: a marker near the right edge
          // with its label thrown right pushes it under the rail, or off the
          // canvas entirely, which is what the first pass did.
          const side = labelSide(n);
          const room =
            side === 1
              ? box.freeWidth - (box.left + (n.point.x + LABEL_REACH) * box.scale)
              : box.left + (n.point.x - LABEL_REACH) * box.scale;
          const anchor = px({ x: n.point.x + side * LABEL_REACH, y: n.point.y });
          const isSelected = n.node.id === selectedId;
          return (
            <button
              key={n.node.id}
              type="button"
              onClick={() => onSelect(n.node.id)}
              onPointerEnter={() => onHover(n.node.id)}
              style={{
                left: anchor.left,
                top: anchor.top,
                maxWidth: Math.max(96, room - 10),
                transform: `translate(${side === 1 ? "0" : "-100%"}, -50%)`,
              }}
              className={`absolute z-10 flex items-center gap-2 overflow-hidden border px-2 py-[5px] font-sans text-[10px] font-bold uppercase leading-none tracking-[0.1em] backdrop-blur-[2px] transition-colors md:text-[11px] ${
                isSelected
                  ? "border-brass bg-hud-black/85 text-brass shadow-glow"
                  : "border-brass/55 bg-hud-black/60 text-brass/85 hover:border-brass hover:text-brass"
              }`}
            >
              <span
                className={`h-[7px] w-[7px] shrink-0 rounded-full ${
                  n.branchId === PRIME_BRANCH_ID ? "bg-brass" : "bg-pill-red"
                }`}
              />
              <span className="shrink-0 tabular-nums">{n.node.year}</span>
              <span className="h-[9px] w-px shrink-0 bg-brass/40" />
              <span className="truncate font-semibold tracking-[0.06em] text-ash/90">
                {shortTitle(n.node.title)}
              </span>
            </button>
          );
        })}
    </div>
  );
}
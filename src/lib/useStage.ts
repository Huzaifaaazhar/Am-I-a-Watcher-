"use client";

import { useEffect, useRef, useState } from "react";

import { ART } from "./treeMap";

export interface StageBox {
  /** Pixel offset of the art's top-left corner inside the stage element. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Pixels per art unit. */
  scale: number;
  /** The container. */
  stageWidth: number;
  stageHeight: number;
  /** The part of the container nothing is docked over. */
  freeWidth: number;
  freeHeight: number;
  ready: boolean;
}

/**
 * The part of the painting that must never be cropped: the trunk, every limb
 * a branch can reach, and the crown. Cover-fitting a 16:9 painting into a
 * portrait canvas would otherwise throw the outermost limbs off screen, and
 * those limbs are the interface.
 */
const SAFE = { w: 560, h: 470 };

/** Horizontal and vertical centre of interest, in art units. */
const FOCUS = { x: 500, y: 296 };

const EMPTY: StageBox = {
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  scale: 0,
  stageWidth: 0,
  stageHeight: 0,
  freeWidth: 0,
  freeHeight: 0,
  ready: false,
};

/**
 * Fits the painting to its container and returns the box to give the image,
 * the SVG overlay and the label layer alike.
 *
 * Handing all three the same box is the whole trick: the overlay cannot drift
 * out of register with the artwork because there is one number, and it is the
 * same number. The alternative - CSS `object-fit: cover` on the image and a
 * guess in the SVG - is what produces two misaligned trees.
 *
 * `inset` is the slice of the container something else is docked over, and
 * the two sides are treated differently on purpose.
 *
 * `bottom` is the event sheet on a phone: opaque, full width, and it would
 * bury the tree, so the painting is fitted and centred in what is left of the
 * container. `right` is the deviation triptych, which is two narrow cards
 * floating on the canvas with artwork visible all around them; shrinking the
 * fit for those left the painting a small rectangle beside a wide empty band,
 * which was worse than the overlap it was avoiding. So `right` does not move
 * the painting at all - it only tells the labels where to stop.
 *
 * The fit is cover, clamped so the safe rectangle above always survives. When
 * the clamp bites, the art is letterboxed instead; the painting's own border
 * is near-black and a blurred plate fills the rest, so the seam is invisible.
 */
export function useStage<T extends HTMLElement>(
  inset: { right?: number; bottom?: number } = {},
): [React.RefObject<T>, StageBox] {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<StageBox>(EMPTY);
  const right = inset.right ?? 0;
  const bottom = inset.bottom ?? 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw === 0 || ch === 0) return;

      const fitW = cw;
      const freeH = Math.max(160, ch - bottom);

      const cover = Math.max(fitW / ART.w, freeH / ART.h);
      const scale = Math.min(cover, fitW / SAFE.w, freeH / SAFE.h);

      const width = ART.w * scale;
      const height = ART.h * scale;

      // Centre on the focal point within the free area, then pull back so no
      // edge of the painting is left inside it when there is art to fill it.
      // When the art is letterboxed it sits a little above centre: panels and
      // sheets come up from the bottom, so the free space is worth more there.
      const clamp = (want: number, art: number, free: number, bias = 0.5) =>
        art <= free ? (free - art) * bias : Math.min(0, Math.max(free - art, want));

      setBox({
        left: clamp(fitW / 2 - right / 2 - FOCUS.x * scale, width, fitW),
        top: clamp(freeH / 2 - FOCUS.y * scale, height, freeH, 0.42),
        width,
        height,
        scale,
        stageWidth: cw,
        stageHeight: ch,
        freeWidth: Math.max(160, cw - right),
        freeHeight: freeH,
        ready: true,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [right, bottom]);

  return [ref, box];
}

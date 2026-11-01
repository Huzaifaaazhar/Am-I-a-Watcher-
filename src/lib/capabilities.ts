/**
 * What this person has asked for.
 *
 * This used to answer three questions - can the machine do WebGL, has the
 * person asked for reduced motion, and is the hardware likely to struggle -
 * because the canvas was a 3D scene. The canvas is now a painting with an SVG
 * over it: there is no GPU gate and no quality tier to pick, so only the
 * stated preference is left, and it is honoured by CSS rather than by
 * swapping the interface for a different one.
 */

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

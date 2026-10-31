/**
 * Debug and freeze flags, read from the query string.
 *
 * The screenshot harness needs the scene to render *identically* on every
 * frame, or two runs of `npm run shots` produce two different images and
 * comparing them tells you nothing. `?freeze=<seconds>` pins the animation
 * clock to a fixed time and forces every growth animation to completion, so
 * a given URL always yields the same pixels.
 *
 * `?debug=1` turns on the perf overlay without freezing anything.
 */

/** Query key for the frozen timestamp, in seconds. */
const FREEZE = "freeze";
const DEBUG = "debug";
/** Forces the non-3D path, so the harness can photograph it on any machine. */
const FLAT = "flat";

function params(): URLSearchParams | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search);
}

/** True when the perf overlay should be shown. */
export function isDebug(): boolean {
  const p = params();
  if (!p) return false;
  return p.get(DEBUG) === "1" || p.has(FREEZE);
}

/**
 * The time, in seconds, to pin the animation clock to - or null to run live.
 *
 * `?freeze=1` is read as "freeze at t=1s" rather than as a boolean, so a shot
 * can be taken at a named moment in an animation.
 */
export function freezeAt(): number | null {
  const p = params();
  if (!p || !p.has(FREEZE)) return null;
  const raw = Number(p.get(FREEZE));
  return Number.isFinite(raw) && raw >= 0 ? raw : 1;
}

/** True when animation is pinned; read by growth clocks to skip to the end. */
export function isFrozen(): boolean {
  return freezeAt() !== null;
}

/**
 * True when `?flat=1` asks for the non-WebGL view.
 *
 * Without this the fallback is only reachable on a machine that genuinely
 * cannot do WebGL, which means in practice it would never be looked at again
 * after the day it was written.
 */
export function forceFlat(): boolean {
  const p = params();
  return p?.get(FLAT) === "1";
}

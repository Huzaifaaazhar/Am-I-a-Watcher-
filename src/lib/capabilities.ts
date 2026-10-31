/**
 * What this device and this person can actually be shown.
 *
 * Three separate questions, deliberately not collapsed into one:
 *
 *   - *Can* it render WebGL at all?
 *   - Has the person asked for reduced motion?
 *   - Is the hardware likely to make a mess of it?
 *
 * The first two are hard gates: no WebGL means no canvas, and reduced motion
 * is a stated preference, not a hint. The third only picks a quality tier -
 * a weak GPU gets a smaller scene, not a worse product.
 */

export type RenderMode = "3d" | "flat";
export type QualityTier = "high" | "low";
/** What the person chose. "auto" defers to the probe. */
export type QualitySetting = "auto" | "high" | "low";

/** Cached: creating a probe context is not free and the answer cannot change. */
let webglSupport: boolean | null = null;

export function supportsWebGL(): boolean {
  if (typeof window === "undefined") return false;
  if (webglSupport !== null) return webglSupport;

  try {
    const canvas = document.createElement("canvas");
    const context =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    webglSupport = Boolean(context);

    // Probe contexts count against the browser's limit, so hand it back.
    if (context && "getExtension" in context) {
      const lose = (context as WebGLRenderingContext).getExtension("WEBGL_lose_context");
      lose?.loseContext();
    }
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * A guess at whether this machine will struggle, from what the browser will
 * admit to. Deliberately crude - it only picks a starting tier, and
 * PerformanceMonitor corrects it from measured frame rate within seconds.
 */
export function looksLowEnd(): boolean {
  if (typeof window === "undefined") return true;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  return cores <= 4 || memory <= 4;
}

/**
 * Whether to render the scene at all.
 *
 * Reduced motion falls back rather than merely stilling the camera: the tree
 * is a continuously animated object, and a still frame of it is a photograph,
 * which is exactly what the flat mode shows.
 */
export function renderMode(forced = false): RenderMode {
  if (typeof window === "undefined") return "flat";
  if (forced) return "flat";
  if (!supportsWebGL()) return "flat";
  if (prefersReducedMotion()) return "flat";
  return "3d";
}

export function initialTier(setting: QualitySetting): QualityTier {
  if (setting !== "auto") return setting;
  return looksLowEnd() ? "low" : "high";
}

/** Per-tier scene budget. Mobile limits are the binding ones. */
export const TIER = {
  high: {
    /** Leaf cards per branch tip. */
    leavesPerTip: 7,
    dpr: [1, 2] as [number, number],
    shadowMap: 1024,
    contactShadowRes: 512,
    /** Grain and bloom are the first things to go when frames are scarce. */
    post: true,
  },
  low: {
    // The canopy is almost the whole triangle count, so this is the lever
    // that brings a phone under the 120k budget.
    leavesPerTip: 3,
    dpr: [1, 1.5] as [number, number],
    shadowMap: 512,
    contactShadowRes: 256,
    post: false,
  },
} satisfies Record<QualityTier, unknown>;

import gsap from "gsap";
import * as THREE from "three";

/**
 * Named camera shots.
 *
 * Scripted moves are authored here rather than scattered as ad-hoc lerps, so
 * every transition in the app has a name, a duration and an easing curve
 * somebody chose. Hard cuts are not available on purpose: a cut between two
 * views of the same object reads as a glitch, because the viewer has no way
 * to tell the object did not move.
 *
 * Shots drive the rig's *current* state directly, not its desired state. The
 * rig damps its way toward a target every frame, and running a tween into
 * that damping compounds two smoothings into something sluggish and
 * unpredictable - the easing stops being the easing you wrote.
 */

/** The rig's orbit state. Angles in radians, radius in world units. */
export interface OrbitState {
  theta: number;
  phi: number;
  radius: number;
}

export interface ShotContext {
  /** Framing distance for the tree at the current viewport. */
  distance: number;
  /** Height of the tree's centre. */
  centerY: number;
  /** Where the shot should look. Defaults to the tree's centre. */
  focus?: THREE.Vector3 | null;
}

export interface Shot {
  /** Seconds. */
  duration: number;
  ease: string;
  /** Resolves the orbit the shot settles on. */
  to: (context: ShotContext, from: OrbitState) => Partial<OrbitState>;
  /** Where the camera looks when the shot ends. */
  lookAt?: (context: ShotContext) => THREE.Vector3;
}

const centre = (context: ShotContext) => new THREE.Vector3(0, context.centerY, 0);

export const SHOTS = {
  /**
   * First sight of the tree. Arrives from further out and slightly lower, so
   * the crown rises into frame rather than simply being there.
   */
  establishing: {
    duration: 2.6,
    // Decelerating almost to a stop: the move should feel like it is being
    // placed, not like it ran out of road.
    ease: "power3.out",
    to: ({ distance }) => ({ theta: 0.7, phi: 1.05, radius: distance }),
    lookAt: centre,
  },

  /** The idle drift, used as a shot when returning from somewhere else. */
  "hero-orbit": {
    duration: 1.8,
    ease: "power2.inOut",
    to: ({ distance }, from) => ({ theta: from.theta + 0.5, phi: 1.02, radius: distance }),
    lookAt: centre,
  },

  /**
   * Selecting an event. Pushes in and settles with a touch of overshoot, so
   * the move has weight rather than sliding to a mathematical halt.
   */
  "reveal-push-in": {
    duration: 1.15,
    ease: "back.out(1.1)",
    to: ({ distance }) => ({ radius: Math.max(distance * 0.82, 14) }),
    lookAt: (context) => context.focus?.clone() ?? centre(context),
  },

  /** A new limb has arrived: ease back enough to take it in. */
  "branch-grow": {
    duration: 1.4,
    ease: "power2.out",
    to: ({ distance }) => ({ radius: distance * 1.04 }),
    lookAt: centre,
  },

  /**
   * A timeline is being cut. Holds position and tips fractionally - the
   * camera flinching rather than the scene shaking, which would read as an
   * effect applied to the image instead of something happening in the world.
   */
  "prune-dissolve": {
    duration: 0.9,
    ease: "power4.out",
    to: (_context, from) => ({ phi: from.phi - 0.05, radius: from.radius * 0.97 }),
  },

  /** Everything collapses. Pull well back and let it happen at a distance. */
  "reset-implode": {
    duration: 2.2,
    ease: "power2.inOut",
    to: ({ distance }) => ({ radius: distance * 1.5, phi: 0.95 }),
    lookAt: centre,
  },
} satisfies Record<string, Shot>;

export type ShotName = keyof typeof SHOTS;

export interface PlayOptions {
  /** Live orbit state; mutated in place by the tween. */
  orbit: OrbitState;
  /** Live look-at point; mutated in place by the tween. */
  target: THREE.Vector3;
  context: ShotContext;
  /** Called once the shot settles, so manual control can resume cleanly. */
  onComplete?: () => void;
  /** Honours the reduced-motion preference by jumping to the end state. */
  immediate?: boolean;
}

/**
 * Plays a shot, returning the timeline so a caller can kill it.
 *
 * Every tween is registered on one timeline rather than fired separately, so
 * a new shot can interrupt a running one cleanly instead of two sets of
 * tweens fighting over the same numbers.
 */
export function playShot(name: ShotName, options: PlayOptions): gsap.core.Timeline {
  const shot = SHOTS[name] as Shot;
  const { orbit, target, context, onComplete, immediate } = options;

  const destination = shot.to(context, { ...orbit });
  const lookAt = shot.lookAt?.(context);
  const duration = immediate ? 0 : shot.duration;

  const timeline = gsap.timeline({ onComplete });

  timeline.to(
    orbit,
    {
      ...destination,
      duration,
      ease: shot.ease,
      overwrite: "auto",
    },
    0,
  );

  if (lookAt) {
    timeline.to(
      target,
      {
        x: lookAt.x,
        y: lookAt.y,
        z: lookAt.z,
        duration,
        ease: shot.ease,
        overwrite: "auto",
      },
      0,
    );
  }

  return timeline;
}

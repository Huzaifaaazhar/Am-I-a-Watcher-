"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  /** World point to frame. Null means fall back to the tree's own centre. */
  focus: THREE.Vector3 | null;
  /** Slow idle drift so the tree feels alive between actions. */
  idle: boolean;
  /** Framing computed from the tree's bounds - see fitToTree in Scene. */
  fit: { centerY: number; distance: number };
}

const MIN_RADIUS = 8;
const MAX_RADIUS = 90;
const MIN_PHI = 0.25;
const MAX_PHI = Math.PI - 0.25;
const IDLE_SPEED = 0.045;

/**
 * Lightweight orbit rig written by hand - the brief rules out addon
 * OrbitControls, and this only needs drag-to-rotate, wheel-to-zoom and a
 * smooth zoom-to-node. Everything is damped so recorded footage never snaps.
 */
export default function CameraRig({ focus, idle, fit }: Props) {
  const { camera, gl } = useThree();

  // Desired state, lerped toward every frame.
  const want = useRef({ theta: 0.7, phi: 1.05, radius: fit.distance });
  // Starts further out and eases in, so the tree "arrives" on camera.
  const has = useRef({ theta: 0.7, phi: 1.05, radius: fit.distance * 1.5 });
  const target = useRef(new THREE.Vector3(0, fit.centerY, 0));
  const wantTarget = useRef(new THREE.Vector3(0, fit.centerY, 0));
  const dragging = useRef(false);
  const interactedAt = useRef(0);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = gl.domElement;

    const down = (e: PointerEvent) => {
      dragging.current = true;
      interactedAt.current = performance.now();
      last.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };

    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      want.current.theta -= dx * 0.005;
      want.current.phi = THREE.MathUtils.clamp(
        want.current.phi - dy * 0.005,
        MIN_PHI,
        MAX_PHI,
      );
      interactedAt.current = performance.now();
    };

    const up = (e: PointerEvent) => {
      dragging.current = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      want.current.radius = THREE.MathUtils.clamp(
        want.current.radius * (1 + Math.sign(e.deltaY) * 0.09),
        MIN_RADIUS,
        MAX_RADIUS,
      );
      interactedAt.current = performance.now();
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl]);

  // Zoom-to-node: reframe on the selected marker and pull in close.
  useEffect(() => {
    if (focus) {
      wantTarget.current.copy(focus);
      // Move in on the node but keep the surrounding tree in frame - filling
      // the screen with one marker loses the context that makes the cascade read.
      want.current.radius = THREE.MathUtils.clamp(
        fit.distance * 0.72,
        18,
        fit.distance,
      );
      interactedAt.current = performance.now();
    } else {
      wantTarget.current.set(0, fit.centerY, 0);
      want.current.radius = fit.distance;
    }
  }, [focus, fit]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    // Resume the idle orbit only once the custodian has stopped fiddling.
    const quiet = performance.now() - interactedAt.current > 2600;
    if (idle && quiet && !dragging.current) {
      want.current.theta += IDLE_SPEED * dt;

      // New limbs can reach outside the frame. Pull back to hold them, but
      // only while idle and only outward - never fight a deliberate zoom in.
      if (!focus && fit.distance > want.current.radius * 1.05) {
        want.current.radius = THREE.MathUtils.lerp(
          want.current.radius,
          fit.distance,
          1 - Math.pow(0.2, dt),
        );
        wantTarget.current.set(0, fit.centerY, 0);
      }
    }

    const k = 1 - Math.pow(0.0015, dt);
    has.current.theta += (want.current.theta - has.current.theta) * k;
    has.current.phi += (want.current.phi - has.current.phi) * k;
    has.current.radius += (want.current.radius - has.current.radius) * k;
    target.current.lerp(wantTarget.current, k);

    const { theta, phi, radius } = has.current;
    const sinPhi = Math.sin(phi);
    camera.position.set(
      target.current.x + radius * sinPhi * Math.sin(theta),
      target.current.y + radius * Math.cos(phi),
      target.current.z + radius * sinPhi * Math.cos(theta),
    );
    camera.lookAt(target.current);
  });

  return null;
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { isFrozen } from "@/lib/debug";

/**
 * Pollen and dust hanging in the air around the tree.
 *
 * Checklist item 7 asks for depth cues, and this is the cheapest honest one:
 * specks at varying distances give the eye parallax as the camera orbits, so
 * the space between the viewer and the trunk stops reading as empty. Without
 * them a scene with one subject in a void has nothing to measure depth
 * against.
 *
 * They are also the only thing in the frame that moves of its own accord when
 * nothing is happening, which keeps a still shot from looking like a
 * screenshot.
 *
 * One additive point cloud, no depth write, so they never occlude the tree.
 */

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uDrift;
  attribute float aSeed;
  attribute float aSize;
  varying float vAlpha;

  void main() {
    // Each mote rises slowly and wanders, on its own phase. Specks that share
    // a phase read as a sheet of rain rather than as drifting dust.
    float t = uTime * 0.04 + aSeed * 31.4;
    vec3 drift = vec3(
      sin(t * 1.3) * 1.6,
      // Rising, and wrapped so the column never empties.
      mod(uTime * 0.35 * (0.4 + aSeed) + aSeed * 40.0, 44.0) - 4.0,
      cos(t * 0.9 + aSeed) * 1.6
    ) * uDrift;

    vec4 mv = modelViewMatrix * vec4(position + vec3(drift.x, drift.y, drift.z), 1.0);
    gl_Position = projectionMatrix * mv;

    // Fade with distance so the far ones sit back rather than crowding the
    // frame, and twinkle very slightly as they turn.
    float near = smoothstep(130.0, 18.0, -mv.z);
    vAlpha = near * (0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * 1.6 + aSeed * 12.0)));
    gl_PointSize = aSize * (170.0 / max(-mv.z, 1.0));
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    float falloff = pow(1.0 - smoothstep(0.0, 0.25, d), 1.6);
    // Deliberately under the bloom threshold. Brighter than this and every
    // speck picks up a halo, turning fine dust into a field of bokeh balls
    // that competes with the tree instead of sitting behind it.
    gl_FragColor = vec4(uColor, falloff * vAlpha * 0.26);
  }
`;

const COUNT = 220;

export default function Motes({
  centerY,
  radius,
}: {
  centerY: number;
  radius: number;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const position = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    const size = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      // Scattered through a cylinder around the tree rather than a sphere:
      // the interesting volume is the air beside the trunk, not above it.
      const angle = Math.random() * Math.PI * 2;
      const r = radius * (0.25 + Math.random() * 1.05);
      position[i * 3] = Math.cos(angle) * r;
      position[i * 3 + 1] = centerY + (Math.random() - 0.5) * radius * 1.6;
      position[i * 3 + 2] = Math.sin(angle) * r;
      seed[i] = Math.random();
      size[i] = 1.1 + Math.random() * 2.2;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    return g;
  }, [centerY, radius]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDrift: { value: 1 },
      uColor: { value: new THREE.Color("#b9d3ad") },
    }),
    [],
  );

  useFrame((state) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = isFrozen() ? 6 : state.clock.elapsedTime;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

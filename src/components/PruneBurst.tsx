"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { PointCloud } from "@/lib/vfx";

/** Seconds the dissolve takes end to end. Slow enough to feel weighty on camera. */
export const PRUNE_DURATION = 1.6;

const VERTEX = /* glsl */ `
  uniform float uProgress;
  uniform float uSize;

  attribute vec3 aDir;
  attribute float aSeed;

  varying float vAlpha;
  varying float vSeed;

  // Cheap value noise - enough to curl the dispersal so it never looks radial.
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  void main() {
    // Each point starts at a slightly different moment so the branch
    // disintegrates in a wave rather than all at once.
    float stagger = aSeed * 0.28;
    float p = clamp((uProgress - stagger) / (1.0 - stagger), 0.0, 1.0);
    float ease = 1.0 - pow(1.0 - p, 2.4);

    // Noise-driven swirl layered over the per-point dispersal vector.
    float n = hash(floor(position * 3.0));
    vec3 swirl = vec3(
      sin(n * 24.0 + uProgress * 3.2),
      cos(n * 17.0 + uProgress * 2.1),
      sin(n * 31.0 + uProgress * 2.7)
    );

    vec3 drift = aDir * ease * (1.9 + aSeed * 3.2) + swirl * ease * 0.9;
    drift.y += ease * ease * 1.7 * (0.35 + aSeed);

    vec4 mv = modelViewMatrix * vec4(position + drift, 1.0);
    gl_Position = projectionMatrix * mv;

    // Embers shrink as they cool.
    gl_PointSize = uSize * (1.0 - ease * 0.72) * (320.0 / max(-mv.z, 0.001));

    vAlpha = (1.0 - smoothstep(0.35, 1.0, p)) * (0.18 + aSeed * 0.34);
    vSeed = aSeed;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uHot;
  uniform vec3 uCool;

  varying float vAlpha;
  varying float vSeed;

  void main() {
    // Round the square point sprite into a soft ember.
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;

    float glow = 1.0 - smoothstep(0.0, 0.25, d);
    vec3 col = mix(uCool, uHot, pow(vSeed, 0.6));
    gl_FragColor = vec4(col, glow * vAlpha);
  }
`;

interface Props {
  cloud: PointCloud;
  /** Fires once the dissolve has fully faded, so the parent can drop the burst. */
  onDone: () => void;
}

/**
 * The signature effect: a pruned branch's geometry becomes a GLSL point system
 * that disperses along noise-driven vectors, shifting to glowing gold embers
 * and fading to nothing over PRUNE_DURATION.
 */
export default function PruneBurst({ cloud, onDone }: Props) {
  const elapsed = useRef(0);
  const finished = useRef(false);
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uSize: { value: 4.2 },
      uHot: { value: new THREE.Color("#f0cf68") },
      uCool: { value: new THREE.Color("#8a4f0d") },
    }),
    [],
  );

  useFrame((_, delta) => {
    if (finished.current) return;
    elapsed.current += delta;
    const p = Math.min(1, elapsed.current / PRUNE_DURATION);
    if (material.current) material.current.uniforms.uProgress.value = p;
    if (p >= 1) {
      finished.current = true;
      onDone();
    }
  });

  if (cloud.count === 0) return null;

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={cloud.position}
          count={cloud.count}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aDir"
          array={cloud.dir}
          count={cloud.count}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSeed"
          array={cloud.seed}
          count={cloud.count}
          itemSize={1}
        />
      </bufferGeometry>
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

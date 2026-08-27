"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { LayoutPoint } from "@/lib/types";

/**
 * A branch, rendered as a living tendril.
 *
 * The whole branch is one continuous tube through every world on it, rather
 * than a segment per edge - that is what makes it read as a single limb
 * reaching out of the spine instead of a string of pipes. It writhes in the
 * vertex shader: the base is anchored and the sway amplitude grows toward the
 * tip, so the motion looks like it originates from the trunk.
 */

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uAmp;
  uniform float uRadius;
  uniform float uTaper;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vUv = uv;

    // uv.x runs along the tube. Taper it toward the tip by pulling the surface
    // back along its own (radially outward) normal.
    float shrink = mix(1.0, uTaper, uv.x);
    vec3 pos = position + normal * (shrink - 1.0) * uRadius;

    // Whole rings move together, so the axis itself bends - a bend, not a bulge.
    // Amplitude is near zero at the base and greatest at the free end.
    float t = uv.x;
    float amp = uAmp * pow(t, 1.6);
    vec3 sway = vec3(
      sin(uTime * 0.85 + t * 5.0 + uSeed),
      sin(uTime * 1.25 + t * 4.1 + uSeed * 1.7),
      cos(uTime * 1.05 + t * 5.9 + uSeed * 2.3)
    ) * amp;
    pos += sway;

    vec4 world = modelMatrix * vec4(pos, 1.0);
    vView = normalize(cameraPosition - world.xyz);
    vNormal = normalize(mat3(modelMatrix) * normal);

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uProgress;
  uniform float uAlpha;
  uniform vec3 uCore;
  uniform vec3 uEdge;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    // Growth: the tendril draws itself outward from the trunk.
    if (vUv.x > uProgress) discard;

    // Energy travelling along the length, the way the Loom feeds a branch.
    float flow = sin(vUv.x * 16.0 - uTime * 2.4 + uSeed) * 0.5 + 0.5;
    float pulse = pow(flow, 3.0);

    // Rim light: the silhouette burns brighter than the body, so overlapping
    // tendrils stay separable instead of merging into a slab.
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);

    vec3 colour = mix(uEdge, uCore, pulse * 0.75 + fresnel * 0.6);

    // The leading edge of the growth glows hot while it is still drawing.
    float tipHeat = smoothstep(uProgress - 0.06, uProgress, vUv.x);
    colour = mix(colour, vec3(1.0), tipHeat * 0.7);

    float alpha = (0.42 + pulse * 0.42 + fresnel * 0.6 + tipHeat) * uAlpha;
    gl_FragColor = vec4(colour, clamp(alpha, 0.0, 1.0));
  }
`;

export interface TentacleProps {
  /** Ordered path: the anchor it forks from, then each world on the branch. */
  path: LayoutPoint[];
  /** When the newest world on this branch was born - drives the growth reveal. */
  bornAt: number;
  /** True while the rewrite ripple is dissolving this branch. */
  fading: boolean;
  /** Deeper branches are thinner and writhe more. */
  depth: number;
  /** Stable per-branch randomness. */
  seed: number;
  /** Collapses the branch toward the origin during a reset. */
  implode: number;
}

const CORE = new THREE.Color("#b6ffdc");
const EDGE = new THREE.Color("#12c46e");

/** Matches the worlds' birth animation so tube and bodies arrive together. */
const GROW_MS = 750;
const FADE_MS = 1100;

export default function Tentacle({
  path,
  bornAt,
  fading,
  depth,
  seed,
  implode,
}: TentacleProps) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const fadeStart = useRef<number | null>(null);

  const radius = Math.max(0.14, 0.42 - depth * 0.06);

  const geometry = useMemo(() => {
    if (path.length < 2) return null;

    const points = path.map(
      (p) =>
        new THREE.Vector3(
          THREE.MathUtils.lerp(p.x, 0, implode),
          THREE.MathUtils.lerp(p.y, 15, implode),
          THREE.MathUtils.lerp(p.z, 0, implode),
        ),
    );

    // Centripetal parameterisation avoids the cusps a uniform Catmull-Rom
    // produces when consecutive worlds sit at very different spacings.
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
    const segments = Math.min(160, Math.max(32, points.length * 24));
    return new THREE.TubeGeometry(curve, segments, radius, 10, false);
  }, [path, radius, implode]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeed: { value: seed },
      uAmp: { value: 0.18 + depth * 0.16 },
      uRadius: { value: radius },
      uTaper: { value: 0.42 },
      uProgress: { value: 0 },
      uAlpha: { value: 1 },
      uCore: { value: CORE },
      uEdge: { value: EDGE },
    }),
    [seed, depth, radius],
  );

  useFrame((state) => {
    const m = material.current;
    if (!m) return;

    const now = Date.now();
    m.uniforms.uTime.value = state.clock.elapsedTime;

    // Computed here rather than by the parent: a value captured in a memo
    // would freeze the growth at whatever it was when the tree last changed.
    m.uniforms.uProgress.value = THREE.MathUtils.clamp(
      (now - bornAt) / GROW_MS,
      0.02,
      1,
    );

    let alpha = 1;
    if (fading) {
      if (fadeStart.current === null) fadeStart.current = now;
      alpha = 1 - THREE.MathUtils.clamp((now - fadeStart.current) / FADE_MS, 0, 1);
    } else {
      fadeStart.current = null;
    }
    m.uniforms.uAlpha.value = alpha;
  });

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

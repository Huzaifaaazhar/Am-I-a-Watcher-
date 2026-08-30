"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { LayoutPoint } from "@/lib/types";

/**
 * The foliage: soft drifting motes clustered around branch tips.
 *
 * Alpha is deliberately tiny. These are additive and heavily overlapping, so
 * anything higher stacks into a white blob instead of a painted wash - the
 * canopy gets its density from many faint layers, not from opaque sprites.
 *
 * The reference canopy is a painted wash of violet, magenta and teal rather
 * than green leaves, so colour is sampled from that palette per mote and
 * biased warmer toward the crown. Additive, depth-write off, so the boughs
 * always read through it.
 */

const VERTEX = /* glsl */ `
  uniform float uTime;
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aSize;
  varying vec3 vColor;
  varying float vFade;

  void main() {
    vColor = aColor;

    // Each mote breathes on its own slow cycle and drifts a little.
    float t = uTime * 0.18 + aSeed * 40.0;
    vec3 drift = vec3(sin(t), sin(t * 0.7 + 1.3) * 0.6, cos(t * 0.9)) * 0.9;

    vec4 mv = modelViewMatrix * vec4(position + drift, 1.0);
    gl_Position = projectionMatrix * mv;
    vFade = 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * 0.6 + aSeed * 22.0));
    // Kept modest on purpose: these are additive and overlapping, so a large
    // sprite multiplied by thousands of motes is pure overdraw - the canopy
    // reads as a wash from many small blobs, not a few huge ones.
    gl_PointSize = clamp(aSize * (300.0 / max(-mv.z, 1.0)), 2.0, 110.0);
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vFade;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    // Very soft falloff - these are washes of colour, not sparks.
    float a = pow(1.0 - smoothstep(0.0, 0.25, d), 1.8);
    gl_FragColor = vec4(vColor, a * vFade * 0.13);
  }
`;

/** Sampled from the reference canopy: violet through magenta into teal. */
const FOLIAGE = [
  new THREE.Color("#8f5ad8"),
  new THREE.Color("#c063c8"),
  new THREE.Color("#e07ec0"),
  new THREE.Color("#4fb8d8"),
  new THREE.Color("#3fd0b8"),
  new THREE.Color("#4de0a0"),
  new THREE.Color("#9dffcb"),
];

/** Motes generated per branch tip that carries foliage. */
const PER_NODE = 18;

export default function Canopy({
  points,
  implode,
}: {
  points: LayoutPoint[];
  implode: number;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const { positions, colors, seeds, sizes, count } = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    const seed: number[] = [];
    const size: number[] = [];

    // Height range, so the crown can be tinted differently from the underside.
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const span = Math.max(1, maxY - minY);

    for (const p of points) {
      const cx = THREE.MathUtils.lerp(p.x, 0, implode);
      const cy = THREE.MathUtils.lerp(p.y, 15, implode);
      const cz = THREE.MathUtils.lerp(p.z, 0, implode);
      const high = (p.y - minY) / span;

      for (let i = 0; i < PER_NODE; i++) {
        // Gaussian-ish puff around the event, wider than it is tall so the
        // canopy spreads rather than balls up.
        const r = 1.9 * Math.cbrt(Math.random());
        const u = Math.random() * 2 - 1;
        const theta = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);

        pos.push(cx + s * Math.cos(theta) * r, cy + u * r * 0.7, cz + s * Math.sin(theta) * r);

        // Warmer violets up in the crown, cooler teals lower down.
        const bias = Math.random() * 0.55 + high * 0.45;
        const c = FOLIAGE[Math.min(FOLIAGE.length - 1, Math.floor(bias * FOLIAGE.length))];
        col.push(c.r, c.g, c.b);
        seed.push(Math.random());
        size.push(5.5 + Math.random() * 7.5);
      }
    }

    return {
      positions: new Float32Array(pos),
      colors: new Float32Array(col),
      seeds: new Float32Array(seed),
      sizes: new Float32Array(size),
      count: seed.length,
    };
  }, [points, implode]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  if (count === 0) return null;

  return (
    <points frustumCulled={false} renderOrder={-1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
        <bufferAttribute attach="attributes-aColor" array={colors} count={count} itemSize={3} />
        <bufferAttribute attach="attributes-aSeed" array={seeds} count={count} itemSize={1} />
        <bufferAttribute attach="attributes-aSize" array={sizes} count={count} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        transparent
        depthWrite={false}
              />
    </points>
  );
}

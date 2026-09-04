"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { LayoutPoint } from "@/lib/types";

/**
 * The foliage, built as two layers rather than one.
 *
 * A single cloud of sprites reads as smoke however it is tuned. The reference
 * canopy is a soft blue-teal mass with clumps of pink blossom sitting inside
 * it, so that is what this draws: a wide low-contrast haze that gives the
 * crown its volume, and a smaller, denser, warmer layer clustered on a subset
 * of the branch tips for the blossom.
 *
 * Both blend normally rather than additively. Additive motes at this density
 * sum past white however low the alpha goes - the crown turned into a
 * featureless blob every time - whereas normal blending converges on the mote
 * colour however many layers stack up, which is what a painted mass does. The
 * glow then comes from the bloom pass reading those colours, not from the
 * blend mode.
 */

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uDrift;
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aSize;
  varying vec3 vColor;
  varying float vFade;

  void main() {
    vColor = aColor;

    // Each mote breathes on its own slow cycle and drifts a little.
    float t = uTime * 0.16 + aSeed * 40.0;
    vec3 drift = vec3(sin(t), sin(t * 0.7 + 1.3) * 0.6, cos(t * 0.9)) * uDrift;

    vec4 mv = modelViewMatrix * vec4(position + drift, 1.0);
    gl_Position = projectionMatrix * mv;
    vFade = 0.55 + 0.45 * (0.5 + 0.5 * sin(uTime * 0.5 + aSeed * 22.0));
    // Capped: an uncapped sprite multiplied across thousands of motes is pure
    // overdraw, and once cost enough fill to stall the frame outright.
    gl_PointSize = clamp(aSize * (300.0 / max(-mv.z, 1.0)), 2.0, 88.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uAlpha;
  varying vec3 vColor;
  varying float vFade;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    // Very soft falloff - these are washes of colour, not sparks.
    float a = pow(1.0 - smoothstep(0.0, 0.25, d), 2.0);
    gl_FragColor = vec4(vColor, a * vFade * uAlpha);
  }
`;

/** The canopy's body: cool blues and teals, sampled from the reference. */
const HAZE = [
  new THREE.Color("#2f7fae"),
  new THREE.Color("#3f9fc4"),
  new THREE.Color("#4fbdc0"),
  new THREE.Color("#63d0b0"),
  new THREE.Color("#7ae0c8"),
];

/** Blossom clumps sitting inside the haze. */
const BLOSSOM = [
  new THREE.Color("#d268c0"),
  new THREE.Color("#e88fd0"),
  new THREE.Color("#f2b3dd"),
  new THREE.Color("#b478e0"),
];

interface Layer {
  positions: Float32Array;
  colors: Float32Array;
  seeds: Float32Array;
  sizes: Float32Array;
  count: number;
}

const EMPTY: Layer = {
  positions: new Float32Array(0),
  colors: new Float32Array(0),
  seeds: new Float32Array(0),
  sizes: new Float32Array(0),
  count: 0,
};

function build(
  points: LayoutPoint[],
  implode: number,
  perPoint: number,
  radius: number,
  size: [number, number],
  palette: THREE.Color[],
  pick: (index: number) => boolean,
): Layer {
  const pos: number[] = [];
  const col: number[] = [];
  const seed: number[] = [];
  const sz: number[] = [];

  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const span = Math.max(1, maxY - minY);

  points.forEach((p, index) => {
    if (!pick(index)) return;
    const cx = THREE.MathUtils.lerp(p.x, 0, implode);
    const cy = THREE.MathUtils.lerp(p.y, 15, implode);
    const cz = THREE.MathUtils.lerp(p.z, 0, implode);
    const high = (p.y - minY) / span;

    for (let i = 0; i < perPoint; i++) {
      // Gaussian-ish puff, wider than it is tall so the canopy spreads
      // rather than balling up.
      const r = radius * Math.cbrt(Math.random());
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);

      pos.push(cx + s * Math.cos(theta) * r, cy + u * r * 0.72, cz + s * Math.sin(theta) * r);

      // Warmer and lighter toward the crown.
      const bias = Math.random() * 0.6 + high * 0.4;
      const c = palette[Math.min(palette.length - 1, Math.floor(bias * palette.length))];
      col.push(c.r, c.g, c.b);
      seed.push(Math.random());
      sz.push(size[0] + Math.random() * (size[1] - size[0]));
    }
  });

  return {
    positions: new Float32Array(pos),
    colors: new Float32Array(col),
    seeds: new Float32Array(seed),
    sizes: new Float32Array(sz),
    count: seed.length,
  };
}

function Cloud({
  layer,
  alpha,
  drift,
  order,
}: {
  layer: Layer;
  alpha: number;
  drift: number;
  order: number;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uAlpha: { value: alpha }, uDrift: { value: drift } }),
    [alpha, drift],
  );

  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  if (layer.count === 0) return null;

  return (
    <points frustumCulled={false} renderOrder={order}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={layer.positions}
          count={layer.count}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aColor"
          array={layer.colors}
          count={layer.count}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSeed"
          array={layer.seeds}
          count={layer.count}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aSize"
          array={layer.sizes}
          count={layer.count}
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
      />
    </points>
  );
}

export default function Canopy({
  points,
  implode,
}: {
  points: LayoutPoint[];
  implode: number;
}) {
  const haze = useMemo(
    () => (points.length === 0
      ? EMPTY
      : build(points, implode, 16, 4.6, [16, 46], HAZE, () => true)),
    [points, implode],
  );

  // Blossom sits on roughly a third of the tips, in clumps, rather than
  // evenly - scattered evenly it just tints the whole canopy pink.
  const blossom = useMemo(
    () => (points.length === 0
      ? EMPTY
      : build(points, implode, 8, 2.4, [10, 26], BLOSSOM, (i) => i % 4 === 1)),
    [points, implode],
  );

  return (
    <>
      <Cloud layer={haze} alpha={0.055} drift={1.1} order={1} />
      <Cloud layer={blossom} alpha={0.07} drift={0.6} order={2} />
    </>
  );
}

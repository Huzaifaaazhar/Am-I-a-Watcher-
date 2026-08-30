"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { LayoutPoint } from "@/lib/types";

/**
 * One branch of the Sacred Timeline, drawn as a thin luminous vein riding
 * over the World Tree's wood.
 *
 * The woody mass belongs to `ProceduralTree`; these are deliberately much
 * thinner than the limbs they follow. When they were as thick as the trunk
 * they out-scaled the tree and the whole thing read as green plumbing - as a
 * vein, the same geometry reads as history running through the branches.
 */

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uRadius;
  uniform float uTaper;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vUv = uv;

    // Taper toward the tip by pulling the surface back along its own normal.
    float shrink = mix(1.0, uTaper, pow(uv.x, 0.75));
    vec3 pos = position + normal * (shrink - 1.0) * uRadius;

    // A slow sway, anchored at the base and freest at the tip. Whole rings
    // move together so the limb bends rather than bulges.
    float t = uv.x;
    float amp = 0.09 * pow(t, 1.8);
    pos += vec3(
      sin(uTime * 0.5 + t * 3.0 + uSeed),
      sin(uTime * 0.7 + t * 2.4 + uSeed * 1.7) * 0.35,
      cos(uTime * 0.6 + t * 3.4 + uSeed * 2.3)
    ) * amp;

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
  uniform vec3 uBark;
  uniform vec3 uLit;
  uniform vec3 uSap;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // Growth: the limb draws itself outward from the fork.
    if (vUv.x > uProgress) discard;

    vec3 n = normalize(vNormal);

    // Key light from above: the top of every limb catches the canopy glow.
    float lit = clamp(dot(n, normalize(vec3(0.25, 1.0, 0.35))), 0.0, 1.0);

    // A soft lengthwise grain. An earlier version quantised this with floor()
    // and the hard cells read as scales, so it is smoothed along both axes.
    vec2 g = vec2(vUv.y * 22.0, vUv.x * 40.0);
    vec2 gi = floor(g);
    vec2 gf = smoothstep(0.0, 1.0, fract(g));
    float grain = mix(
      mix(hash(gi), hash(gi + vec2(1.0, 0.0)), gf.x),
      mix(hash(gi + vec2(0.0, 1.0)), hash(gi + vec2(1.0, 1.0)), gf.x),
      gf.y);

    vec3 colour = mix(uBark, uLit, pow(lit, 0.8)) * mix(0.9, 1.0, grain);

    // Sap light bleeding out of the wood near the trunk end, fading outward.
    float core = (1.0 - smoothstep(0.0, 0.55, vUv.x)) * 0.5;
    float pulse = 0.5 + 0.5 * sin(uTime * 1.1 - vUv.x * 5.0 + uSeed);
    colour += uSap * core * (0.45 + pulse * 0.4);

    // Rim so overlapping limbs stay separable against the canopy.
    float fres = pow(1.0 - abs(dot(n, normalize(vView))), 3.0);
    colour += uSap * fres * 0.5;

    // The growing tip burns bright for a moment.
    float tip = smoothstep(uProgress - 0.05, uProgress, vUv.x);
    colour = mix(colour, vec3(0.85, 1.0, 0.9), tip * 0.8);

    gl_FragColor = vec4(colour, uAlpha);
  }
`;

export interface BoughProps {
  /** Ordered path: the fork point, then each event along the branch. */
  path: LayoutPoint[];
  bornAt: number;
  fading: boolean;
  depth: number;
  seed: number;
  implode: number;
}

const BARK = new THREE.Color("#125637");
const LIT = new THREE.Color("#5fd08a");
const SAP = new THREE.Color("#9dffcb");

const GROW_MS = 750;
const FADE_MS = 1100;

export default function Bough({
  path,
  bornAt,
  fading,
  depth,
  seed,
  implode,
}: BoughProps) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const fadeStart = useRef<number | null>(null);

  // Veins, not limbs: thin enough that the tree's own wood stays the subject.
  const radius = Math.max(0.09, 0.30 - depth * 0.06);

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
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
    const segments = Math.min(180, Math.max(40, points.length * 26));
    return new THREE.TubeGeometry(curve, segments, radius, 12, false);
  }, [path, radius, implode]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeed: { value: seed },
      uRadius: { value: radius },
      uTaper: { value: 0.3 },
      uProgress: { value: 0 },
      uAlpha: { value: 1 },
      uBark: { value: BARK },
      uLit: { value: LIT },
      uSap: { value: SAP },
    }),
    [seed, radius],
  );

  useFrame((state) => {
    const m = material.current;
    if (!m) return;
    const now = Date.now();
    m.uniforms.uTime.value = state.clock.elapsedTime;
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
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

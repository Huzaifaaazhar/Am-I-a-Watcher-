"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The painted backdrop the tree stands against.
 *
 * The reference is not deep space - it is a washed teal-to-violet ground with
 * soft cloud banks, closer to gouache than to a starfield. Rendered on the
 * inside of a large sphere with depth-write off so it never occludes the tree.
 */

const VERTEX = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec3 vPos;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    return noise(p) * 0.55 + noise(p * 2.1) * 0.28 + noise(p * 4.3) * 0.17;
  }

  void main() {
    vec3 dir = normalize(vPos);

    // Deep teal underfoot rising into violet overhead - the reference's
    // vertical wash.
    float h = dir.y * 0.5 + 0.5;
    vec3 low  = vec3(0.020, 0.115, 0.105);
    vec3 mid  = vec3(0.055, 0.150, 0.190);
    vec3 high = vec3(0.115, 0.085, 0.215);
    vec3 base = h < 0.5
      ? mix(low, mid, smoothstep(0.0, 0.5, h))
      : mix(mid, high, smoothstep(0.5, 1.0, h));

    // Slow cloud banks, brightest around the horizon behind the canopy.
    float n = fbm(dir * 2.3 + vec3(0.0, uTime * 0.008, uTime * 0.004));
    float bank = smoothstep(0.30, 0.95, n) * (1.0 - abs(dir.y) * 0.55);
    base += vec3(0.10, 0.14, 0.20) * bank * 0.5;

    // A faint magenta bloom high up, echoing the canopy colour.
    float crown = smoothstep(0.25, 1.0, dir.y) * smoothstep(0.4, 0.9, n);
    base += vec3(0.16, 0.06, 0.18) * crown * 0.5;

    gl_FragColor = vec4(base, 1.0);
  }
`;

export default function Cosmos() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-2}>
      <sphereGeometry args={[340, 40, 40]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

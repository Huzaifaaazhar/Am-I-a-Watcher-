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

    // Deep green underfoot rising into a blue-teal sky - the reference's
    // vertical wash. Values are linear; the composite converts once at the end.
    float h = dir.y * 0.5 + 0.5;
    // Deliberately dim. A backdrop this close in value to the tree gives the
    // frame no dark anchor and everything reads as haze.
    vec3 low  = vec3(0.0030, 0.0150, 0.0110);
    vec3 mid  = vec3(0.0045, 0.0200, 0.0225);
    vec3 high = vec3(0.0080, 0.0205, 0.0370);
    vec3 base = h < 0.5
      ? mix(low, mid, smoothstep(0.0, 0.5, h))
      : mix(mid, high, smoothstep(0.5, 1.0, h));

    // Slow cloud banks, brightest around the horizon behind the canopy.
    float n = fbm(dir * 2.3 + vec3(0.0, uTime * 0.008, uTime * 0.004));
    float bank = smoothstep(0.30, 0.95, n) * (1.0 - abs(dir.y) * 0.55);
    base += vec3(0.009, 0.021, 0.026) * bank;

    // A faint magenta bloom high up, echoing the blossom colour.
    float crown = smoothstep(0.25, 1.0, dir.y) * smoothstep(0.4, 0.9, n);
    base += vec3(0.016, 0.005, 0.018) * crown;

    // A soft glow low and centre, so the trunk reads against a lit ground
    // rather than sitting on flat black.
    float ground = smoothstep(0.35, -0.15, dir.y) * smoothstep(0.55, 1.0, 1.0 - abs(dir.y));
    base += vec3(0.006, 0.019, 0.013) * ground;

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
      {/*
        Comfortably beyond the furthest the rig can pull back. At radius 340
        the far plane sliced the sphere, and the cut followed its low-poly
        hull - a hard octagonal edge straight across the frame, worst on a
        phone where the camera sits furthest out.
      */}
      <sphereGeometry args={[600, 48, 32]} />
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

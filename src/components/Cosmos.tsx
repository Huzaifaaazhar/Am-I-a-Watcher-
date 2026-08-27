"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The void the tree hangs in.
 *
 * Both pieces render on the inside of very large spheres / at great distance
 * with depthWrite off, so nothing here ever occludes the branches - it only
 * gives the scene a floor of depth so the tendrils read as being *somewhere*
 * rather than floating on black.
 */

/* --------------------------------------------------------------- starfield */

const STAR_VERTEX = /* glsl */ `
  uniform float uTime;
  attribute float aSeed;
  attribute float aSize;
  varying float vTwinkle;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Slow, per-star flicker so the field is never a static texture.
    vTwinkle = 0.55 + 0.45 * sin(uTime * 0.6 + aSeed * 42.0);
    gl_PointSize = aSize * (260.0 / max(-mv.z, 1.0));
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying float vTwinkle;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    float glow = 1.0 - smoothstep(0.0, 0.25, d);
    // Faintly green-white: the same light the Loom throws.
    gl_FragColor = vec4(mix(vec3(0.72, 0.95, 0.84), vec3(1.0), glow), glow * vTwinkle * 0.85);
  }
`;

function Starfield({ count = 1600 }: { count?: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const { positions, seeds, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Uniform on a shell, so density does not clump at the poles.
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const radius = 140 + Math.random() * 160;

      positions[i * 3] = r * Math.cos(theta) * radius;
      positions[i * 3 + 1] = u * radius;
      positions[i * 3 + 2] = r * Math.sin(theta) * radius;
      seeds[i] = Math.random();
      sizes[i] = 0.7 + Math.random() * 1.8;
    }
    return { positions, seeds, sizes };
  }, [count]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
        <bufferAttribute attach="attributes-aSeed" array={seeds} count={count} itemSize={1} />
        <bufferAttribute attach="attributes-aSize" array={sizes} count={count} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={STAR_VERTEX}
        fragmentShader={STAR_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ------------------------------------------------------------------ nebula */

const NEBULA_VERTEX = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NEBULA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec3 vPos;

  // Cheap value noise - enough for a slow-drifting wash, not a texture fetch.
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
    return n;
  }

  void main() {
    vec3 dir = normalize(vPos);
    float n = noise(dir * 2.6 + vec3(0.0, uTime * 0.012, 0.0));
    n += 0.5 * noise(dir * 5.4 - vec3(uTime * 0.008, 0.0, 0.0));

    // Brightest around the horizon, falling away above and below, so the
    // trunk always has something behind it.
    float band = 1.0 - abs(dir.y);
    float density = pow(band, 2.2) * smoothstep(0.35, 1.1, n);

    vec3 deep = vec3(0.004, 0.012, 0.010);
    vec3 glow = vec3(0.02, 0.10, 0.065);
    gl_FragColor = vec4(mix(deep, glow, density), 1.0);
  }
`;

function Nebula() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh frustumCulled={false}>
      <sphereGeometry args={[340, 32, 32]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={NEBULA_VERTEX}
        fragmentShader={NEBULA_FRAGMENT}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function Cosmos() {
  return (
    <group>
      <Nebula />
      <Starfield />
    </group>
  );
}

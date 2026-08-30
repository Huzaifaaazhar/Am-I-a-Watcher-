"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The World Tree's own woody mass.
 *
 * Timeline events only ever amount to a handful of points, so a tree drawn
 * purely from data is a bare stick. This grows a proper recursive trunk and
 * canopy that exists regardless of the data, and the timeline's glowing
 * boughs and gold event beads are then threaded over it.
 *
 * Every limb is a hand-built tapered tube rather than a `TubeGeometry`: a
 * constant-radius tube reads as plumbing, and taper is most of what makes a
 * shape read as a tree. All of it is merged into one buffer and generated
 * once from a fixed seed, so the tree is a single draw call and never
 * re-shuffles between renders.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GrownTree {
  geometry: THREE.BufferGeometry;
  /** Branch tips, where foliage hangs. */
  tips: THREE.Vector3[];
}

/** Thickest limb in the tree, used to normalise the `aThin` attribute. */
const THIN_REF = 1;

interface Mesh {
  position: number[];
  normal: number[];
  thin: number[];
  index: number[];
}

/**
 * Sweeps a ring of `radial` vertices along `curve`, shrinking from `r0` to
 * `r1`, and stitches consecutive rings into a closed tube.
 */
function sweep(
  mesh: Mesh,
  curve: THREE.CatmullRomCurve3,
  r0: number,
  r1: number,
  tubular: number,
  radial: number,
  maxRadius: number,
) {
  const frames = curve.computeFrenetFrames(tubular, false);
  const base = mesh.position.length / 3;
  const p = new THREE.Vector3();

  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, p);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    // Taper faster at the start than the end - limbs shed most of their bulk
    // just past the fork, then run out thin for a long way.
    const r = r0 + (r1 - r0) * Math.pow(t, 0.72);
    const thin = 1 - Math.min(1, r / (maxRadius * THIN_REF));

    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const nx = Math.cos(a) * N.x + Math.sin(a) * B.x;
      const ny = Math.cos(a) * N.y + Math.sin(a) * B.y;
      const nz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      mesh.position.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
      mesh.normal.push(nx, ny, nz);
      mesh.thin.push(thin);
    }
  }

  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = base + i * radial + j;
      const b = base + i * radial + ((j + 1) % radial);
      const c = a + radial;
      const d = b + radial;
      mesh.index.push(a, c, b, b, c, d);
    }
  }
}

export function growTree(baseY: number, topY: number, seed = 424242): GrownTree {
  const rand = mulberry32(seed);
  const mesh: Mesh = { position: [], normal: [], thin: [], index: [] };
  const tips: THREE.Vector3[] = [];

  // Every dimension is a fraction of the trunk's own height, so the tree stays
  // correctly proportioned whatever range the timeline happens to span.
  const span = Math.max(14, topY - baseY);
  const trunkRadius = span * 0.075;

  /** Emits one bowed, tapered limb. `bow` scales the sideways wander. */
  const limb = (
    from: THREE.Vector3,
    to: THREE.Vector3,
    r0: number,
    r1: number,
    bow = 0.26,
  ) => {
    const len = from.distanceTo(to);
    const mid = from.clone().lerp(to, 0.5);
    // Bow every limb sideways so nothing in the tree is a straight rod.
    mid.x += (rand() - 0.5) * len * bow;
    mid.z += (rand() - 0.5) * len * bow;
    mid.y += len * 0.05 * (bow / 0.26);

    const curve = new THREE.CatmullRomCurve3([from, mid, to], false, "centripetal", 0.5);
    // Thick limbs need round cross-sections and smooth bends; twigs do not.
    const radial = r0 > trunkRadius * 0.3 ? 12 : r0 > trunkRadius * 0.12 ? 8 : 5;
    const tubular = r0 > trunkRadius * 0.3 ? 20 : 10;
    sweep(mesh, curve, r0, r1, tubular, radial, trunkRadius);
  };

  const grow = (
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    length: number,
    radius: number,
    depth: number,
  ) => {
    const end = origin.clone().addScaledVector(dir, length);
    limb(origin, end, radius, radius * 0.62);

    // Foliage hangs off the outer two levels, not just the final tip, so the
    // canopy has depth through the branches instead of floating in clumps.
    if (depth <= 1) tips.push(end);
    if (depth === 0) return;

    // Two or three children, splayed around the parent direction and pulled
    // back toward vertical so the canopy lifts rather than droops.
    const children = rand() > 0.4 ? 3 : 2;
    const axis = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();

    for (let i = 0; i < children; i++) {
      const spread = 0.34 + rand() * 0.4;
      const child = dir
        .clone()
        .applyAxisAngle(axis, spread * (i % 2 === 0 ? 1 : -1))
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), (i / children) * Math.PI * 2 + rand())
        .lerp(new THREE.Vector3(0, 1, 0), 0.18)
        .normalize();

      grow(end, child, length * (0.7 + rand() * 0.12), radius * 0.66, depth - 1);
    }
  };

  // A flared buttress at the ground, so the trunk plants itself rather than
  // being pushed into the floor like a dowel.
  const forkY = baseY + span * 0.44;
  const buttressY = baseY + span * 0.1;
  const buttress = new THREE.Vector3(0, buttressY, 0);
  const trunkTop = new THREE.Vector3(0, forkY, 0);

  // The buttress runs straight: bowing it put a visible dogleg where it met
  // the trunk, since the two segments wandered in different directions.
  limb(new THREE.Vector3(0, baseY, 0), buttress, trunkRadius * 1.9, trunkRadius * 1.05, 0);
  limb(buttress, trunkTop, trunkRadius * 1.05, trunkRadius * 0.72, 0.1);

  // The main boughs leave the fork at uneven angles - evenly spaced boughs
  // read as a bottle brush rather than a tree.
  const boughs = 6;
  for (let i = 0; i < boughs; i++) {
    const azimuth = (i / boughs) * Math.PI * 2 + (rand() - 0.5) * 0.9;
    const tilt = 0.5 + rand() * 0.36;
    const dir = new THREE.Vector3(
      Math.sin(tilt) * Math.cos(azimuth),
      Math.cos(tilt),
      Math.sin(tilt) * Math.sin(azimuth),
    ).normalize();
    // Boughs leave a little way up the trunk, not all from one point.
    const from = new THREE.Vector3(0, forkY - span * 0.06 * rand(), 0);
    grow(from, dir, span * 0.25, trunkRadius * (0.5 + rand() * 0.12), 4);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.position, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.normal, 3));
  geometry.setAttribute("aThin", new THREE.Float32BufferAttribute(mesh.thin, 1));
  geometry.setIndex(mesh.index);
  return { geometry, tips };
}

/*
 * Bark shading. The thick trunk stays dark and matte; the finest twigs carry
 * the tree's own light, so the crown glows from within instead of relying on
 * the canopy sprites for all of its brightness.
 */
const VERTEX = /* glsl */ `
  attribute float aThin;
  varying float vThin;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vY;

  void main() {
    vThin = aThin;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    vY = world.y;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uBark;
  uniform vec3 uLit;
  uniform vec3 uGlow;

  varying float vThin;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vY;

  void main() {
    vec3 n = normalize(vNormal);

    // Key light from up and to the front-left, matching the scene lights.
    float key = clamp(dot(n, normalize(vec3(-0.35, 0.9, 0.4))), 0.0, 1.0);
    // A cool bounce from below keeps the underside from going flat black.
    float fill = clamp(dot(n, normalize(vec3(0.2, -1.0, 0.1))), 0.0, 1.0) * 0.22;

    vec3 colour = mix(uBark, uLit, pow(key, 0.7)) + uLit * fill;

    // Twigs carry the sap light; the trunk stays wood. The glow is scaled by
    // the key term as well, or every thin branch flattens to one flat green
    // and the crown loses all of its form.
    float glow = smoothstep(0.45, 1.0, vThin);
    colour = mix(colour, uGlow, glow * (0.16 + key * 0.34));

    // Rim light so overlapping branches stay separable against the canopy.
    float fres = pow(1.0 - abs(dot(n, normalize(vView))), 3.0);
    colour += uGlow * fres * (0.18 + glow * 0.35);

    gl_FragColor = vec4(colour, 1.0);
  }
`;

const BARK = new THREE.Color("#05241a");
const LIT = new THREE.Color("#3fae70");
const GLOW = new THREE.Color("#7bffc6");

export default function ProceduralTree({
  baseY,
  topY,
}: {
  baseY: number;
  topY: number;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const { geometry } = useMemo(() => growTree(baseY, topY), [baseY, topY]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBark: { value: BARK },
      uLit: { value: LIT },
      uGlow: { value: GLOW },
    }),
    [],
  );

  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
      />
    </mesh>
  );
}

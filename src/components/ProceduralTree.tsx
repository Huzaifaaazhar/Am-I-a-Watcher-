"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The World Tree's own woody mass: roots, a fluted trunk and a recursive
 * crown, generated once from a fixed seed and merged into one draw call.
 *
 * Timeline events only ever amount to a handful of points, so a tree drawn
 * purely from data is a bare stick. This grows the tree itself; the timeline's
 * gold veins and event beads are threaded over it.
 *
 * Every limb is a hand-built tapered tube rather than a `TubeGeometry`. A
 * constant-radius tube reads as plumbing, and taper is most of what makes a
 * shape read as a tree. Each ring also carries how far along the limb it sits
 * and where it sits around the trunk, which is what lets the bark shader run
 * ridges lengthwise instead of smearing noise over a smooth surface.
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

interface Mesh {
  position: number[];
  normal: number[];
  thin: number[];
  axis: number[];
  angle: number[];
  index: number[];
}

interface SweepOptions {
  r0: number;
  r1: number;
  tubular: number;
  radial: number;
  maxRadius: number;
  /** Depth of the lengthwise flutes in the cross-section, 0 for a round limb. */
  flute: number;
}

/**
 * Sweeps a ring of vertices along `curve`, shrinking from `r0` to `r1`, and
 * stitches consecutive rings into a closed tube.
 */
function sweep(mesh: Mesh, curve: THREE.CatmullRomCurve3, o: SweepOptions) {
  const { r0, r1, tubular, radial, maxRadius, flute } = o;
  const frames = curve.computeFrenetFrames(tubular, false);
  const base = mesh.position.length / 3;
  const length = curve.getLength();
  const p = new THREE.Vector3();

  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, p);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    // Taper faster at the start than the end: limbs shed most of their bulk
    // just past the fork, then run out thin for a long way.
    const r = r0 + (r1 - r0) * Math.pow(t, 0.72);
    const thin = 1 - Math.min(1, r / maxRadius);

    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      // Flutes: shallow lengthwise grooves, so the trunk is not a smooth cone.
      const ripple = 1 + flute * Math.sin(a * 5 + t * 2.2);
      const nx = Math.cos(a) * N.x + Math.sin(a) * B.x;
      const ny = Math.cos(a) * N.y + Math.sin(a) * B.y;
      const nz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      mesh.position.push(
        p.x + nx * r * ripple,
        p.y + ny * r * ripple,
        p.z + nz * r * ripple,
      );
      mesh.normal.push(nx, ny, nz);
      mesh.thin.push(thin);
      mesh.axis.push(t * length);
      mesh.angle.push(j / radial);
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
  const mesh: Mesh = { position: [], normal: [], thin: [], axis: [], angle: [], index: [] };
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
    flute = 0,
  ) => {
    const len = from.distanceTo(to);
    const mid = from.clone().lerp(to, 0.5);
    // Bow every limb sideways so nothing in the tree is a straight rod.
    mid.x += (rand() - 0.5) * len * bow;
    mid.z += (rand() - 0.5) * len * bow;
    mid.y += len * 0.05 * (bow / 0.26);

    const curve = new THREE.CatmullRomCurve3([from, mid, to], false, "centripetal", 0.5);
    // Thick limbs need round cross-sections and smooth bends; twigs do not.
    const thick = r0 > trunkRadius * 0.3;
    sweep(mesh, curve, {
      r0,
      r1,
      tubular: thick ? 24 : 10,
      radial: thick ? 16 : r0 > trunkRadius * 0.12 ? 9 : 6,
      maxRadius: trunkRadius,
      flute,
    });
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

      grow(end, child, length * (0.68 + rand() * 0.12), radius * 0.58, depth - 1);
    }
  };

  const forkY = baseY + span * 0.44;
  const buttressY = baseY + span * 0.1;
  const buttress = new THREE.Vector3(0, buttressY, 0);
  const trunkTop = new THREE.Vector3(0, forkY, 0);

  // Roots first: the reference tree sits in a tangle of them, and without it
  // the trunk looks sawn off at the bottom of frame.
  const rootCount = 22;
  for (let i = 0; i < rootCount; i++) {
    const azimuth = (i / rootCount) * Math.PI * 2 + (rand() - 0.5) * 0.55;
    const reach = span * (0.16 + rand() * 0.2);
    const drop = span * (0.06 + rand() * 0.08);
    const r = trunkRadius * (0.2 + rand() * 0.22);

    const knee = new THREE.Vector3(
      Math.cos(azimuth) * reach * 0.45,
      baseY + span * 0.05 - drop * 0.3,
      Math.sin(azimuth) * reach * 0.45,
    );
    const toe = new THREE.Vector3(
      Math.cos(azimuth + 0.35) * reach,
      baseY - drop,
      Math.sin(azimuth + 0.35) * reach,
    );
    limb(new THREE.Vector3(0, baseY + span * 0.09, 0), knee, r, r * 0.7, 0.12, 0.1);
    limb(knee, toe, r * 0.7, r * 0.22, 0.3, 0.08);
  }

  // A flared, fluted trunk. The buttress runs straight - bowing it put a
  // visible dogleg where it met the trunk, since the two segments wandered in
  // different directions.
  limb(new THREE.Vector3(0, baseY, 0), buttress, trunkRadius * 1.9, trunkRadius * 1.05, 0, 0.09);
  limb(buttress, trunkTop, trunkRadius * 1.05, trunkRadius * 0.72, 0.1, 0.07);

  // The main boughs leave the fork at uneven angles and from slightly
  // different heights - evenly spaced boughs read as a bottle brush.
  const boughs = 6;
  for (let i = 0; i < boughs; i++) {
    const azimuth = (i / boughs) * Math.PI * 2 + (rand() - 0.5) * 0.9;
    const tilt = 0.5 + rand() * 0.36;
    const dir = new THREE.Vector3(
      Math.sin(tilt) * Math.cos(azimuth),
      Math.cos(tilt),
      Math.sin(tilt) * Math.sin(azimuth),
    ).normalize();
    const from = new THREE.Vector3(0, forkY - span * 0.06 * rand(), 0);
    grow(from, dir, span * 0.25, trunkRadius * (0.5 + rand() * 0.12), 4);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.position, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.normal, 3));
  geometry.setAttribute("aThin", new THREE.Float32BufferAttribute(mesh.thin, 1));
  geometry.setAttribute("aAxis", new THREE.Float32BufferAttribute(mesh.axis, 1));
  geometry.setAttribute("aAngle", new THREE.Float32BufferAttribute(mesh.angle, 1));
  geometry.setIndex(mesh.index);
  return { geometry, tips };
}

/* ----------------------------------------------------------------- shading */

const VERTEX = /* glsl */ `
  attribute float aThin;
  attribute float aAxis;
  attribute float aAngle;

  varying float vThin;
  varying float vAxis;
  varying float vAngle;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vY;

  void main() {
    vThin = aThin;
    vAxis = aAxis;
    vAngle = aAngle;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    vY = world.y;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/*
 * Painterly bark. The heartwood is lit from inside and the light escapes
 * through the crevices between ridges, brightest in the thick lower trunk;
 * out in the crown the branches darken into silhouettes against the canopy.
 * That gradient - glowing at the root, graphic at the tips - is what the
 * reference does, and what a single flat surface colour cannot.
 */
const FRAGMENT = /* glsl */ `
  uniform float uBaseY;
  uniform float uSpan;
  uniform vec3 uBarkDark;
  uniform vec3 uBarkLit;
  uniform vec3 uAmbient;
  uniform vec3 uCore;
  uniform vec3 uSilhouette;

  varying float vThin;
  varying float vAxis;
  varying float vAngle;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vY;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y);
  }

  float fbm(vec2 p) {
    return vnoise(p) * 0.55 + vnoise(p * 2.3) * 0.28 + vnoise(p * 4.7) * 0.17;
  }

  void main() {
    vec3 n = normalize(vNormal);
    float height = clamp((vY - uBaseY) / uSpan, 0.0, 1.0);

    // Two scales of bark: fine fibre and broad ridges, both running lengthwise
    // because the noise is sampled across the ring and along the limb.
    float fibre = fbm(vec2(vAngle * 16.0, vAxis * 1.3));
    float ridge = fbm(vec2(vAngle * 5.0, vAxis * 0.3));

    float key = clamp(dot(n, normalize(vec3(-0.4, 0.85, 0.45))), 0.0, 1.0);
    float fill = clamp(dot(n, normalize(vec3(0.5, -0.6, -0.2))), 0.0, 1.0);

    // An ambient floor before anything else. Without it the shadow side of a
    // thick bough is the shadow colour outright, which read as a flat black
    // bowl sitting under the crown rather than as wood in shade.
    vec3 shadow = mix(uBarkDark, uAmbient, 0.55);
    vec3 colour = mix(shadow, uBarkLit, key * 0.8 + fibre * 0.28);
    colour += uBarkLit * fill * 0.16;

    // Heartwood light, strongest in the thick lower trunk and escaping
    // through the crevices between ridges.
    float core = smoothstep(0.85, 0.1, vThin) * smoothstep(0.72, 0.0, height);
    float crevice = smoothstep(0.62, 0.16, ridge);
    colour += uCore * core * (0.16 + crevice * 0.75);

    // Up in the crown, branches read as dark shapes against the foliage.
    colour = mix(colour, uSilhouette,
      smoothstep(0.28, 0.95, vThin) * smoothstep(0.3, 0.92, height) * 0.7);

    float fres = pow(1.0 - abs(dot(n, normalize(vView))), 2.6);
    colour += uCore * fres * 0.08 * (1.0 - height * 0.55);

    gl_FragColor = vec4(colour, 1.0);
  }
`;

const BARK_DARK = new THREE.Color("#0c2f24");
const BARK_LIT = new THREE.Color("#2a7d50");
const AMBIENT = new THREE.Color("#1b4a58");
const CORE = new THREE.Color("#c6ffa4");
const SILHOUETTE = new THREE.Color("#0b2b26");

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
      uBaseY: { value: baseY },
      uSpan: { value: Math.max(14, topY - baseY) },
      uBarkDark: { value: BARK_DARK },
      uBarkLit: { value: BARK_LIT },
      uAmbient: { value: AMBIENT },
      uCore: { value: CORE },
      uSilhouette: { value: SILHOUETTE },
    }),
    [baseY, topY],
  );

  useFrame(() => {
    const m = material.current;
    if (!m) return;
    m.uniforms.uBaseY.value = baseY;
    m.uniforms.uSpan.value = Math.max(14, topY - baseY);
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

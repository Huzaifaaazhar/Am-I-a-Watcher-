"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { useBark } from "@/three/useMaterials";

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

/** A branch end, and the direction the branch was travelling when it got there. */
export interface Tip {
  position: THREE.Vector3;
  direction: THREE.Vector3;
}

export interface GrownTree {
  geometry: THREE.BufferGeometry;
  /** Branch tips, where foliage hangs. */
  tips: Tip[];
}

interface Mesh {
  position: number[];
  normal: number[];
  uv: number[];
  index: number[];
}

/**
 * World units covered by one tile of the bark texture.
 *
 * UVs are built from real distances - around the ring and along the limb -
 * rather than normalised 0..1, so texel density stays constant whether the
 * surface is the trunk or a twig. Normalised UVs would stretch the same bark
 * tile around a two-metre trunk and a two-centimetre twig alike.
 */
const BARK_TILE = 3.2;

interface SweepOptions {
  r0: number;
  r1: number;
  tubular: number;
  radial: number;
  /** Depth of the lengthwise flutes in the cross-section, 0 for a round limb. */
  flute: number;
}

/**
 * Sweeps a ring of vertices along `curve`, shrinking from `r0` to `r1`, and
 * stitches consecutive rings into a closed tube.
 */
function sweep(mesh: Mesh, curve: THREE.CatmullRomCurve3, o: SweepOptions) {
  const { r0, r1, tubular, radial, flute } = o;
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
    const circumference = 2 * Math.PI * r;

    // The ring is closed with a duplicate vertex at j == radial so the seam
    // gets its own u of exactly `circumference / BARK_TILE` instead of
    // wrapping back to zero, which would smear the whole texture across one
    // quad.
    for (let j = 0; j <= radial; j++) {
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
      mesh.uv.push(
        ((j / radial) * circumference) / BARK_TILE,
        (t * length) / BARK_TILE,
      );
    }
  }

  const stride = radial + 1;
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = base + i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = b + stride;
      mesh.index.push(a, c, b, b, c, d);
    }
  }
}

export function growTree(baseY: number, topY: number, seed = 424242): GrownTree {
  const rand = mulberry32(seed);
  const mesh: Mesh = { position: [], normal: [], uv: [], index: [] };
  const tips: Tip[] = [];

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
    if (depth <= 1) tips.push({ position: end.clone(), direction: dir.clone() });
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
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(mesh.uv, 2));
  geometry.setIndex(mesh.index);
  return { geometry, tips };
}

/* --------------------------------------------------------------- material */

/**
 * Bark, as a physical material rather than a hand-written shader.
 *
 * The previous version painted light into the surface with a custom shader:
 * heartwood glow, crevice bleed, a silhouette ramp up the crown. It matched
 * the painted reference, and it is gone, because the standing decision is
 * literal photoreal. What lights the tree now is the HDRI in Scene, through
 * real albedo, normal and roughness maps. There is nowhere left to cheat.
 *
 * The ARM map is wired three times on purpose. three reads occlusion from the
 * red channel, roughness from green and metalness from blue, so one packed
 * texture drives all three and costs a single texture unit.
 */
export default function ProceduralTree({
  baseY,
  topY,
}: {
  baseY: number;
  topY: number;
}) {
  const { geometry } = useMemo(() => growTree(baseY, topY), [baseY, topY]);
  const bark = useBark();

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow frustumCulled={false}>
      <meshPhysicalMaterial
        map={bark.map}
        normalMap={bark.normalMap}
        aoMap={bark.armMap}
        roughnessMap={bark.armMap}
        metalnessMap={bark.armMap}
        // Wood is dielectric. Metalness comes from the map's blue channel,
        // which the fetcher writes as zero, so this is belt and braces.
        metalness={0}
        roughness={1}
        aoMapIntensity={0.9}
        // Bark is not glossy, but it is not perfectly matte either - a little
        // sheen catches the rim light and stops the trunk reading as felt.
        sheen={0.25}
        sheenRoughness={0.9}
        sheenColor="#2f4a28"
        normalScale={NORMAL_SCALE}
        envMapIntensity={1.15}
      />
    </mesh>
  );
}

const NORMAL_SCALE = new THREE.Vector2(1.15, 1.15);

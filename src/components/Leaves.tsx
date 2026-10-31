"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { useLeaf } from "@/three/useMaterials";
import type { Tip } from "./ProceduralTree";
import { isFrozen } from "@/lib/debug";
import { useGraphics } from "./GraphicsProvider";

/**
 * The canopy: real leaves on instanced cards.
 *
 * This replaces a cloud of additive sprites. Sprites could never be photoreal
 * - they have no silhouette of their own, so a canopy built from them reads
 * as fog however it is tuned - whereas an alpha-cut card carries an actual
 * leaf outline and takes light from the same HDRI as the bark.
 *
 * One `InstancedMesh` of two triangles, so the whole canopy is a single draw
 * call. Each instance picks one of the nine leaves in the atlas through a
 * per-instance UV offset, which needs a shader edit: the stock material has
 * no notion of per-instance UVs. `onBeforeCompile` injects the attribute and
 * folds it into the UV before any map is sampled, so colour, normal and ARM
 * all land on the same leaf.
 */

const CARD_SIZE = 1.35;
/** How far a leaf may sit from its tip. */
const SPREAD = 1.9;

interface LeafProps {
  tips: Tip[];
  /** 0 normally; 1 when the timeline collapses into its reset. */
  implode: number;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function Leaves({ tips, implode }: LeafProps) {
  const leaf = useLeaf();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { budget } = useGraphics();

  // The canopy is almost the entire triangle count, so this is the lever that
  // brings a phone under the 120k budget: at the high tier the scene measures
  // ~193k triangles, which is inside the 300k desktop limit and well over the
  // mobile one. Cards are two triangles each, so the count scales linearly.
  const perTip = budget.leavesPerTip;
  const count = tips.length * perTip;

  // Scratch objects, reused every frame. Allocating a Matrix4 or a Vector3
  // inside useFrame is the single easiest way to hand the garbage collector
  // a stutter at 60fps.
  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
      euler: new THREE.Euler(),
      // Where everything converges during the reset implode. Held as a
      // constant rather than built per instance per frame.
      implodeTarget: new THREE.Vector3(0, 15, 0),
    }),
    [],
  );

  /**
   * Per-instance placement, generated once from a fixed seed.
   *
   * Stored as plain arrays rather than written straight into the instance
   * matrices, because the sway in useFrame needs the rest pose to animate
   * away from.
   */
  const layout = useMemo(() => {
    const random = mulberry32(90210);
    const origin = new Float32Array(count * 3);
    const rotation = new Float32Array(count * 3);
    const scale = new Float32Array(count);
    const phase = new Float32Array(count);
    const uvOffset = new Float32Array(count * 2);
    // Per-instance tint. Nine atlas cells across thousands of cards still
    // reads as one repeated sticker without it; real foliage varies leaf to
    // leaf, and the darker ones are what give the canopy interior depth.
    const tint = new Float32Array(count * 3);

    const cell = 1 / leaf.grid;
    let i = 0;
    for (const tip of tips) {
      for (let n = 0; n < perTip; n++) {
        // Cluster around the tip, biased along the branch direction so the
        // foliage trails the limb instead of balling up on its end.
        const along = random() * 1.5;
        const radius = SPREAD * Math.cbrt(random());
        const theta = random() * Math.PI * 2;
        const u = random() * 2 - 1;
        const s = Math.sqrt(1 - u * u);

        origin[i * 3] = tip.position.x + tip.direction.x * along + s * Math.cos(theta) * radius;
        origin[i * 3 + 1] = tip.position.y + tip.direction.y * along + u * radius * 0.7;
        origin[i * 3 + 2] = tip.position.z + tip.direction.z * along + s * Math.sin(theta) * radius;

        rotation[i * 3] = random() * Math.PI * 2;
        rotation[i * 3 + 1] = random() * Math.PI * 2;
        rotation[i * 3 + 2] = random() * Math.PI * 2;

        scale[i] = CARD_SIZE * (0.6 + random() * 0.85);
        phase[i] = random() * Math.PI * 2;

        // Biased dark: leaves deep in a canopy are shadowed by the ones above
        // them, which no amount of ambient occlusion on a flat card supplies.
        const shade = 0.42 + Math.pow(random(), 0.7) * 0.75;
        const warmth = 0.9 + random() * 0.25;
        tint[i * 3] = shade * warmth * 0.92;
        tint[i * 3 + 1] = shade;
        tint[i * 3 + 2] = shade * 0.6;

        const index = Math.floor(random() * leaf.grid * leaf.grid);
        uvOffset[i * 2] = (index % leaf.grid) * cell;
        uvOffset[i * 2 + 1] = Math.floor(index / leaf.grid) * cell;
        i += 1;
      }
    }

    return { origin, rotation, scale, phase, uvOffset, tint, cell };
  }, [tips, count, perTip, leaf.grid]);

  // The per-instance atlas cell, as an instanced attribute.
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.setAttribute(
      "aUvOffset",
      new THREE.InstancedBufferAttribute(layout.uvOffset, 2),
    );
    return plane;
  }, [layout]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Instance colours are static, so they are written once rather than in the
  // frame loop.
  useEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const colour = new THREE.Color();
    for (let i = 0; i < count; i++) {
      colour.setRGB(
        layout.tint[i * 3],
        layout.tint[i * 3 + 1],
        layout.tint[i * 3 + 2],
        THREE.SRGBColorSpace,
      );
      instanced.setColorAt(i, colour);
    }
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  }, [layout, count]);

  const material = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      map: leaf.map,
      normalMap: leaf.normalMap,
      roughnessMap: leaf.armMap,
      metalnessMap: leaf.armMap,
      metalness: 0,
      roughness: 1,
      // Cut-out, not blended: alphaTest keeps leaves in the depth buffer, so
      // they occlude each other correctly from any angle. Transparency would
      // need a per-frame sort of thousands of cards and still show seams.
      alphaTest: 0.45,
      transparent: false,
      side: THREE.DoubleSide,
      envMapIntensity: 1.0,
    });

    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           attribute vec2 aUvOffset;
           uniform float uCell;`,
        )
        // uv_vertex is where three computes vMapUv and friends, so folding the
        // offset in just before it means every map follows the same cell.
        .replace(
          "#include <uv_vertex>",
          `vec2 uvBackup = uv;
           #ifdef USE_MAP
             vMapUv = aUvOffset + uv * uCell;
           #endif
           #ifdef USE_NORMALMAP
             vNormalMapUv = aUvOffset + uv * uCell;
           #endif
           #ifdef USE_ROUGHNESSMAP
             vRoughnessMapUv = aUvOffset + uv * uCell;
           #endif
           #ifdef USE_METALNESSMAP
             vMetalnessMapUv = aUvOffset + uv * uCell;
           #endif`,
        );
      shader.uniforms.uCell = { value: 1 / leaf.grid };
    };
    // Changing onBeforeCompile after a program exists needs a new key.
    m.customProgramCacheKey = () => `leaf-atlas-${leaf.grid}`;
    return m;
  }, [leaf]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const instanced = mesh.current;
    if (!instanced) return;

    const { matrix, position, quaternion, scale, euler } = scratch;
    const time = isFrozen() ? 0 : state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const sway = Math.sin(time * 0.7 + layout.phase[i]) * 0.14;
      position.set(
        layout.origin[i * 3],
        layout.origin[i * 3 + 1],
        layout.origin[i * 3 + 2],
      );
      if (implode > 0) position.lerp(scratch.implodeTarget, implode);

      euler.set(
        layout.rotation[i * 3] + sway,
        layout.rotation[i * 3 + 1] + sway * 0.6,
        layout.rotation[i * 3 + 2],
      );
      quaternion.setFromEuler(euler);
      const size = layout.scale[i] * (1 - implode);
      scale.set(size, size, size);

      matrix.compose(position, quaternion, scale);
      instanced.setMatrixAt(i, matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, count]}
      castShadow
      frustumCulled={false}
    />
  );
}

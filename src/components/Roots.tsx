"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * The root mass the trunk stands in.
 *
 * Purely decorative - no event maps to a root - but the reference tree is
 * anchored in a tangle of them, and without it the trunk looks cut off at the
 * bottom of frame. Generated once from a fixed seed so it never re-shuffles.
 */

const ROOT_COUNT = 14;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function Roots({ baseY }: { baseY: number }) {
  const geometry = useMemo(() => {
    const rand = mulberry32(20260827);
    const parts: THREE.BufferGeometry[] = [];

    for (let i = 0; i < ROOT_COUNT; i++) {
      const azimuth = (i / ROOT_COUNT) * Math.PI * 2 + rand() * 0.4;
      const reach = 4 + rand() * 7;
      const drop = 2.5 + rand() * 4;

      // Each root leaves the trunk sideways, then dives and flattens out.
      const pts = [
        new THREE.Vector3(0, baseY + 1.2, 0),
        new THREE.Vector3(
          Math.cos(azimuth) * reach * 0.35,
          baseY - drop * 0.25,
          Math.sin(azimuth) * reach * 0.35,
        ),
        new THREE.Vector3(
          Math.cos(azimuth) * reach * 0.75,
          baseY - drop * 0.75,
          Math.sin(azimuth) * reach * 0.75,
        ),
        new THREE.Vector3(
          Math.cos(azimuth + 0.3) * reach,
          baseY - drop,
          Math.sin(azimuth + 0.3) * reach,
        ),
      ];

      const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
      parts.push(new THREE.TubeGeometry(curve, 36, 0.34 - i * 0.008, 8, false));
    }

    // One draw call for the whole tangle.
    const merged = parts[0].clone();
    const position: number[] = [];
    const normal: number[] = [];
    for (const g of parts) {
      position.push(...Array.from(g.attributes.position.array as Float32Array));
      normal.push(...Array.from(g.attributes.normal.array as Float32Array));
      g.dispose();
    }
    merged.dispose();

    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    out.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
    return out;
  }, [baseY]);

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshStandardMaterial
        color="#0a2f1f"
        emissive="#123f2a"
        emissiveIntensity={0.35}
        roughness={0.9}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

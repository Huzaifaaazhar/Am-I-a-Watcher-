"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

/**
 * The ground the tree stands on.
 *
 * Checklist item 4 says nothing floats, and contact shadows were the obvious
 * answer - except a contact shadow is a dark smudge, and this scene is a dark
 * void, so it landed on nothing and read as nothing. A shadow needs a surface
 * to fall on before it can ground anything.
 *
 * So: a large disc, dark enough to stay in the background but lit enough to take the key
 * light and the tree's shadow, dissolving radially into the void so it never
 * announces itself as a disc with an edge. The alpha ramp is injected into a
 * standard material rather than written as a custom shader, because a custom
 * shader would have to reimplement shadow receiving to get the one thing this
 * surface exists for.
 */

const RADIUS_SEGMENTS = 64;

export default function Ground({
  y,
  radius,
}: {
  y: number;
  radius: number;
}) {
  const geometry = useMemo(
    () => new THREE.CircleGeometry(radius, RADIUS_SEGMENTS),
    [radius],
  );

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: "#0a1a14",
      roughness: 0.96,
      metalness: 0,
      transparent: true,
      depthWrite: false,
    });

    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           varying float vRadial;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           // CircleGeometry is built in the XY plane before the mesh is laid
           // flat, so the radial distance is in x/y, not x/z.
           vRadial = length(position.xy);`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           varying float vRadial;
           uniform float uRadius;`,
        )
        .replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
           // Fade out well before the rim. Anything that reaches the edge
           // reads as a disc sitting in space, which is worse than floating.
           float edge = 1.0 - smoothstep(0.12, 0.92, vRadial / uRadius);
           gl_FragColor.a *= edge;`,
        );

      shader.uniforms.uRadius = { value: radius };
    };
    m.customProgramCacheKey = () => "ground-radial-fade";
    return m;
  }, [radius]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      frustumCulled={false}
    />
  );
}

"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

import {
  loadBark,
  loadLeaf,
  textureTier,
  type BarkMaps,
  type LeafMaps,
} from "./textures";

/**
 * Suspense-free texture hooks.
 *
 * `THREE.TextureLoader` fills a texture in place once the image arrives, so a
 * material can be built with it immediately and will repaint when it lands.
 * That avoids suspending the whole Canvas on a 2 MB bark set - the tree pops
 * in untextured for a frame or two rather than the page showing nothing.
 */

/** Bark repeats along the limb; see BARK_TILE in ProceduralTree. */
export function useBark(): BarkMaps {
  const tier = useMemo(() => textureTier(), []);
  const maps = useMemo(() => loadBark(tier), [tier]);

  useEffect(() => {
    // Occlusion is read from the red channel of the same packed map, so it
    // has to sample the same UV set as everything else. three defaults a
    // texture's channel to 0, but aoMap is the one map that has historically
    // wanted a second set, so it is pinned explicitly.
    maps.armMap.channel = 0;
  }, [maps]);

  return maps;
}

export function useLeaf(grid = 3): LeafMaps {
  const tier = useMemo(() => textureTier(), []);
  return useMemo(() => loadLeaf(tier, grid), [tier, grid]);
}

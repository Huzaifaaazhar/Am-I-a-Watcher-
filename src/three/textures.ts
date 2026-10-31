import * as THREE from "three";

/**
 * Texture loading, with the colour-space rules the realism checklist requires.
 *
 * This is the detail that quietly ruins a PBR render: albedo is sRGB-encoded
 * image data, while normal, roughness, AO and metalness are *numbers* that
 * happen to be stored in an image. Decode the latter as sRGB and every
 * surface in the scene is subtly wrong, in a way that reads as "cheap" rather
 * than as a bug. The split is enforced here so no call site has to remember.
 *
 * Every map exists at two budgets. Which one loads is decided once, from the
 * device, by `textureTier()`.
 */

/** `_2k` is 2048 (leaves 1024); `_1k` is half that. */
export type TextureTier = "2k" | "1k";

/**
 * Picks a texture budget for this device.
 *
 * Deliberately conservative: a wrong guess downward costs some sharpness, a
 * wrong guess upward costs VRAM on exactly the devices that have least of it.
 */
export function textureTier(): TextureTier {
  if (typeof window === "undefined") return "1k";

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const narrow = Math.min(window.screen.width, window.screen.height) < 768;

  if (narrow || cores <= 4 || memory <= 4) return "1k";
  return "2k";
}

const cache = new Map<string, THREE.Texture>();

interface LoadOptions {
  /** True for albedo and anything else that is a picture; false for data. */
  colour: boolean;
  /** Bark tiles; the leaf atlas must not. */
  repeat?: boolean;
  anisotropy?: number;
}

function load(
  loader: THREE.TextureLoader,
  url: string,
  { colour, repeat = false, anisotropy = 8 }: LoadOptions,
): THREE.Texture {
  const cached = cache.get(url);
  if (cached) return cached;

  const texture = loader.load(url);
  // The whole point of this module.
  texture.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;

  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  } else {
    // An atlas must clamp: wrapping samples the leaf on the opposite edge.
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  }

  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  cache.set(url, texture);
  return texture;
}

export interface BarkMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  /** AO in red, roughness in green, metalness in blue. */
  armMap: THREE.Texture;
}

export interface LeafMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  armMap: THREE.Texture;
  /** Cells per side of the atlas, read from the file the fetcher wrote. */
  grid: number;
}

export function loadBark(tier: TextureTier = textureTier()): BarkMaps {
  const loader = new THREE.TextureLoader();
  const base = `/textures/bark/`;
  return {
    map: load(loader, `${base}color_${tier}.webp`, { colour: true, repeat: true }),
    normalMap: load(loader, `${base}normal_${tier}.webp`, { colour: false, repeat: true }),
    armMap: load(loader, `${base}arm_${tier}.webp`, { colour: false, repeat: true }),
  };
}

export function loadLeaf(tier: TextureTier = textureTier(), grid = 3): LeafMaps {
  const loader = new THREE.TextureLoader();
  const base = `/textures/leaf/`;
  return {
    map: load(loader, `${base}atlas_${tier}.webp`, { colour: true }),
    normalMap: load(loader, `${base}atlas_normal_${tier}.webp`, { colour: false }),
    armMap: load(loader, `${base}atlas_arm_${tier}.webp`, { colour: false }),
    grid,
  };
}

/** The HDRI used for image-based lighting. Never drawn as a backdrop. */
export const HDRI_URL = "/hdr/kloofendal_misty_morning_1k.hdr";

/** Frees everything this module has cached. Call on scene teardown. */
export function disposeTextures(): void {
  for (const texture of cache.values()) texture.dispose();
  cache.clear();
}

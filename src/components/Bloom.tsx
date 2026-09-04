"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Bloom, tone mapping and vignette, run as a small post chain.
 *
 * The reference art glows: light bleeds out of the trunk and the canopy sits
 * in a haze. None of that survives a straight forward render, which is why
 * the tree read as hard plastic however the bark was shaded. This renders the
 * scene to a target, blurs its highlights, adds them back, and only then
 * converts to display space.
 *
 * That last part matters beyond the glow. The scene's custom shaders write
 * linear colour and were previously going to the screen unconverted, so every
 * colour landed far darker than its hex - the tree kept having to be
 * brightened by hand to compensate. With the conversion done once here, the
 * palette means what it says.
 *
 * Runs at useFrame priority 1, which takes the render loop over from R3F.
 */

const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** Keeps only what is bright enough to glow. */
const BRIGHT_FRAG = /* glsl */ `
  uniform sampler2D uScene;
  uniform float uThreshold;
  uniform float uKnee;
  varying vec2 vUv;

  void main() {
    vec3 c = texture2D(uScene, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // Soft knee, so a surface drifting past the threshold does not pop.
    float k = smoothstep(uThreshold, uThreshold + uKnee, l);
    gl_FragColor = vec4(c * k, 1.0);
  }
`;

/** Separable 9-tap gaussian; run once per axis. */
const BLUR_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uStep;
  varying vec2 vUv;

  void main() {
    vec3 sum = texture2D(uTex, vUv).rgb * 0.227027;
    sum += (texture2D(uTex, vUv + uStep * 1.3846154).rgb
          + texture2D(uTex, vUv - uStep * 1.3846154).rgb) * 0.3162162;
    sum += (texture2D(uTex, vUv + uStep * 3.2307692).rgb
          + texture2D(uTex, vUv - uStep * 3.2307692).rgb) * 0.0702703;
    gl_FragColor = vec4(sum, 1.0);
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D uScene;
  uniform sampler2D uBloomNear;
  uniform sampler2D uBloomFar;
  uniform float uStrength;
  uniform float uVignette;
  varying vec2 vUv;

  // Linear -> sRGB. The scene is composited in linear light and converted
  // exactly once, here.
  vec3 toSRGB(vec3 c) {
    return mix(
      c * 12.92,
      1.055 * pow(max(c, vec3(0.0)), vec3(0.41666)) - 0.055,
      step(0.0031308, c));
  }

  void main() {
    vec3 base = texture2D(uScene, vUv).rgb;
    // Two blur radii: the tight one keeps edges luminous, the wide one gives
    // the whole canopy its haze.
    vec3 glow = texture2D(uBloomNear, vUv).rgb * 0.7
              + texture2D(uBloomFar, vUv).rgb * 0.55;

    vec3 c = base + glow * uStrength;

    // Reinhard only on the part above white, so midtones keep their contrast
    // and the bloom rolls off instead of clipping to a flat white blob.
    c = c / (1.0 + max(vec3(0.0), c - 1.0));

    // Painterly falloff into the corners.
    vec2 d = vUv - 0.5;
    float vig = 1.0 - uVignette * smoothstep(0.16, 0.78, dot(d, d));
    c *= vig;

    gl_FragColor = vec4(toSRGB(c), 1.0);
  }
`;

function makeTarget(width: number, height: number, depth = false) {
  const target = new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    // Half float keeps highlights above 1.0 available to the bright pass;
    // clamping them to 8-bit first would flatten the glow.
    type: THREE.HalfFloatType,
    // Must be set at construction: three allocates the framebuffer from these
    // options, and assigning depthBuffer afterwards silently leaves the target
    // without depth - which drew far geometry straight over the trunk.
    depthBuffer: depth,
  });
  target.texture.generateMipmaps = false;
  return target;
}

export default function Bloom({
  strength = 0.3,
  threshold = 0.82,
  vignette = 0.4,
}: {
  strength?: number;
  threshold?: number;
  vignette?: number;
}) {
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);

  const width = Math.max(1, Math.round(size.width * dpr));
  const height = Math.max(1, Math.round(size.height * dpr));

  const chain = useMemo(() => {
    const quadScene = new THREE.Scene();
    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    quad.frustumCulled = false;
    quadScene.add(quad);

    const bright = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: BRIGHT_FRAG,
      uniforms: {
        uScene: { value: null },
        uThreshold: { value: threshold },
        uKnee: { value: 0.35 },
      },
      depthTest: false,
      depthWrite: false,
    });

    const blur = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: BLUR_FRAG,
      uniforms: { uTex: { value: null }, uStep: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
    });

    const composite = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        uScene: { value: null },
        uBloomNear: { value: null },
        uBloomFar: { value: null },
        uStrength: { value: strength },
        uVignette: { value: vignette },
      },
      depthTest: false,
      depthWrite: false,
    });

    return { quadScene, quadCamera, quad, bright, blur, composite };
  }, [threshold, strength, vignette]);

  // Scene target carries depth; the blur targets do not need it.
  const targets = useMemo(() => {
    return {
      scene: makeTarget(width, height, true),
      nearA: makeTarget(width >> 1, height >> 1),
      nearB: makeTarget(width >> 1, height >> 1),
      farA: makeTarget(width >> 2, height >> 2),
      farB: makeTarget(width >> 2, height >> 2),
    };
  }, [width, height]);

  useEffect(() => {
    return () => {
      for (const t of Object.values(targets)) t.dispose();
    };
  }, [targets]);

  useEffect(() => {
    return () => {
      chain.quad.geometry.dispose();
      chain.bright.dispose();
      chain.blur.dispose();
      chain.composite.dispose();
    };
  }, [chain]);

  useFrame(({ gl, scene, camera }) => {
    const { quadScene, quadCamera, quad, bright, blur, composite } = chain;

    const draw = (
      material: THREE.ShaderMaterial,
      target: THREE.WebGLRenderTarget | null,
    ) => {
      quad.material = material;
      gl.setRenderTarget(target);
      gl.render(quadScene, quadCamera);
    };

    gl.setRenderTarget(targets.scene);
    gl.clear();
    gl.render(scene, camera);

    bright.uniforms.uScene.value = targets.scene.texture;
    draw(bright, targets.nearA);

    // Tight glow: one horizontal and one vertical pass at half resolution.
    const halfW = Math.max(1, width >> 1);
    const halfH = Math.max(1, height >> 1);
    blur.uniforms.uTex.value = targets.nearA.texture;
    blur.uniforms.uStep.value.set(1 / halfW, 0);
    draw(blur, targets.nearB);
    blur.uniforms.uTex.value = targets.nearB.texture;
    blur.uniforms.uStep.value.set(0, 1 / halfH);
    draw(blur, targets.nearA);

    // Wide haze: the same again at quarter resolution, twice over, which is
    // far cheaper than widening the kernel.
    const quarterW = Math.max(1, width >> 2);
    const quarterH = Math.max(1, height >> 2);
    blur.uniforms.uTex.value = targets.nearA.texture;
    blur.uniforms.uStep.value.set(1 / quarterW, 0);
    draw(blur, targets.farA);
    blur.uniforms.uTex.value = targets.farA.texture;
    blur.uniforms.uStep.value.set(0, 1 / quarterH);
    draw(blur, targets.farB);
    blur.uniforms.uTex.value = targets.farB.texture;
    blur.uniforms.uStep.value.set(2 / quarterW, 0);
    draw(blur, targets.farA);
    blur.uniforms.uTex.value = targets.farA.texture;
    blur.uniforms.uStep.value.set(0, 2 / quarterH);
    draw(blur, targets.farB);

    composite.uniforms.uScene.value = targets.scene.texture;
    composite.uniforms.uBloomNear.value = targets.nearA.texture;
    composite.uniforms.uBloomFar.value = targets.farB.texture;
    draw(composite, null);
  }, 1);

  return null;
}

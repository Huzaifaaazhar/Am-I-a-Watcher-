# AM I A WATCHER — build rules

Interactive timeline causality engine. Loki/TVA fan project, built as a video reel piece.
Quality bar: **studio-made interactive site, not a tutorial.**

## Commands

| | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run test` | typecheck → lint → evals. Run before every commit |
| `npm run shots` | Visual QA: screenshots every route at 390×844 and 1440×900 into `/shots` |
| `npm run eval` | Causality engine eval harness (threshold 95%) |
| `npm run typecheck` / `npm run lint` | Individually |

`npm run shots` starts its own dev server, pins the animation clock, and fails the run on any
page error or horizontal overflow. It needs Playwright; it resolves a global install via CJS,
otherwise `npm i -D playwright && npx playwright install chromium`.

## How to work

1. **Phases.** Each ends deployable. Don't start the next until the current one passes.
2. **You must SEE your work.** Never judge 3D or UI from code alone. Run `npm run shots`, open
   the PNGs, write a 3-bullet critique against `/design-refs/` and the realism checklist below.
   Minimum 3 critique-and-fix rounds per hero scene and main screen.
3. **Never guess library APIs.** Read the installed `.d.ts` in `node_modules`, or use Context7.
   Pin versions. (This repo has already been bitten: a render target was built without a depth
   buffer because `depthBuffer` was assigned after construction, where three ignores it.)
4. **No placeholders that ship.** No lorem ipsum, grey boxes, emoji icons, default browser fonts.
5. One line per non-obvious choice in `docs/DECISIONS.md`.

## Stack

Next.js 14 App Router · TypeScript · Tailwind + CSS variables · three 0.169 + @react-three/fiber 8
· drei · @react-three/postprocessing · framer-motion (UI) · GSAP (camera timelines) · zod
· pino + @prometheus-io/client (observability) · Playwright (visual QA)

Causality engine is **local and procedural** — nearest-centroid domain classifier over 9 lexicons,
weighted CFG, seeded PRNG. No hosted LLM. Optional Ollama provider behind the same interface.

## Design tokens

Sampled from `/design-refs/`. Source of truth is `tailwind.config.ts`; Phase 4 moves these to
CSS variables.

```
hud.green   #0B4A34   chrome ground      brass      #E8C34A   rules, headings
hud.greenDark #06331F  recesses          weave      #10B981   live timeline
hud.panel   #0E5138   raised panels      warn       #F0A020   deviation
hud.black   #050807   nav blocks         pill.blue  #2E7BA6   Branch action
ash         #EDEAE0   body copy          pill.red   #B03A2E   Prune action
```

Type scale: 12 / 14 / 16 / 20 / 28 / 40 / 56 / 72. Headline line-height ~0.95, line length < 70ch.
Uppercase + wide tracking for short labels only; sentence case beyond 4 words.
Fonts: Bitter (display) + JetBrains Mono — both OFL. **Self-host via `next/font`.**

Avoid AI tells: accent-coloured random word in every headline, an eyebrow over every section,
`→` on every button.

## 3D realism checklist — every scene passes ALL

1. `ACESFilmicToneMapping`, `outputColorSpace = SRGBColorSpace`. Colour textures sRGB;
   normal/roughness/metalness maps linear.
2. **Image-based lighting always on.** Never only ambient + one directional light.
3. **PBR with variation.** Roughness maps or noise, never one flat value. Metals `metalness: 1`
   + env map. `MeshPhysicalMaterial` for metal/varnish/glass; `sheen` for fabric.
4. **Everything grounded.** `ContactShadows` or `AccumulativeShadows`. Nothing floats.
5. **Bevel everything.** `RoundedBox`, bevelled extrudes, chamfered lathe profiles. No razor edges.
6. **Camera:** FOV 30–40° for hero shots, real-world scale.
7. **Depth cues:** light fog, DoF on hero shots only, foreground/mid/background layers, dust motes.
8. **Restrained post:** SMAA, high-threshold bloom, soft vignette, light grain. If it screams
   "effects", reduce.
9. **Imperfection:** micro-scratches, slight asymmetry, smudges.
10. **Motion has weight:** springs with overshoot and settle. Never linear.

Art direction note: the reference is a painted Yggdrasil. The decision on record is **literal
photoreal** (`docs/DECISIONS.md`), so the checklist applies as written. The painterly bark
shader has been deleted rather than disabled — under a real light rig, painting light into a
surface is double-lighting.

Light rig: one HDRI (`Environment`) plus **one** real-time shadow-casting directional, per the
budget. The scene has a faded ground disc because a contact shadow needs a surface to land on;
in a void it grounds nothing.

## Performance budgets

| | Desktop | Mobile |
|---|---|---|
| Draw calls | < 150 | < 80 |
| Triangles | < 300k | < 120k |
| Target | 60 fps | ≥ 45 fps mid-range Android |

Initial 3D chunk < 500 KB gzipped (excluding assets). `dpr` capped `[1, 2]` desktop /
`[1, 1.75]` mobile, stepped down by `PerformanceMonitor`. Expose Graphics: Auto / High / Low.

- **No allocation inside `useFrame`.** Reuse vectors. Dispose geometries/materials/textures on
  unmount. Instance repeats. Max 1 real-time shadow light; bake the rest.
- **Fallback:** no WebGL, `prefers-reduced-motion`, or low-end (`hardwareConcurrency <= 4` plus
  an fps probe) → pre-rendered poster with light CSS parallax. **The app must work fully
  without 3D.**

Live counters: `/dev/scenes`. Component states: `/dev/gallery`. Both 404 in production.

**Read fps from real hardware only.** Cloud containers have no GPU and fall back to SwiftShader,
where this scene reports ~1 fps. Draw calls, triangles and memory counts are accurate there;
frame rate is not. Judge fps on a real device.

## Assets — CC0 / CC-BY only

| Need | Source |
|---|---|
| HDRIs | Poly Haven (`api.polyhaven.com`), 1k/2k `.hdr` → `public/hdr/` |
| PBR textures | Poly Haven, ambientCG (`ambientcg.com/api/v2`) |
| Models | Poly Haven, Quaternius, Kenney (CC0); Sketchfab filtered to downloadable + CC-BY |

Prefer procedural geometry + good PBR materials for hero objects — this project has no GLBs at
all, the tree is generated. Compress any GLB that does arrive with gltf-transform
(Draco/Meshopt + KTX2) and preload with `useGLTF.preload`.

Assets are fetched and processed by `python3 scripts/fetch_assets.py` (needs Pillow + numpy),
which also generates `public/ASSETS.md` from the same manifest — so the licence record cannot
drift from what shipped. **Never add an asset by hand; add it to the manifest and re-run.**

Every texture exists at `_2k` (2048; leaves 1024) and `_1k`, picked at runtime by
`textureTier()` in `src/three/textures.ts`. That module also enforces the colour-space split
from checklist item 1 — albedo sRGB, normal/ARM linear — so no call site has to remember it.
AO and roughness ship packed as ARM (AO red, roughness green, metalness blue).

KTX2 is *not* in use: it needs the KTX-Software or Basis encoder and neither is available in
this environment. WebP is the fallback. If `toktx` ever is available, that is the upgrade.

No official or copyrighted font, logo or film asset is reproduced. Drop-in points are marked
`// FAN ASSET SLOT`.

## Skills and tools

`frontend-design` — load before building any UI. `webapp-testing` — Playwright patterns.
Both vendored in `.claude/skills/` (Apache-2.0, from `anthropics/skills`) so they survive
container recycling. `security-preflight` before any deploy.

MCP: `playwright` (browser driving), `context7` (current library docs) — see `.mcp.json`.

## Accessibility

Visible `focus-visible` everywhere. `prefers-reduced-motion` respected. WCAG AA contrast.
Screen-reader labels on icon-only controls. Never block pinch-zoom. Non-3D fallback for every
3D moment. Mobile-first: design at 390×844, primary actions in the bottom 40%, respect
safe-area insets. LCP < 2.5 s on mid-range Android over 4G.

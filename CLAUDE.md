# AM I A WATCHER — build rules

Interactive timeline causality engine. Loki/TVA fan project, built as a video reel piece.
The Sacred Timeline is a painting with a live, interactive SVG over it - not a 3D scene.
Quality bar: **studio-made interactive site, not a tutorial.**

## Commands

| | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run test` | typecheck → lint → evals. Run before every commit |
| `npm run shots` | Visual QA: every route and state at 7 viewports, 320→1920, into `/shots` |
| `npm run eval` | Causality engine eval harness (threshold 95%) |
| `python3 scripts/process_art.py` | Rebuild `public/art/` and `public/ASSETS.md` from `art-src/` |
| `npm run typecheck` / `npm run lint` | Individually |

`npm run shots` starts its own dev server, pins the animation clock, drives each screen into
the state worth photographing (select, branch, prune, nav) and fails the run on any page error,
horizontal overflow, or unresolved design token. It names the elements that spill. A clean run
is necessary, not sufficient - open the PNGs.
Layout breakpoints: the sidebar docks at `lg` and the event rail with it; below that they are a
drawer and a bottom sheet. It needs Playwright; it resolves a global install via CJS,
otherwise `npm i -D playwright && npx playwright install chromium`.

## How to work

1. **Phases.** Each ends deployable. Don't start the next until the current one passes.
2. **You must SEE your work.** Never judge the canvas or the UI from code alone, and never
   from a clean harness run: the harness has twice reported "clean" on a screen that was
   visibly broken - once with the chrome rendering black, once with the painting sliced in
   half and its overlay 300px out of register. Run `npm run shots`, open the PNGs, write a
   3-bullet critique against `/design-refs/`. Minimum 3 critique-and-fix rounds per screen.
3. **Never guess library APIs.** Read the installed `.d.ts` in `node_modules`, or use Context7.
   Pin versions. (This repo has already been bitten: a render target was built without a depth
   buffer because `depthBuffer` was assigned after construction, where three ignores it.)
4. **No placeholders that ship.** No lorem ipsum, grey boxes, emoji icons, default browser fonts.
5. One line per non-obvious choice in `docs/DECISIONS.md`.

## Stack

Next.js 14 App Router · TypeScript · Tailwind + CSS variables · framer-motion (panels and
sheets) · zod · pino + @prometheus-io/client (observability) · Playwright (visual QA)

No 3D. The canvas is the supplied painting with a transparent, interactive SVG over it - three,
drei, postprocessing and GSAP were removed in Phase 6 along with the texture pipeline. If a
future change wants them back they are in git at `27dde48`, but read `docs/DECISIONS.md` first.

Causality engine is **local and procedural** — nearest-centroid domain classifier over 9
lexicons, weighted CFG, seeded PRNG. No hosted LLM. Optional Ollama provider behind the same
interface.

## Design tokens

Sampled from `/design-refs/`. Source of truth is `:root` in `globals.css`, as space-separated
RGB channels; `tailwind.config.ts` composes them with `rgb(var(--x) / <alpha-value>)`. **Never
put a hex string in one of those variables** — it compiles and silently kills every opacity
modifier in the app.

```
hud.green   #0B4A34   chrome ground      brass      #E8C34A   rules, headings
hud.greenDark #06331F  recesses          weave      #10B981   live timeline
hud.panel   #0E5138   raised panels      warn       #F0A020   deviation
hud.black   #050807   nav blocks         pill.blue  #2E7BA6   Branch action
ash         #EDEAE0   body copy          pill.red   #B03A2E   Prune action
```

Colours are CSS custom properties in `globals.css`; `tailwind.config.ts` reads them, so each
has one definition. The type scale is named by role, not size — `micro` `meta` `body` `lead`
`title` `display` `hero` `colossal` `monolith`. Headline line-height ~0.95, line length < 70ch.
Uppercase + wide tracking for short labels only; sentence case beyond 4 words.

Fonts: Bitter (display) + JetBrains Mono, both OFL, self-hosted via `next/font` — do not
reintroduce a CDN link, the CSP no longer allows one.

Icons: `src/components/icons`, 24px grid, square caps, mitred joins. No icon library.
Actions: `src/components/ui/Button` — never hand-roll a button's states again.

Avoid AI tells: accent-coloured random word in every headline, an eyebrow over every section,
`→` on every button.

Panels: `src/components/ui/Panel` is the only panel chrome - hairline gold frame, corner
brackets, rule under the heading. Never hand-roll a bordered surface.

Tailwind's opacity modifiers only accept the values in the default scale. `bg-hud-green/92`
compiles to nothing at all, and the surface renders fully transparent. Use multiples of five.

## The canvas — every change passes ALL

The Sacred Timeline canvas is one painting (`public/art/world-tree_*.webp`) with an SVG overlay
on top of it. `src/lib/treeMap.ts` holds the geometry, `src/lib/useStage.ts` the fit,
`src/components/WorldTree.tsx` the rendering.

1. **The painting is the subject.** The overlay is hairlines and markers inside the artwork's
   own light. Never draw a second tree over a picture of a tree - that is what three earlier
   attempts produced and it always reads as two misaligned trees.
2. **One box fits all three layers.** Image, SVG and labels are positioned from the single box
   `useStage` returns. Never fit the image with `object-fit` and the overlay with anything
   else; alignment has to be structural, not maintained.
3. **Art space is the only coordinate system.** viewBox `0 0 1000 563`, matching the painting's
   aspect. Nothing in `treeMap.ts` may know about pixels or breakpoints.
4. **The fit is cover, clamped by a safe rectangle.** The outermost limbs are the interface;
   cropping them off a portrait canvas is a broken screen, not a tight crop.
5. **Every branch is independently selectable**, with its own hit path, and the trunk is split
   into one hit segment per event. One rectangle over the whole tree is not an interaction.
6. **The hit area and the visible stroke are separate paths.** ~34 art units of transparent
   stroke behind a 2-unit hairline: `pointer-events="stroke"` responds to the stroke area
   whatever its paint.
7. **Animation is CSS, not a frame loop.** Dash offsets, opacity and transforms only; anything
   that needs `requestAnimationFrame` to animate the overlay is the wrong approach.
8. **Restraint.** Slow pulses, a sap flow in the trunk, a drifting mote field. If it flashes,
   strobes or competes with the painting, cut it.
9. **Reduced motion stops all of it** (`globals.css`, one media query at the foot), without
   changing the layout or removing a single control.
10. **Nothing destructive happens without confirmation**, and destruction is animated: the limb
    dissolves on screen before it leaves the graph.

Art direction: the reference is the supplied watercolour Yggdrasil and the two TVA interface
screens in `/design-refs/`. The decision on record (`docs/DECISIONS.md`) is that the artwork is
the canvas, generated geometry never is.

## Performance budgets

| | Desktop | Mobile |
|---|---|---|
| First load JS (`/`) | < 200 KB | < 200 KB |
| Shipped art | < 200 KB | < 60 KB (the 1k plate) |
| Animated SVG nodes | < 120 | < 120 |
| LCP over 4G | < 2.5 s | < 2.5 s |

- **No `requestAnimationFrame` for the tree.** The overlay animates on the compositor; the one
  canvas loop left in the app is the deviation rain, which only runs while a branch is being
  processed.
- The painting is served at two sizes, picked by `srcSet`/`sizes`. A phone must never fetch the
  2k plate.
- **Fallback:** `?flat=1` renders `FlatTimeline`, a real operable list driving the same
  selection state and the same action panel. It is no longer a capability gate - every browser
  can render a picture - but it stays, because it is the right shape for a screen reader and
  the fastest way to read a 40-event graph.

Component states: `/dev/gallery`. 404s in production.

## Assets — supplied artwork and CC0 only

The world tree painting is fan artwork supplied by the project owner. The source lives in
`art-src/`; `python3 scripts/process_art.py` (needs Pillow) derives `public/art/*.webp` and
regenerates `public/ASSETS.md` from the same manifest, so the licence record cannot drift from
what shipped. **Never add an asset by hand; add it to the script and re-run.**

Two derivatives per image: `_2k` (2x, Lanczos plus a light unsharp pass, because the canvas is
displayed well above the source's native size) and `_1k` (native, for phones). WebP, quality
88 - the painting is all soft gradients, which is what lossy WebP is good at.

The animated GIF that came with the artwork is deliberately not shipped: 540x450 and 10 MB,
a third of the pixels the canvas needs and more weight than the rest of the app.

No official or copyrighted font, logo or film asset is reproduced. Drop-in points are marked
`// FAN ASSET SLOT`.

## Skills and tools

`frontend-design` — load before building any UI. It lists all-caps labels and mono data type
as generic tells; here they are brief-mandated TVA vernacular and stay. `webapp-testing` — Playwright patterns.
Both vendored in `.claude/skills/` (Apache-2.0, from `anthropics/skills`) so they survive
container recycling. `security-preflight` before any deploy.

MCP: `playwright` (browser driving), `context7` (current library docs) — see `.mcp.json`.

## Accessibility

Visible `focus-visible` everywhere. `prefers-reduced-motion` respected. WCAG AA contrast.
Screen-reader labels on icon-only controls. Never block pinch-zoom. Every branch and trunk
segment is a focusable control with a label, and `?flat=1` is the list equivalent of the whole
canvas. Mobile-first: design at 390×844, primary actions in the bottom 40%, respect safe-area
insets. LCP < 2.5 s on mid-range Android over 4G.

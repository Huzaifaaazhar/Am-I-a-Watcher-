# Decisions

One line per non-obvious choice, newest last. Why, not what — the diff says what.

## Engine

- **Local procedural causality engine, no hosted LLM.** Requested explicitly; also makes the
  eval harness deterministic and the app free to run.
- **Nearest-centroid bag-of-words classifier over 9 lexicons**, not embeddings — no model
  weights to ship, and the chosen lexicon is inspectable when a cascade reads wrong.
- **Subject extraction prefers the last head-able token that is in the classifier vocabulary.**
  Plain head-final extraction returned "century earlier" for "penicillin was discovered a
  century earlier".
- **`detectInjection()` + in-world substitute subjects.** An eval caught the engine echoing
  "system prompt" back as a historical subject.
- **Ollama kept behind the same interface** with shape-parse → normalise → validate → retry →
  fall back to procedural, so a bad local model degrades instead of breaking.

## Rendering

- **Hand-written orbit rig and bloom chain (superseded).** The original brief ruled out addon
  libraries. Reversed — see "drei adopted" below.
- **Procedural tree geometry rather than a downloaded GLB.** Timeline events number ~9, so a
  data-driven tree is a bare stick; the woody mass has to be generated. Also what the asset
  rules prefer for hero objects.
- **Hand-built tapered tubes instead of `TubeGeometry`.** Constant radius reads as plumbing;
  taper is most of what makes a shape read as a tree.
- **Per-ring `aAxis` / `aAngle` vertex attributes.** Gives bark a lengthwise UV, so ridges run
  along the limb instead of noise being smeared over a smooth surface. Doubles as the UV
  channel for real bark textures.
- **Canopy blends normally, not additively.** Additive motes at canopy density sum past white
  however low the alpha goes; the crown kept turning into a featureless blob.
- **Colour-space conversion happens once, in the composite pass.** The custom shaders write
  linear and were reaching the screen unconverted, so every colour landed far darker than its
  hex and was being hand-brightened to compensate.
- **Camera distance is computed in the rig, not the fit function.** It depends on viewport
  aspect, which only the rig can see; fitting on height alone pushed the crown off both sides
  of a portrait phone.
- **Label chips are the click target, not the gold beads.** The beads project to ~3px, which
  nobody can hit, least of all with a thumb.
- **Backdrop sphere radius 600 against a far plane of 2000.** At 340/400 the far plane sliced
  it and the cut followed its low-poly hull — a hard octagonal edge across the frame.

## 2026-10-31 — adopting the studio build standard

- **drei + @react-three/postprocessing adopted**, reversing the no-addons constraint. They
  supply `Environment`, `ContactShadows`, `AdaptiveDpr`, `PerformanceMonitor` and a correct
  `SMAA` pass; the hand-rolled render target had silently cost MSAA and shipped a depth-buffer
  bug.
- **Literal photoreal over painterly.** Flagged that the reference is a watercolour and that
  full PBR would undo the match; decision taken to go photoreal regardless. The painterly bark
  shader is replaced with `MeshPhysicalMaterial` and real maps.
- **Skills vendored into `.claude/skills/` rather than `~/.claude/`.** Cloud containers are
  recycled — this one had already lost its entire working tree once — so project-local is the
  only placement that survives and that a clone inherits.
- **`npm run shots` drives the dev server, not `next start`.** `/dev/*` is deliberately
  unreachable in production, so a production server could never photograph it.
- **Playwright resolved through `createRequire`, not `await import()`.** ESM resolution ignores
  `NODE_PATH` and global roots, so a machine-level Playwright is invisible to it.
- **`?freeze=<seconds>` pins the clock and completes growth animations.** Two runs of the same
  commit have to produce the same pixels or comparing screenshots proves nothing.
- **Freeze runs at `useFrame` priority -1000.** Verified in the installed R3F source that the
  auto-render gate counts only subscriptions with priority > 0, so a negative priority runs
  first without disabling rendering.
- **`/dev/*` guarded by `NODE_ENV` in a layout.** Inlined at build time, so it cannot be flipped
  by a request header or a host environment variable.
- **Shots that depend on reducer state link into the real app** instead of being rebuilt on
  `/dev/scenes`, which would let the dev page drift from what ships and still look right.

## Phase 1 — assets

- **Assets are fetched by a script, never by hand**, and `public/ASSETS.md` is generated from
  the same manifest. A licence record maintained separately from the fetch drifts the first
  time someone swaps a texture.
- **Lossy WebP everywhere, quality per map type**, after lossless was tried and failed: a
  photographic normal map has noise in every pixel, so lossless finds nothing to exploit and
  the 2048 normal came out at 7.3 MB on its own. The full set was 23 MB; it is now 7.1.
- **AO + roughness packed into one ARM texture**, the glTF convention — halves the fetches and
  the texture units versus two single-channel files.
- **Leaf cards come from a purpose-built cut-out atlas (ambientCG LeafSet024), not from
  segmenting a photoscanned plant.** The segmentation approach was built and abandoned: every
  leaf on a plant sheet belongs to one connected UV island, so the largest region is the whole
  plant, and the crops came out as clumps streaked with atlas padding.
- **The atlas grid is detected from the opacity channel, not hardcoded.** Projecting alpha onto
  each axis gives one band per leaf; hardcoding 3 would silently mis-slice a swapped atlas.
- **Leaves cap at 1024/512** rather than the standard 2048/1024. They are never more than a few
  dozen pixels on screen, so the extra detail is unresolvable weight.
- **A misty-morning HDRI, not a bright forest.** It is for image-based lighting only and is
  never drawn as a backdrop; soft wraparound light flatters bark without fighting a dark HUD.

## Phase 2 — photoreal

- **The painterly bark shader is deleted, not disabled.** It painted light into the surface -
  heartwood glow, crevice bleed, a silhouette ramp - and under a real light rig that is
  double-lighting. Photoreal means there is nowhere left to cheat.
- **UVs are built from real distances**, circumference around the ring and length along the
  limb, so texel density is constant from trunk to twig. Normalised 0..1 UVs would stretch one
  bark tile around a two-metre trunk and a two-centimetre twig alike.
- **Rings are closed with a duplicate vertex** rather than wrapping the index back to zero, so
  the seam quad gets a real `u` instead of smearing the whole texture across itself.
- **One ARM texture is wired to aoMap, roughnessMap and metalnessMap.** three reads occlusion
  from red, roughness from green and metalness from blue, so one packed map drives all three
  at the cost of a single texture unit.
- **Leaves are alpha-cut instanced cards, not sprites.** A sprite has no silhouette, so a
  canopy built from them reads as fog however it is tuned. `alphaTest` rather than
  transparency keeps them in the depth buffer, so they occlude each other correctly from any
  angle without a per-frame sort of thousands of cards.
- **Per-instance atlas cell via `onBeforeCompile`.** The stock material has no notion of
  per-instance UVs; the offset is folded in at `uv_vertex`, before any map is sampled, so
  colour, normal and ARM all land on the same leaf.
- **Per-instance tint, biased dark.** Nine atlas cells across thousands of cards still reads as
  one repeated sticker, and leaves deep inside a canopy are shadowed by the ones above them -
  which no amount of AO on a flat card supplies.
- **A ground plane, because a contact shadow needs somewhere to land.** Item 4 says nothing
  floats and contact shadows are the obvious answer, but this scene is a dark void: the shadow
  rendered onto nothing and grounded nothing. The disc fades radially so it never reads as a
  disc with an edge.
- **ContactShadows bakes continuously, not once.** `frames={1}` bakes on the first render,
  which happens before the bark and leaf textures arrive, so it captured an empty scene.
- **Tone mapping happens once, as the last effect.** Renderer tone mapping is off; leaving both
  on maps twice and crushes exactly the highlights the bloom exists to find.
- **High bloom threshold (0.85).** Bloom is for things that are actually emitting - the gold
  vein and the event beads - not for fogging the frame.
- **FOV 42 to 36.** A wide lens is the fastest way to make a large object read as a toy.

Carried to Phase 3: the canopy puts the scene at ~193k triangles. Inside the 300k desktop
budget, over the 120k mobile one, so leaf count has to scale with the texture tier.

## Phase 3 — budgets and fallback

- **Three capability questions, kept separate.** Can it do WebGL, has the person asked for
  reduced motion, and is the hardware weak. The first two are hard gates; the third only picks
  a quality tier, because weak hardware should get a smaller scene, not a worse product.
- **Reduced motion falls back to the flat view rather than stilling the camera.** The tree
  breathes and sways continuously; a stilled camera is still a moving object. A still frame of
  it is a photograph, which is what the flat mode shows.
- **The flat view is a real, operable timeline, not a poster.** "Works fully without 3D" cannot
  mean an image: the entire interaction is selecting an event and acting on it, and in the
  scene the only way to do that is to click a label the camera placed. It drives the same
  selection state and the same action panel.
- **The chosen setting and the tier in force are separate values.** On Auto the tier is
  corrected by measured frame rate; if someone picks High explicitly, the measurement must not
  quietly override them.
- **Leaf count is the tier lever.** The canopy is almost the whole triangle count, so cards per
  tip is what brings a phone under 120k - 7 at high, 3 at low.
- **The post chain is built as an array, not with conditional children.** EffectComposer types
  its children as elements, so `{flag && <Effect/>}` does not typecheck; building the list
  keeps the tier switch honest instead of reaching for a cast.
- **Projector pools its candidate objects and sorts in place.** It allocated an array plus an
  object per label per frame - about two hundred short-lived objects a frame at 60fps.
  `slice()` to sort a subrange would reintroduce exactly that, so it uses an insertion sort,
  which needs no scratch space and runs near-linear on a nearly-sorted list.
- **`?flat=1` forces the fallback**, because otherwise it is only reachable on a machine that
  genuinely cannot do WebGL, and would never be looked at again after the day it was written.
  It reports its own reason rather than borrowing one of the real ones.
- **The shots harness uses a browser per viewport and retries a capture once.** Chromium
  intermittently refuses a screenshot after several WebGL-heavy pages in one process - renderer
  memory pressure, not a page fault.

## Phase 4 — UI system

- **Fonts self-hosted via next/font.** The CDN link cost a preconnect, a stylesheet round trip
  and a font round trip before any text could paint, leaked every visitor to a third party, and
  forced the CSP to allow two Google origins. All three problems go away together and the CSP
  tightens to 'self'.
- **`maximumScale: 1` removed.** It silently took magnification away from anyone who needs it,
  and the canvas has its own gesture handling, so it was never buying anything. `viewportFit:
  cover` added so the safe-area variables actually resolve.
- **Colour tokens live in `:root` and Tailwind reads them**, as space-separated RGB channels
  composed with `rgb(var(--x) / <alpha-value>)`. Holding a hex string in the variable compiles
  fine and silently breaks every opacity modifier in the project - 87 of them. The visible
  symptom was a text input rendering solid white, because `bg-hud-black/40` produced nothing.
- **The sidebar docks at `lg`, not `md`.** At 768 a docked rail plus the event panel left the
  canvas a 168px strip: the tree, which is the entire point of the screen, became a sliver. A
  tablet in portrait gets the drawer.
- **The shots harness asserts design tokens resolve.** The CSS-variable migration shipped with
  an edit that had silently failed to apply, so the chrome rendered black and the gold grey on
  every viewport. Nothing threw and nothing overflowed; the run came back clean and only a
  human opening a PNG could see it. Now it fails loudly.
- **A type scale named by role, not size** (`meta`, `body`, `title`, `display`, `hero`…), so a
  component asks for the job it is doing and the ramp can be retuned in one place. It replaces
  a few dozen arbitrary bracket values.
- **One icon set on a 24px grid**, square caps and mitred joins, matching the panels' hard
  corners and 2px rules. It replaces a general-purpose library mixed with one hand-drawn badge,
  which is why the badge never looked like its neighbours. lucide-react is uninstalled.
- **One Button primitive.** Every action was a bespoke string of utilities, so the disabled
  treatment differed between panels and there was no loading state anywhere — a branch request
  froze its button for two seconds with no sign it had been heard.
- **A loading button is `aria-busy`, not `disabled`.** A disabled control drops out of the tab
  order, so focus would be lost from under whoever just pressed it.
- **The busy strings are named in one place.** `busy` is the status line's own copy, so matching
  on it couples the spinner to wording that exists to be read. An earlier version guessed
  "Branching" and the spinner silently never appeared.
- **Uppercase labels and mono data type stay.** The design skill lists both as generic tells,
  but the brief pins this axis down: they are the TVA's own vernacular, taken from the
  reference screenshots, not defaults reached for.
- **The QA matrix is seven viewports, 320 to 1920.** Two was not enough to catch a layout that
  breaks between breakpoints, and the overflow check now names the elements that spill rather
  than only the pixel count.
- **`phoneOnly` targets gate on width < 768, not `isMobile`.** The tablet viewport sits exactly
  on the md breakpoint where the drawer trigger becomes `md:hidden`, so an isMobile gate tried
  to click a hidden button.

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

## Phase 5 — motion and polish

- **Named shots in `src/three/shots.ts`, not ad-hoc lerps.** Every scripted move now has a
  name, a duration and an easing curve somebody chose. Hard cuts are deliberately unavailable:
  a cut between two views of the same object reads as a glitch, because the viewer cannot tell
  the object did not move.
- **Shots drive the rig's *current* state, not its desired state.** The rig damps toward a
  target every frame; tweening into that damping compounds two smoothings and the easing stops
  being the easing you wrote.
- **Pointer input cancels a running shot.** A person touching the scene outranks a script, and
  `want` is synced to wherever the shot got to so releasing control does not snap back to a
  target set before it began.
- **Reduced motion gets the destination, not the journey.** Shots play at zero duration, so the
  framing still changes but nothing swoops.
- **`reveal-push-in` settles with `back.out(1.1)`.** Checklist item 10 asks for overshoot and
  settle; a move that slides to a mathematical halt has no weight.
- **Depth of field only while an event is selected.** Item 7 is explicit that it belongs on
  hero shots, and a permanent shallow focus makes an interface tiring to read. The focus point
  is the selected event, so the blur says "look here" rather than decorating. Dropped entirely
  at the low tier - it is the most expensive pass in the chain.
- **The focus distance is derived, not measured per frame.** A focal plane chasing the camera
  during the push-in re-racks continuously, which reads as the lens hunting.
- **Dust motes as the depth cue.** A scene with one subject in a void has nothing to measure
  depth against; specks at varying distances give parallax as the camera orbits. They are also
  the only thing moving when nothing is happening, which stops a still shot looking like a
  screenshot.
- **`?gfx=high|low` pins the quality tier.** Build machines report few cores, so the device
  probe picks "low" on every one of them - which meant every screenshot ever taken of this
  project was of the low tier and the high tier had never actually been looked at.
- **Label chips clear the open panel.** They were sliding under it and getting cut mid-word;
  the Projector now reserves the panel's width on the right, above the md breakpoint only.
- **Motes are tuned deliberately under the bloom threshold.** Brighter and every speck picks up
  a halo, turning fine dust into a field of bokeh balls that competes with the tree.


## Phase 6 - the painted canvas

The 3D tree is gone. Three rebuilds of it (procedural, painterly, photoreal) did not reach the
bar, and the owner supplied the artwork the project had been chasing all along. What follows is
the consequence of making the painting the subject rather than a reference.

- **The painting is the canvas; the interface is a transparent SVG over it.** Drawing a second
  tree on top of a picture of a tree is what produced two misaligned trees in every earlier
  attempt. The overlay adds structure you can point at, not a second drawing: hairlines, mostly
  transparent, inside the artwork's own light.
- **One box drives the image, the overlay and the labels** (`src/lib/useStage.ts`). Alignment is
  not maintained, it is structural - there is one number and all three are given it. The
  alternative, `object-fit: cover` on the image and a guess in the SVG, cannot stay in register
  across seven viewports.
- **Cover-fit, clamped by a safe rectangle.** Cover alone throws the outermost limbs off a
  portrait canvas, and those limbs *are* the interface. When the clamp bites the art letterboxes
  instead; the painting's own border is near-black, so against the canvas the seam is invisible.
- **Limbs are generated from a tuned table, not hand-written path data.** The graph is live: a
  branch created at runtime needs a limb too, and hand-authored `d` strings only cover the
  events that happened to be there when they were typed. The trunk *is* traced - it is the one
  piece of the painting that never moves.
- **Each limb carries a hit stroke roughly 20x the visible one**, and the trunk is split into one
  hit segment per event. A 2px branch is not a touch target, and one rectangle over the whole
  tree is not an interaction.
- **Prime events sit on the trunk and branch events along their limb.** It is the mapping the
  data already implies, and it means the deviation a branch creates is visible as geometry: the
  limb leaves the trunk at the event that was changed.
- **Everything the overlay animates is CSS**, not a frame loop: dash offsets, opacity and
  transforms are compositor work, where the equivalent rAF would re-render the whole SVG every
  frame for the same picture.
- **Pruning asks first.** It used to fire on the button press. It now names the timeline, counts
  what dies, and holds the limb on screen for one red dissolve before committing - destruction
  you watch rather than destruction that already happened. Focus lands on Cancel.
- **The animated GIF was rejected.** 540x450 and 10 MB: a third of the pixels the canvas needs
  and more weight than the rest of the app, and stretching it would break the aspect-ratio
  contract the overlay depends on. The still is the primary source, upscaled 2x with a light
  unsharp pass - a watercolour tolerates that where a photograph would not.
- **The whole 3D stack was deleted, not disabled.** three, drei, postprocessing, GSAP, the
  texture pipeline and the HDRI: ~10 MB of assets and 500 KB of JavaScript that nothing renders.
  Dead code that ships is the placeholder rule in another costume. It is recoverable from
  `27dde48` if the decision ever reverses.
- **`capabilities.ts` is down to one question.** There is no GPU gate and no quality tier to
  pick any more; reduced motion is honoured in CSS instead of by swapping the interface for a
  different one.
- **`FlatTimeline` stopped being a fallback and stayed anyway.** No machine fails to render a
  picture, but a list is still the fastest way to read a 40-event graph and the right shape for
  a screen reader. It is at `?flat=1`.

## Phase 7 - events on the boughs

The painting was right and the geometry on top of it was wrong: every event sat on the trunk, so
the overlay drew a vertical line of dots up the middle of a multiverse. These are the changes
that came out of fixing that.

- **Events live out on the boughs, not up the trunk.** A table of eleven limbs traced onto the
  painting - origins on the trunk at different heights, tips in the canopy and the root tangle -
  and prime events are handed out along it in year order. Time still moves up the tree; it no
  longer moves up a line.
- **The bough table alternates sides deliberately.** Walking up one side and down the other puts
  every marker on one edge of the painting and reads as a margin, not a canopy.
- **The trunk is not drawn at all any more.** The sap flow was the vertical line people kept
  seeing. The painting already has a trunk, lit from inside; adding a glowing stroke to it was
  drawing over the one part of the artwork that needed no help.
- **A bough is drawn only while it is the subject.** Tracing all eleven in gold would be the
  second-tree failure in another costume. At rest the overlay is markers and nothing else.
- **Deviation limbs are always drawn.** They are not in the painting - they are what the
  custodian added to it, and seeing that a universe is now growing there is the point of the
  screen. They grow from the event that caused them, continuing that bough's own heading.
- **Nothing is named until it is chosen.** Hover, focus or tap puts one label beside one marker
  and lights the bough under it. Nine permanent pills buried the artwork they were pinned to.
- **The mobile dock is permanent, not a sheet that comes and goes.** The canvas above it is
  therefore always the same size, and the space it occupies was otherwise a blurred void under a
  letterboxed painting. Idle it is the station summary; select an event and it becomes the panel.
- **The safe rectangle is as tight as the bough table allows** (500x450). On a phone that number
  sets the size of the tree: every unit of safe width is a unit the painting cannot use.
- **The drawer carries the instability readout.** On a phone the gauge is off screen behind the
  dock, and the column under the nav was a tall empty green field.
- **One nav block, three times.** They used to size themselves to their own text, so "Branches"
  was a short box between two tall ones and the column read as three separately positioned
  buttons. One height, one padding, one border, one gap.
- **`min-w-0` on the label's title.** Without it the title's min-content width beats the pill's
  maxWidth, the label refuses to shrink and runs off the canvas instead of truncating.

## Phase 7b - the short laptop

A 1366x700 window showed what tall-window screenshots had hidden: a rail that stranded its
ledger below a 440px void and clipped its last line against the bottom edge, and a header that
took thirteen per cent of the window.

- **A 1366x700 viewport is in the harness now.** 768 of height with browser chrome on it leaves
  about 660 for the app, and it is where anything pinned to the foot of a column collides with
  what is above it. Every earlier viewport was tall enough to hide the problem.
- **Nothing is pinned to the bottom of the rail any more.** The content column scrolls and the
  ledger is its foot, so the two cannot drift apart: `mt-auto` is how the ledger ended up alone
  at the bottom of the screen with its last line cut off.
- **Panels can fill their column** (`fill` on `ui/Panel`). A short list panel at the top of a
  tall rail leaves a void; a filled one takes the spare height and scrolls inside, which also
  keeps its frame whole instead of letting the column crop it mid-form.
- **The chrome steps at `xl` and `2xl` rather than jumping at `lg`.** Sidebar 292 plus rail 348
  left a 1366 screen with 726px of canvas - the tree had less than half the window it is the
  subject of. It is 252 + 330 there now, and the full widths wait for 1536.
- **The mobile canvas is a fixed-aspect hero, not whatever the dock leaves over.** `112.6vw` is
  exactly the height at which the painting fills a full-width canvas at the safe rectangle's
  scale (563/500), so there is no blurred band whatever the dock contains - which is what came
  back the moment a view with a short dock (an almost-empty prune history) was photographed.
  The dock is now a sibling in a column rather than an overlay, so measuring its height to tell
  the canvas what was covered is gone entirely.
- **Labels are clamped to the canvas vertically too.** A marker on the lowest bough put its pill
  half under the rail's top border.

## Phase 7c - the branch button that looked broken

Reported as "Branch New Timeline is never clickable". It was not broken: it is disabled until
a premise is typed, and nothing on the screen said so.

- **The premise moved out of the edit box and into the action it arms.** It sat under "Event
  name" next to a Save button, inside a box headed "Change historical event", so it read as
  part of the rewrite. The branch now has its own blue-bordered block: heading, the required
  field, and its button directly beneath.
- **The disabled button states its reason** where the button is - "Describe the change above
  and this becomes available" - wired to the field with `aria-describedby`.
- **The field is labelled "What happens instead?" with a required mark**, and the placeholder
  is italic. The old placeholder was upright grey body text that read as a filled-in value, so
  the field looked answered when it was empty.
- The behaviour is unchanged: the engine needs a what-if to compute a cascade, and branching
  on an empty premise would produce a universe about nothing.

## Phase 8 - the whole archive

The seed used to shuffle two small pools and show nine events, so no two visits looked alike.
The archive is the subject now: every event is on the tree.

- **Three strands, one sequence.** Recorded history (wars included), the saga this project is a
  homage to, and the anomalies the archive let through - 74 events, interleaved by year. That
  interleaving is the joke: the TVA files a world war and a unionised pigeon on the same bough
  in the same hand.
- **The saga strand is text only**, written in this app's own voice, using in-universe years so
  it files correctly beside recorded history. No official logo, title font or film asset is
  reproduced anywhere in this project, and that has not changed.
- **Atrocity-specific events are deliberately absent.** The Holocaust, Hiroshima and 9/11 are
  not on a tree where the next marker along is a cat being appointed harbourmaster and the verb
  on offer is "prune". The wars themselves are there - their beginnings, their ends, Waterloo,
  Normandy - because those are the what-ifs the piece is about.
- **A bough carries a run of years, not one event.** With the whole archive on the tree there
  are far too many for one each; the sorted events are dealt across fifteen boughs in
  contiguous chunks, so each bough is a span of consecutive years and time still moves outward
  and up through the tree.
- **Markers sit a hair off their bough, alternating.** Dead on the curve, five in a row read as
  beads threaded on a wire rather than as growth along a branch.
- **The per-bough hit path is gone.** It selected "the first event on this bough", which meant
  nothing once a bough carried five, and a 30-unit invisible band across the canvas was
  competing with the markers it was meant to help you reach. Deviation limbs keep theirs: a
  limb still maps to exactly one branch.
- **The marker hit radius is capped at half the gap between neighbours** (15 art units). Wider
  and the circles overlap, which makes a neighbour unreachable. On a phone that is about a 24px
  target - tight, and the reason `?flat=1` earns its place twice over now.
- **The strand is named in the panel, not coloured on the canvas.** A second marker colour would
  need a legend, and the painting is the subject. The word beside the year says which archive
  an event came from.

## Phase 9 - panel detailing

The owner supplied a new reference of the event panel. Ours had the same content and none of
the craft; these are the differences, closed.

- **The panel frame is rounded now, and the corner brackets are gone.** A bracket notched into
  a radiused corner reads as a mistake rather than as a detail. One radius through the system:
  `rounded-lg` on panels, `rounded-md` on field boxes and inputs, `rounded-full` on action
  pills.
- **`ui/Medallion`: a struck gold disc with the glyph cut out of it**, a darker ring inside the
  rim. The origin marker was a thin gold ring around a hairline icon on a near-black fill,
  which at 32px read as a disabled button. The same treatment carries the profile pip and the
  custodian's mark, which were the same shape inverted.
- **The action pills wear a light inner border and a soft drop** instead of a brass hairline.
  The hairline tied them to the frame and left them looking printed on it; these read as struck
  objects sitting on the panel.
- **A gold rail down the sidebar's right edge**, continuous with the diagonal notch at the top.
  It frames the canvas instead of letting the painting start against bare green.
- **The panel was compacted to reach its own actions.** A 30px year display and a two-cell
  status grid cost about 110px between them and pushed Branch and Prune off the bottom of a
  768px screen; both are one line now.
- **The ledger stands down while an event is open.** It exists to use the rail's spare height,
  and with a panel in the rail there is none.

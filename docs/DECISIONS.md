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

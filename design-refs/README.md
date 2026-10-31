# Design references

These are the source of truth for look and feel. Code matches the refs, not the other way round.

## Status: images missing

**The reference images are not in this folder.** They were supplied as chat uploads and lost
when the cloud container was recycled. Re-add them here as `hud-*.png` / `tree-*.png` and they
become the source of truth again.

What follows is what was extracted from them before they were lost, and it is what the code
currently implements. Treat it as a faithful record, not as a substitute — anything it does not
mention has to be re-checked against the originals.

## Ref 1 — HUD layout

Three zones, full-bleed, no page scroll:

- **Top bar** — full width, `hud.green`, gold rule along the bottom. Wordmark left in brass
  caps with wide tracking. "PROFILE" plus a ringed horn badge right. 62px phone / 92px desktop.
- **Left sidebar** — `hud.green` ground, stacked near-black nav blocks with brass caps text:
  "The Sacred Timeline" / "Branches" / "Prune History". A gold diagonal is notched into the
  top-right corner. The active row carries a gold chevron that bites into the canvas margin.
  Horn badge pinned bottom-centre. Becomes an off-canvas drawer below `md`.
- **Right drawer** — gold-bordered card on `hud.green`. Title in brass caps under a gold rule,
  body paragraph, "Originates from:" with an hourglass badge, a boxed "Change Historical Event"
  form with literal `Form` / `Description` labels, a pill `Save`, then a blue
  **Branch New Timeline** pill above a red **Prune Timeline** pill.

Deviation state replaces the drawer with a three-panel triptych: Timeline Editor (carrying a
"Warning: deviation detected" band), Timeline Viewer (dual-line chart, solid green sacred line,
dashed red branch, gold fork node, "Deviation created" tag), Current Deviations (list with red
status dots). Falling glyph overlay across the top during the deviation window.

## Ref 2 — the tree

A painted Yggdrasil centred in the canvas:

- Thick, gnarled, luminous trunk — glows yellow-green/white from within, dark bark ridges,
  light escaping through the crevices.
- A spreading root mass at the base, tangled, not a few petals.
- Branches darken into near-black silhouettes as they rise into the canopy.
- Canopy is a soft blue-teal mass with clumps of pink/magenta blossom inside it. Painterly and
  atmospheric, no hard edges.
- A single branch is picked out in gold — the live timeline — carrying a gold bead and a
  bordered label chip.

**Note on art direction:** the ref is a watercolour painting. The standing decision
(`docs/DECISIONS.md`, 2026-10-31) is to go **literal photoreal** instead, so the tree is being
rebuilt with real PBR materials and HDRI lighting. The refs still govern composition, palette
and the gold-timeline idea; they no longer govern surface treatment.

## Palette

Sampled from the refs and implemented in `tailwind.config.ts`:

| Token | Hex | Role |
|---|---|---|
| `hud.green` | `#0B4A34` | chrome ground |
| `hud.greenDark` | `#06331F` | recesses |
| `hud.panel` | `#0E5138` | raised panels |
| `hud.black` | `#050807` | nav blocks |
| `brass` | `#E8C34A` | rules, headings, active state |
| `weave` | `#10B981` | live timeline |
| `warn` | `#F0A020` | deviation banner |
| `pill.blue` | `#2E7BA6` | Branch action |
| `pill.red` | `#B03A2E` | Prune action |
| `ash` | `#EDEAE0` | body copy |

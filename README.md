# PRUNE — Temporal Causality Engine

An interactive tree of branching timelines you can **branch**, **prune**, and
**rewrite**. An LLM is the causality engine: change one event and it generates
the ripple of consequences downstream. Pruning a branch dissolves it into gold
ash and writes a one-line epitaph to the ledger.

You are a temporal custodian who is never quite in control.

> **Unofficial fan project.** Not affiliated with, endorsed by, or sponsored by
> Marvel or Disney. Built as a personal homage to record a short video — not a
> product, not for sale, not operated as a commercial service. All visuals are
> original: no official logo, title font, or character mark is reproduced
> anywhere in this repository (see [Fan asset slots](#fan-asset-slots)).
>
> **No soundtrack is embedded.** Add royalty-free audio in your editor — using
> the actual film score is the single most common reason these videos get muted.

---

## Quick start

```bash
npm install
cp .env.example .env.local        # then add your ANTHROPIC_API_KEY
npm run dev                       # http://localhost:3000
```

Refresh reseeds the timeline. There is no login, no save, and no database —
state lives in memory for the length of the session, by design.

### Environment

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **yes** | — | Server-side only. Never exposed to the browser. |
| `CAUSALITY_MODEL` | no | `claude-haiku-4-5` | Fast model keeps the "computing cascade" beat short on camera. Set `claude-opus-5` for sharper writing at higher latency. |
| `RATE_LIMIT_MAX` | no | `12` | Requests per window. |
| `RATE_LIMIT_WINDOW_MS` | no | `60000` | Window length. |
| `DAILY_CALL_CAP` | no | `300` | Hard process-wide daily ceiling on LLM calls. |
| `TRUST_PROXY` | no | unset | Set to `1` only behind a proxy that overwrites `x-forwarded-for`. |

Without a key the app boots and renders the seeded tree, but every verb returns
`503` and the server logs `MISCONFIGURED`.

---

## The three verbs

| Verb | What happens |
|---|---|
| **BRANCH** | Enter a "what if". The engine generates 3–5 consequence events; a new branch grows off the anchor, splaying outward in 3D, with a pulse of light travelling the new path. |
| **PRUNE** | The branch converts to a GLSL point system and disperses along noise-driven vectors as glowing gold embers. The engine writes a deadpan epitaph to the ledger. |
| **REWRITE** | Edit an event. Everything downstream desaturates and fades while the regenerated cascade grows in sequentially, so the causal ripple is legible on camera. |

Two mechanics keep you off balance:

- **Instability meter (0–100).** Every action raises it. At 100 the tree
  implodes toward the origin and reseeds behind a stamped
  `SEQUENCE RESET // custodian privileges revoked`.
- **Absurd seed events.** The default timeline mixes real history with
  nonsense ("1994: cats achieve object permanence") so the tone is comedic
  from the first frame.

Controls: drag to orbit, scroll to zoom, click an event for the radial menu.

---

## Architecture

```
src/
  app/
    page.tsx                 orchestrator: state, the three verbs, reset
    api/causality/route.ts   the single LLM route (key, limits, validation)
  lib/
    types.ts      graph model      schemas.ts   zod contract + normalise/validate
    seed.ts       default timeline  prompts.ts   causality-engine prompts
    graph.ts      layout + verbs    causality.ts Claude calls, retry, fail-closed
    vfx.ts        prune point cloud rateLimit.ts window + daily cap
  components/
    Scene.tsx     canvas, lights, camera fit, label projection
    TimelineTree.tsx  markers + luminous edge tubes
    PruneBurst.tsx    the GLSL snap-dissolve
    CameraRig.tsx     hand-written orbit (no addon OrbitControls)
    Ledger / InstabilityGauge / NodeLabels / PromptModal / Chrome
evals/            golden cases + runner
```

**Stack:** Next.js 14 (App Router) · TypeScript · React Three Fiber · Tailwind ·
zod · `@anthropic-ai/sdk`.

Three design notes worth knowing:

- **Layout enforces a minimum vertical gap** between consecutive events. The
  tree stops being a strict linear time axis, but labels never collide — it is
  built to be readable on camera.
- **Labels are DOM, not 3D text.** `Scene`'s projector writes
  `style.transform` straight onto each label every frame, bypassing React, so
  200 labels stay at 60fps.
- **The camera fits itself to the tree's bounds** on mount and after each
  reset, then hands control to the user.

### The LLM contract

One prompt, three modes (`branch` | `rewrite` | `epitaph`), behind
`POST /api/causality`. Responses are constrained with structured outputs
(`output_config.format` + `zodOutputFormat`) and then put through
**normalise → validate**:

- *Normalise* repairs what a fast model actually gets wrong — unsorted years, a
  sixth event, a delta of 40, a title too long for its node.
- *Validate* enforces the real contract: 3–5 events, years strictly increasing
  and downstream of the anchor, `instability_delta` 5–25, epitaph ≤ 140 chars.

On failure it retries once, then **fails closed** to a canned response so the 3D
tree always has something renderable. Degraded responses surface in the status
strip as `ARCHIVE DEGRADED`.

---

## Evals

```bash
npm run eval                # live — 22 golden cases against the real model
npm run eval -- --offline   # no API calls; exercises repair + fail-closed paths
npm run eval -- --json      # machine-readable summary
```

22 cases across mundane, absurd, adversarial, edge, and epitaph inputs. Each
asserts the zod schema, event count, chronology, delta range, epitaph length,
and that the model never leaks the prompt or breaks character.

Exits non-zero below a **95%** schema-valid rate, so it doubles as the
prompt-drift guard — **re-run it after any prompt change.**

Note that a *degraded* (canned) response counts as a failure, not a pass: the
tree still renders, but the engine failed twice on that input.

---

## Security

`npm run build` output was audited against a five-check preflight. What is in
place:

- API key is **server-side only** — verified absent from all 17 shipped client
  chunks, as is the Anthropic SDK itself.
- **Rate limit + hard daily cap** on the one route that spends money. The daily
  cap is process-wide and cannot be bypassed by spoofing a header.
- **Cross-origin POSTs are refused**, so another page cannot burn your budget.
- **Input bounded** at 4KB body / 280 chars, validated with zod; the premise is
  passed to the model as delimited *data*, with an explicit injection guard.
- **Output validated** before render; nothing is ever injected as HTML (there is
  no `dangerouslySetInnerHTML` or `innerHTML` in the codebase).
- **Security headers** on every response: CSP, HSTS, `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Logs carry error *names* only — never premise text, never the key.

Two limits worth stating plainly:

1. **Rate-limit counters are in-process.** Right for a single local process;
   move them to a shared store before putting this on serverless behind a
   public URL.
2. **CSP allows `'unsafe-inline'` for scripts**, because Next.js inlines its
   hydration payload on statically prerendered pages. The risk is bounded by
   there being no HTML injection sink, but it is not a nonce-strict policy.

This audit catches the mistakes behind most real-world breaches in fast-built
apps. It is not a substitute for professional security testing.

---

## Fan asset slots

Marked `// FAN ASSET SLOT` in the source. Nothing copyrighted is recreated —
drop your own assets in if you want them:

- `src/components/Chrome.tsx` → `TitleBlock` — replace the styled `PRUNE`
  wordmark with an official title graphic.

Type is [Bitter](https://fonts.google.com/specimen/Bitter) and
[JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono), both OFL,
loaded via `<link>` so an offline build still succeeds and falls back to system
serif/mono.

---

## Scope

v1 is deliberately closed. No accounts, no database, no multiplayer, no export,
no embedded audio. New ideas go in [`V2_IDEAS.md`](./V2_IDEAS.md) — the point is
to ship the video, not to keep polishing an unfinished project.

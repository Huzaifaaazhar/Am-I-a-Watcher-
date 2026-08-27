# PRUNE — Temporal Causality Engine

An interactive tree of branching timelines you can **branch**, **prune**, and
**rewrite**. Change one event and the engine generates the ripple of
consequences downstream. Pruning a branch dissolves it into gold ash and writes
a one-line epitaph to the ledger.

You are a temporal custodian who is never quite in control.

**Inference runs locally.** There is no third-party API in the request path and
no API key. The default engine is a classifier plus a generative grammar that
runs in-process; a local LLM via Ollama is an opt-in upgrade.

> **Unofficial fan project.** Not affiliated with, endorsed by, or sponsored by
> Marvel or Disney. Built as a personal homage to record a short video. All
> visuals are original: no official logo, title font, or character mark is
> reproduced anywhere in this repository.
>
> **No soundtrack is embedded.** Add royalty-free audio in your editor — using
> the actual film score is the most common reason these videos get muted.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

That is the whole setup. No key, no `.env.local`, no daemon — the procedural
engine is the default and has no dependencies. Copy `.env.example` to
`.env.local` only when you want to change something.

| Route | What it is |
|---|---|
| `/` | The timeline tree |
| `/monitor` | Operational dashboard |
| `/api/health` | Liveness + provider readiness (JSON) |
| `/api/metrics` | Prometheus scrape endpoint |

---

## The three verbs

| Verb | What happens |
|---|---|
| **BRANCH** | Enter a "what if". The engine generates 3–5 consequence events; a new branch grows off the anchor, splaying outward in 3D, with a pulse of light travelling the new path. |
| **PRUNE** | The branch converts to a GLSL point system and disperses along noise-driven vectors as glowing gold embers, while the engine writes a deadpan epitaph to the ledger. |
| **REWRITE** | Edit an event. Everything downstream desaturates and fades while the regenerated cascade grows in sequentially. |

Controls: drag to orbit, scroll to zoom, click an event for the radial menu.
Every action raises the **instability meter**; at 100 the tree implodes and
reseeds behind a stamped `SEQUENCE RESET`.

---

## The causality engine

Two providers behind one interface (`src/lib/engine/`). Both are local.

### `procedural` (default)

No model weights, no network, no inference server. Three classical pieces:

1. **Nearest-centroid domain classifier.** The premise is tokenised into a
   bag-of-words vector and scored by cosine similarity against nine hand-built
   domain lexicons (technology, transport, governance, animals, …). The winning
   domain supplies the vocabulary the cascade is written in, so a premise about
   pigeons produces consequences about roosts and veterinary boards. Below a
   similarity floor it returns `generic` rather than guessing.
2. **Noun-phrase extraction.** English noun phrases are head-final, so the head
   is the last token that survives a verb/adverb/adjective filter — preferring
   one the classifier recognises. `"penicillin was discovered a century
   earlier"` yields `penicillin`, not `century earlier`. The modifier attaches
   only when adjacent in the original stream, so `"the ban on Tuesdays"` gives
   `Tuesdays`, not `ban Tuesdays`.
3. **Weighted grammar over four escalation tiers.** Consequences climb from
   immediate → institutional → societal → cosmic, so a cascade always reads as
   a ladder. `instability_delta` comes from a transparent linear model over the
   extracted features (domain volatility, absurdity, negation, magnitude).

Everything is seeded from a hash of the premise, so **the same what-if always
produces the same branch** — which is what makes the eval suite meaningful. It
answers in well under a millisecond and cannot produce invalid output, so it
also serves as the fallback for the other provider.

### `ollama` (opt-in)

```bash
ollama serve && ollama pull llama3.2
CAUSALITY_PROVIDER=ollama npm run dev
```

Talks to a local Ollama daemon over loopback. Ollama's `format` field takes a
JSON Schema and constrains decoding to it, giving the same structural guarantee
the procedural engine has by construction. Better prose, at the cost of latency
and a daemon.

### The gate, and the fallback

Every provider's output passes through the same gate — shape parse (zod),
normalise, validate — so a local LLM cannot render anything the procedural
engine could not:

- *Normalise* repairs what a model actually gets wrong: unsorted years, a sixth
  event, an out-of-range delta, a title too long for its node.
- *Validate* enforces the contract: 3–5 events, years strictly increasing and
  downstream of the anchor, `instability_delta` 5–25, epitaph ≤ 140 chars.

If the primary provider fails that gate twice, the procedural engine answers
instead. The response carries `provider` and `degraded`, and the fallback is
counted in `prune_provider_fallbacks_total` — a provider quietly failing half
the time is exactly what monitoring is for.

**Prompt injection** is handled the same way by both: a premise that tries to
give the engine orders is detected and dramatised as an in-world anomaly ("an
unauthorised instruction"), never echoed back and never obeyed.

---

## Observability

### Structured logging

JSON to stdout via pino — one line per event, with a `requestId` that is also
returned in the `x-request-id` header and the error body, so a user report maps
to a log line.

```json
{"level":"info","time":"…","service":"prune","requestId":"MTAIRRD04YAX85",
 "mode":"branch","provider":"procedural","fellBack":false,"durationMs":0.27,
 "events":4,"delta":14,"msg":"cascade served"}
```

Custodian premises are **redacted by default** (`LOG_PREMISES=1` to include
them while debugging locally). Pipe through `pino-pretty` for a readable
terminal.

### Metrics

Prometheus exposition at `/api/metrics`, plus default process metrics (heap,
event-loop lag, GC).

| Metric | Type | Labels |
|---|---|---|
| `prune_causality_requests_total` | counter | `mode`, `provider`, `outcome` |
| `prune_causality_duration_seconds` | histogram | `mode`, `provider` |
| `prune_validation_failures_total` | counter | `mode`, `stage` |
| `prune_provider_fallbacks_total` | counter | `from`, `to`, `reason` |
| `prune_requests_rejected_total` | counter | `reason` |
| `prune_provider_up` | gauge | `provider` |
| `prune_events_generated_total` | counter | `mode` |

Worth alerting on: `prune_provider_up == 0` for the primary provider, a
sustained non-zero fallback rate, and p95 of the duration histogram.

### Health

`/api/health` reports liveness plus per-provider reachability. `status` is
`ok` when the configured provider answered, `degraded` when it did not but the
fallback can still serve everything — **degraded is deliberately still a 200**,
because the app is fully functional on the fallback and pulling it out of
rotation would be worse than serving it.

### Dashboard

`/monitor` scrapes the same `/api/metrics` endpoint Prometheus would, so the
dashboard and any alerting read identical numbers. Latency distribution,
request outcomes, rejection reasons, provider status, process stats, and a
table view for accessibility.

Chart colours are validated, not eyeballed: every step sits inside the dark-mode
lightness band, clears the chroma floor, and passes contrast against the
dashboard surface. The one CVD warning (critical vs good) is why every status
ships with a glyph and a written label and is never distinguished by colour
alone.

---

## Evals

```bash
npm run eval                        # the configured provider
npm run eval -- --provider=ollama   # a local LLM, if one is running
npm run eval -- --json              # machine-readable
npm run eval -- --update-baseline   # re-record the regression baseline
```

22 golden cases across mundane, absurd, adversarial, edge and epitaph inputs.
Each asserts the zod contract, event count, chronology, delta range, epitaph
length, and that the engine never leaks the prompt or breaks character.

The suite runs with **no key and no network**, so it belongs in CI. It fails on
any of:

- pass rate below **95%**
- a case that passed in `evals/baseline.json` now failing (regression guard)
- the procedural engine returning different output for identical input
  (determinism guard — a drift there would silently invalidate every baseline)

A fallback counts as a failure, not a pass: the provider under test did not
deliver.

---

## Security

Audited against a five-check preflight, then re-verified after the local-engine
rewrite.

- **No API key anywhere.** Inference is in-process or on loopback. The class of
  bug where a key reaches the client bundle no longer exists here.
- **Rate limit + hard daily cap.** Local inference is not free — it is CPU, and
  GPU on the Ollama path. The daily cap is process-wide and cannot be reset by
  spoofing a header.
- **Cross-origin POSTs refused**, so another page cannot drive your engine.
- **Input bounded** at 4KB body / 280 chars, validated with zod; the premise is
  treated as data, with injection detection on both providers.
- **Output validated** before render; nothing is injected as HTML (no
  `dangerouslySetInnerHTML` or `innerHTML` in the codebase).
- **Security headers** on every response: CSP, HSTS, `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Logs carry no premise text** unless explicitly enabled.
- **`/api/metrics` can be token-gated** (`METRICS_TOKEN`) where it cannot be
  bound to an internal interface — metrics leak traffic shape and error rates.

Two limits worth stating plainly:

1. **Rate-limit counters are in-process.** Right for a single process; move
   them to a shared store before running multiple replicas.
2. **CSP allows `'unsafe-inline'` for scripts**, because Next.js inlines its
   hydration payload on statically prerendered pages. Bounded by there being no
   HTML injection sink, but it is not a nonce-strict policy.

This catches the mistakes behind most real-world breaches in fast-built apps.
It is not a substitute for professional security testing.

---

## Architecture

```
src/
  app/
    page.tsx                 orchestrator: state, the three verbs, reset
    monitor/page.tsx         operational dashboard
    api/causality/route.ts   the one generation route
    api/health   api/metrics readiness and Prometheus scrape
  lib/
    engine/
      index.ts       provider selection, the gate, the fallback chain
      procedural.ts  classifier + grammar engine (default)
      ollama.ts      local LLM over loopback
      features.ts    domain classifier, noun-phrase extraction, linear model
      grammar.ts     escalation-tier templates, seeded PRNG
    obs/
      logger.ts      pino, request ids, premise redaction
      metrics.ts     Prometheus registry
      parsePrometheus.ts  scrape parser shared with the dashboard
    graph.ts  layout + verbs      schemas.ts  contract + normalise/validate
    vfx.ts    prune point cloud   rateLimit.ts  window + daily cap
  components/
    Scene / TimelineTree / PruneBurst / CameraRig / Ledger / …
    monitor/Charts.tsx  validated-palette chart primitives
evals/  golden cases, runner, regression baseline
```

**Stack:** Next.js 14 (App Router) · TypeScript · React Three Fiber · Tailwind ·
zod · pino · `@prometheus-io/client`. No LLM SDK.

Three rendering notes:

- **Layout enforces a minimum vertical gap** between events, so labels never
  collide — it is built to be readable on camera, not to be a strict time axis.
- **Labels are DOM, not 3D text.** A projector writes `style.transform` onto
  each label every frame, bypassing React, so many labels stay at 60fps.
- **The camera fits itself to the tree's bounds** on mount and after each reset.

---

## Scope

v1 is deliberately closed: no accounts, no database, no multiplayer, no export,
no embedded audio. New ideas go in [`V2_IDEAS.md`](./V2_IDEAS.md).

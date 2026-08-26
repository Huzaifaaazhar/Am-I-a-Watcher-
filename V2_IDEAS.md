# V2 ideas

Parking lot. Nothing here gets built before the video is recorded — that is the
whole point of keeping this file.

## Explicitly cut from v1

Deferred on purpose, not forgotten:

- **Accounts, saved timelines, permalinks.** Would need auth and a database,
  both of which v1 refuses on purpose.
- **A database.** State is in-memory; a refresh is meant to reseed.
- **Multiplayer / collaborative custodianship.** Two people pruning the same
  tree is a good idea and a completely different architecture.
- **Export / OG image.** Render the tree to a shareable still or a short clip.
- **Embedded audio.** Stays out permanently — score goes in the editor, and only
  royalty-free.

## Things noticed while building

- **Pruned nodes are never garbage-collected.** They stay in `timeline.nodes`
  with `status: "pruned"` so the layout keeps its parent chain intact. Harmless
  for a session; would need sweeping for a long-lived tree.
- **Rate-limit counters are in-process.** Fine locally, useless across
  serverless instances. Redis or equivalent before any public deploy.
- **Strict CSP.** Nonce-based `script-src` would need middleware and would force
  every page dynamic. Worth revisiting if this ever ships publicly.
- **Undo.** The ledger already records every action; making entries clickable to
  roll back is close to free and would make the instability meter genuinely
  tactical.
- **Branch collision at depth.** The golden-angle splay distributes branches
  well up to a few dozen; a real force-directed pass would hold up further.
- **Prompt caching.** The system prompt is stable across every call and is
  currently re-sent uncached. A cache breakpoint would cut cost noticeably if
  usage ever grew.

## Mechanics that might be fun

- **Nemesis branch.** One branch quietly refuses to be pruned and regrows.
- **Custodian review.** At high instability, the archive starts declining
  actions with bureaucratic reasons instead of executing them.
- **Timeline diffing.** Select two branches and have the engine narrate what
  diverged between them.
- **Audio-reactive dissolve.** Drive the particle dispersal from an audio
  envelope so the prune lands on a beat in the edit.

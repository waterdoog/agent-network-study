# agent-network-study

Public, private and hybrid agent networks as **one coordination kernel under four knobs**,
measured over a four-beat timeline (cold build → rework → warm build → warm rework).

- **Coordination layer:** the real `@aicoo/sharedos` kernel. Every cross-agent contact is a
  `CapabilityAuthorizer.authorize()` call; every sub-delegation is a `deriveGrant()` call.
  A refusal in the logs is a SharedOS reason code (`grant_exhausted`, `parent_not_delegable`, …),
  not something this harness decided.
- **Agent runtime:** one tool loop (`src/lib/agent.js`) for every agent in every arm, over
  OpenRouter, one model.
- **Scoring:** no LLM judge anywhere. Artifacts are HTML; assertions are DOM counts, attribute
  values, text presence, and **unit tests against the calculator the page must define**.

## The four knobs

| Knob | public | private | hybrid |
|---|---|---|---|
| directory scope | all 100 cards | roster of 20 | roster 20, may read all |
| namespace persistence | new per contact, discarded | persistent across beats | core persists, periphery does not |
| grant lifetime | `maxUses: 1` | TTL, renewable | TTL inside, single-use outside |
| delegation depth | 0 | 5 | 5 inside, 0 outside |

`requesterMemory` is **on in every arm** on purpose. Withholding the requester's own notes from
the public arm would manufacture the warm-start result; what is compared is bilateral versus
unilateral memory.

## Layout

```
src/lib/kernel.js      SharedOS wiring — the only place authority is decided
src/lib/arms.js        the three configurations
src/lib/directory.js   100 cards: 18 payload, 8 near-miss, 74 noise; roster composition by E
src/lib/agent.js       the uniform tool loop
src/lib/timeline.js    the four beats, regression accounting
src/score.js           deterministic scorer (own process, killable)
src/run.js             resumable sweep driver
src/analyze.js         tables -> RESULTS.md
scripts/verify-keys.mjs  checks every calc answer key against a reference implementation
```

## Run

```bash
npm install
node scripts/verify-keys.mjs          # answer keys must be right before anything else
node src/run.js --smoke               # two episodes, one scenario
node src/run.js --par 6 --seeds 3     # full sweep
node src/analyze.js                   # writes runs/<id>/RESULTS.md
```

Behind an HTTP proxy, node's fetch ignores `HTTP_PROXY`; prefix with `NODE_USE_ENV_PROXY=1`.

## Logs

One `events.jsonl` per episode, one event per LLM call, kernel decision, tool call and beat.
One compact console line per beat. `runs/<id>/<episode>/T1.html` is the artifact as submitted,
so any score can be reproduced with `node src/score.js T1.html T1.assertions.json <fn>`.

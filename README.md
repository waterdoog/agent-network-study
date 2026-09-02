# agent-network-study

Relational structure in an agent network lives in three places, and comparisons of
"open" against "closed" networks move all three at once. This study separates them.

| | what it controls | measured effect on requirement F1 |
|---|---|---|
| **edge formation** | which agents a requester may address at all | **0.232**  CI [0.127, 0.316] |
| **edge semantics** | whether an edge carries a delegated task or read access to a store | **0.080**  CI [−0.011, 0.175] |
| **edge attributes** | what is asserted *about* an edge — trust, tenure, attribution | **≈ 0**, below the noise floor |

A naive public-versus-private contrast is **0.313**. Three quarters of it is who can be
reached, one quarter is what crosses the edge, and none of it is what the cards say
about the relationship.

Everything runs on one kernel, one agent runtime, and one model, so a condition differs
from another in named configuration values rather than in implementation.

- **Coordination layer** — the real `@aicoo/sharedos` kernel. Every cross-agent contact is a
  `CapabilityAuthorizer.authorize()` call and every hop is a grant. A refusal in the logs is a
  SharedOS reason code, not something this harness decided.
- **Agent runtime** — one tool loop (`src/lib/agent.js`) for every agent in every arm, over
  OpenRouter.
- **Scoring** — no LLM judge anywhere. Deliverables are HTML; assertions are DOM counts,
  attribute values, text presence, and unit tests against the calculator the page must define.

**Paper:** [waterdoog/fast-paper](https://github.com/waterdoog/fast-paper) — *Who Can
Connect, What Crosses, What Is Believed*, submitted to the Agentic Web workshop at
NeurIPS 2026.

## The design

Two axes are enforced by the kernel and crossed as a factorial:

```
              sandboxed edge          readable edge
open          A  0.777                B  0.920
bounded       C  0.607                D  0.625

Δ_formation = ½[(A−C)+(B−D)]        Δ_semantics = ½[(B−A)+(D−C)]
```

Running only the diagonal — the usual "public versus private" comparison — reports the sum
and cannot say which term carried it. `B` and `C` are what identify the two effects.

The third axis is asserted in context with the configuration held fixed: prior trust,
attribution, a colleague framing, a stranger framing, and **a length-matched placebo**. The
placebo is what separates a relational effect from the cost of the tokens carrying it; it
comes in at +0.005, so the null is about relationships and not about prompt length.

## Tasks

Hidden-profile deliverables. The facts a page needs are split across specialist cards, with
plausible-but-wrong distractors planted on other cards, so no single counterpart can answer
and the correct value is reachable only by pooling. Every required field is forced by the
facts, which is what lets scoring be exact match rather than judgement.

Each episode runs four beats on one timeline: cold build → rework → warm build → warm rework.

## Reproduce

```bash
npm install
cp .env.example .env          # OPENROUTER key
node src/run.js --smoke       # two episodes, ~4 min

# the 2x2
node src/run.js --run axis2x2 --arms A,B,C,D --E 0.3,0.7 --seeds 3 --par 8
node src/factorial.js axis2x2

# the attribute axis
node src/run.js --run seedaxis --arms A,C --E 0.7 --seeds 3 \
  --seed-profile control,trust,accountability,origin,stranger,placebo --par 8
node src/seedeffect.js seedaxis
```

Every episode writes `runs/<run>/<episode>/events.jsonl` — one line per model call, kernel
decision, tool call and score — plus a `summary.json`. Analyses read the per-episode
summaries, never a rolled-up file, so a second sweep into the same run id cannot silently
replace the data an analysis appears to be reporting on.

## Layout

```
src/run.js            sweep driver: enumerates cells, resumes from disk, writes summaries
src/lib/timeline.js   one episode = four beats
src/lib/agent.js      the tool loop, shared by requester, responders and builders
src/lib/kernel.js     SharedOS wiring: namespaces, grants, delegation, refusals
src/lib/directory.js  the card directory, roster composition, and search
src/lib/arms.js       the four cells as configuration
src/lib/seeds.js      the attribute axis: five relational profiles and the placebo
src/score.js          DOM assertions and the calculator unit tests
src/factorial.js      the 2x2: two main effects with bootstrap intervals
src/seedeffect.js     the attribute axis: stratified contrasts against the placebo
docs/DESIGN-FLAWS.md  defects found mid-study and what each one invalidated
FINDINGS.md           results, with the ones that did not survive marked as such
```

## Reading the results honestly

Three claims in this repository were retracted after more data, and they are kept in
`docs/DESIGN-FLAWS.md` rather than deleted:

- A relational framing effect of 0.233 at n=3 fell to 0.029 at n=12.
- A relay effect of +0.255 at n=6 fell to +0.105 at n=16 and no longer excludes zero.
- The first directory implementation returned a fixed top-eight ranked by exact tag match,
  so directory size was free and no discovery cost could have been measured at all.

The 2x2 and the attribute null are what survived. Counting significant contrasts against
the number chance would produce is the check that separates the two.

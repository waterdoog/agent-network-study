# Findings

One kernel, one agent runtime, one model across every condition. No LLM judge on any
metric. Bootstrap intervals are percentile over episodes, resampled within cell.

Results are grouped by whether they survived more data. **Three did not, and they are
kept here rather than deleted** — the pattern that produced them is the most transferable
thing in this repository.

---

## What held

### The regime contrast decomposes, and unevenly

Requirement F1 at the cold beat, 72 episodes:

```
              sandboxed        readable
open          A  0.777         B  0.920
bounded       C  0.607         D  0.625

Δ_formation  = 0.232   95% CI [ 0.127, 0.316]   excludes 0   6 of 7 tests
Δ_semantics  = 0.080   95% CI [-0.011, 0.175]   spans 0      2 of 7 tests
```

A naive open-versus-bounded contrast — the comparison a public/private study reports — is
**0.313**, and it is the sum of the two. Chance at α = 0.05 would clear 0.4 of the seven
tests, so formation is far above the floor and semantics is only just above it.

Formation is also cheaper: opening the directory saves 17.1k tokens an episode while
raising accuracy, because a requester that can address the right holder stops paying to
search around it.

### Reading a store buys accuracy and costs context

Semantics is positive in all three beats (0.080, 0.028, 0.098) but only the warm beat
excludes zero, so it is small and underpowered rather than absent. The cost side is not
ambiguous, and it inverts the ranking:

```
              sandboxed   readable   ratio
open          0.177       0.157      1.13x      F1 per 10k tokens
bounded       0.094       0.087      1.08x
```

Exposing state buys a little accuracy; delegating to an agent that already holds the
context buys more of it per unit of context spent.

### Relational metadata is inert at the layer where it is usually carried

Five properties asserted in context with the configuration held fixed, 72 episodes,
stratified over four (arm, scenario) strata:

```
placebo   − control    +0.005   spans 0     length-matched, no relational content
trust     − control    -0.010   spans 0
attribution − control  -0.046   spans 0
colleague − placebo    -0.088 cold  +0.074 warm    sign flips
stranger  − placebo    -0.116 cold  +0.042 warm    sign flips
colleague − stranger   +0.029   spans 0     narration only, one sentence apart
```

Two things carry this. The **placebo** settles the alternative explanation: two lines of
neutral text matched for length and position cost +0.005, so whatever the relational seeds
do, they do not do it by occupying tokens. And **nothing survives multiplicity**: eight
contrasts across seven metrics is 56 tests per beat, chance yields about 2.8, two cleared,
and they cleared in opposite directions in different beats of the same episodes.

Prior trust and attribution — the two properties deployed reputation systems actually
carry — are the flattest measurements in the set.

**What this bounds:** an assertion in a system prompt, which is the weakest form of
relational encoding. It says nothing about trust wired into routing, memory, retrieval or
permission policy, which is where reputation lives in deployed systems and where it can
change what an agent is able to do rather than what it is told.

### Agents do face conflicts, and resolve them

The attribute null is not an artifact of a task where trust has nothing to do. 90% of
beats encountered a planted distractor; across 670 encounters only 37 were adopted, a
94.5% resistance rate, and 87% of beats with a conflict adopted none. The verification
decision exists and agents exercise it. Asserted trust moved it in neither direction.

---

## What did not survive

### A relational framing effect that was noise

`colleague − stranger` measured +0.233 at n=3 in one stratum and 0.029 at n=12 across
four. The bootstrap at n=3 resamples three numbers; "excludes 0" there means nothing.

### A relay effect that decayed with n

Giving a bounded roster a second hop — a contact may forward one question to a contact of
its own — looked like it recovered the entire formation gap:

```
             n=6        n=11       n=16
C arm       +0.178 ✓   +0.086     +0.042  spans 0
diff-in-diff +0.255 ✓  +0.195     +0.105  spans 0
```

Monotone decay toward zero. The open arm, whose configuration is identical under both
relay settings, served as the negative control and stayed within 1.0 SE of no change.

One thing in it is worth keeping: excluding episodes that failed outright, the bounded arm
scores 0.734 with relay against 0.554 without. Relay helps substantially **when it
completes**, and costs enough exploration budget that some episodes never build at all.

### Seven episodes that produced nothing, and why

All seven have `build = 0` and `submit = 0`: the requester spent its budget searching and
asking, was forced into the build phase, and then kept calling tools that phase blocks
until the iteration cap. Five were relay episodes and two were high first-contact-cost
episodes with no relay, so this is not a property of relaying — **any mechanism that
consumes extra turns triggers it**, and what it exposes is that the harness handles budget
exhaustion by refusing tools rather than by forcing a build.

### A directory whose size was free

The first implementation returned a fixed top eight ranked by exact tag match, and filler
cards drew from a vocabulary disjoint from the scenarios. A query about registration
pricing therefore never touched a single generated card, and a directory of 800 cost
exactly what a directory of 50 cost. **No discovery cost could have been measured at all.**

With filler that scales and a third of it drawn from the scenario's own vocabulary, one
search goes from 130 tokens at 50 cards to 870 at 800, while the share of results holding
anything falls from 26.1% to 3.8%.

---

## The check that separates the two lists

Count the contrasts that clear against the number chance would produce, and check whether
a contrast that clears in one beat clears with the same sign in another. Every retracted
result above fails one of those two tests. Both are printed in the analysis output.

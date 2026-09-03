# The directory-size curve was an outage

**Retracted:** "the advantage of an open directory decays as the directory grows,"
measured over `runs/nscan` (N ∈ {50, 100, 200, 400, 800}, E=0.7, 2 scenarios ×
3 seeds × 4 beats per cell).

**What it actually measured:** when the OpenRouter connection dropped.

## The bug

27% of `nscan` beats produced no artifact. The event log for every one of them
ends the same way:

```
llm.retry  attempt 0..3   why: transient
llm.fail   err: "fetch failed"   TypeError: fetch failed
beat.done  parsed: false   f1: 0
```

The scorer writes `f1: 0` for a beat with no artifact, which is correct — there is
nothing to score. **No analyzer excluded them.** `analyze.js` reported the parsed
count in a footnote at the bottom and averaged the zeros into every mean above it.

So each cell's mean was `(sum of real scores) / (episodes attempted)`, and the
curve traced the outage.

## Why it is an outage and not an effect

Three independent checks, any one of which is sufficient:

1. **Arm C cannot see the directory.** The bounded arm reads a 20-card roster at
   every N. Directory size is not in its causal path. Its delivery rate
   nonetheless rose 54% → 71% → 92% → 96% → 92% across N. A quantity that cannot
   depend on N, but does, is not depending on N.

2. **Scenario is collinear with wall clock.** Every `conference` episode ran
   17:21–18:15 (5 lost beats out of 120). Every `lab-dashboard` episode ran
   21:58–02:32, with losses concentrated 01:00–02:08 and tapering afterwards. The
   two arms happened to execute their N values in different orders inside that
   window — A descending, C ascending — which is precisely what drew one line down
   and the other up.

3. **The failures are not budget exhaustion.** Lost beats used 4.4 of 22+ available
   iterations, made 0 build calls, and burned 16k tokens against 82k for delivered
   beats — while taking *longer* in wall clock (21.8 min vs 17.3). That is a stalled
   connection, not an agent that ran out of turns.

## What the data supports after the correction

Conditional on delivery, both arms are flat across a 16× directory range:

| N | open F1 \| delivered | bounded F1 \| delivered | open delivery | bounded delivery |
|---|---|---|---|---|
| 50 | 0.800 | 0.462 | 96% | 54% |
| 100 | 0.777 | 0.485 | 75% | 71% |
| 200 | 0.758 | 0.525 | 58% | 92% |
| 400 | 0.779 | 0.526 | 50% | 96% |
| 800 | 0.826 | 0.529 | 50% | 92% |

Open arm, N=50 vs N=800: Δ = −0.026, 95% CI [−0.123, +0.065].

Conditioning on delivery is only legitimate where delivery is independent of the
condition, which the three checks above establish — but it still changes the
scenario mix per cell (at N≥400 only `conference` delivered in arm A). The one cell
with neither problem is **arm A × conference**, 3/3 delivered at every N, all of it
inside the clean 17:21–17:47 window:

| N | F1 | search precision | agents contacted | tokens |
|---|---|---|---|---|
| 50 | 0.716 | 0.528 | 11.7 | 65.6k |
| 100 | 0.732 | 0.462 | 14.8 | 76.8k |
| 200 | 0.726 | 0.318 | 19.0 | 81.6k |
| 400 | 0.779 | 0.293 | 21.9 | 119.3k |
| 800 | 0.826 | 0.386 | 16.3 | 131.7k |

Search precision falls by roughly half; the score does not fall with it. The agent
contacts more strangers and spends twice the tokens. **Retrieval got harder and was
paid for rather than lost** — which is a cost result, not a capability result.

Both directions rest on n=3 episodes per point. They are a hypothesis for a rerun,
not a finding.

## Blast radius

`nscan` is the only run with this loss rate.

| run | beats | no artifact |
|---|---|---|
| nscan | 240 | 27% |
| scaling | 448 | 3% |
| seedaxis | 288 | 2% |
| repscan | 192 | 2% |
| capscan | 96 | 2% |

The headline 2×2 (`runs/realistic`, 72 episodes) lost a beat in 1 episode.
Δ_formation moves +0.211 → +0.205 when lost beats are dropped instead of scored as
zero. **The main result is unaffected.** Only this curve was wrong.

## The fix in the code

`src/lib/delivery.js` computes per-cell delivery and a verdict; `analyze.js` prints
it *above* every contrast and writes a stderr warning when the spread across cells
exceeds 15 points. On `nscan` it now reports `UNSAFE — spread 46pt`.

## What a rerun needs

- Decouple scenario from wall clock: interleave, do not run one scenario per block.
- Retry a beat that lost its connection, or exclude the episode explicitly — never
  let a transport failure enter a mean as a score.
- ≥ 10 seeds. n=3 is below the resolution of every contrast attempted here.

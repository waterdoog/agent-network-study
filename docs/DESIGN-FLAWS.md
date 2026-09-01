# Design flaws found during the first sweep

Recorded the night of 2026-09-01, mid-run, before any results were written up.
Two of these mean specific numbers from the `main` run cannot carry the
conclusions they look like they carry.

---

## 1. There was no equal-reach condition — FATAL for attribution

`E ∈ {0.3, 0.7}` puts 2–4 of the scenario's fact holders outside the private
roster in **every beat**. Logs confirm it: `beat.dir` shows
`holdersInRoster: 4, holdersOutside: 2` throughout.

The consequence is that every between-arm difference is attributable to reach:

| observation | looks like | actually is |
|---|---|---|
| public wins T1 | breadth beats depth | public can see facts private cannot — tautology |
| private regresses more at T2 | memory does not protect the artifact | private was rebuilding with fewer facts to begin with |
| no warm-speedup gap | bilateral memory is worthless | untestable while reach differs |

**Nothing in the `main` run can be attributed to memory, namespace persistence,
or grant lifetime.** The fix is the `matched-E0` run: `E = 0` puts every fact
holder inside the 20-seat roster, so public and private have identical reach and
the only remaining differences are the other three knobs. Any difference there is
a memory effect.

This control was argued for earlier in the study's design and then not
implemented — E was allowed to start at 0.3 and the matched cell was skipped.

## 2. The warm task cannot detect the effect it was built to measure

T3 uses instance B, whose fact **values are all different**. The specialists are
the same cards, but every number must be asked for again. Memory can therefore
save only the search step (one call) and not the asking (about eleven calls), so
the detectable effect size is near zero by construction.

`warm_speedup ≈ 0` in every arm is not a finding. It is the design.

**Fix:** the warm instance must share a subset of fact *values* with the cold
instance, not merely the same specialists. Roughly 40% shared values would let
recall of a previously obtained number actually save a call.

A second confound rides along: instance B is intrinsically harder than A (five
tracks over four days versus four over three), so `warm_speedup` is negative
everywhere. Absolute values are unreadable; only between-arm differences mean
anything, and even those are weak for the reason above.

## 3. Requester memory is used unevenly across arms

`write_notes` fired 40 times over 68 public beats but only 16 times over 50
private beats. Requester memory is the fairness control — it is granted in every
arm so that the comparison is bilateral versus unilateral memory rather than
memory versus none — but the private arm exercises it less, which dilutes the
contrast further.

Not a bug, but it means "the private arm had memory available" is not the same
claim as "the private arm used memory".

## 4. Delegation depth was never exercised

Builders were asked whether any fact was missing and answered `NONE` every time,
so `deriveGrant` was never called and `parent_not_delegable` never fired. The
delegation-depth knob is **untested**, not tested-and-null. No delegation claim
may be made from this run.

**Fix:** withhold one required fact from the requester's brief on purpose in a
sub-condition, so the builder has to ask.

---

## What survives

- The harness itself: 144 of 145 beats produced an artifact; zero API failures.
- The scorer: exact match against keys that were verified against reference
  implementations before any run (that check caught three wrong keys out of 86).
- The kernel: SharedOS decides every contact, and single-use exhaustion and
  delegation refusal were both verified directly before the sweep.
- The `main` run remains a valid measurement of **what a bounded roster costs**,
  which is a real result — it is just not a result about memory.

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

## The store affordance was never offered (found mid-run, 2026-09-01)

The requester's system prompt prescribed the workflow as "Search, ask, then hand a
complete brief to a builder" in every arm. In the store-access cells the `list_store`
and `read_store` tools existed and were never called — but that was obedience, not
choice: the prompt named one route and the agent took it.

As written, H4 ("agents do not use the affordances they are given") was untestable.
Measuring it would have measured our prompt.

Fixed by making the workflow sentence conditional on the access axis and naming both
routes neutrally when both exist, with the same stated cost for each. The run was
restarted; no episodes had completed.

## `realization` cannot be computed post-hoc (found mid-run, 2026-09-01)

`realization = recall / attainable` was meant to divide out the ceiling the fact
allocation imposes, so that a bounded arm at E=0.7 is not penalised for holders it
cannot reach by construction. It was the metric the design leaned on to keep the
comparison honest.

It does not work as computed. `attainable` was derived from the `beat.dir` event as
`holdersInRoster / (holdersInRoster + holdersOutside)` — a fraction of **holders** —
while `recall` is a fraction of **assertions**. A holder outside the roster may back
only one assertion while an inside holder backs six, so recall can legitimately exceed
the holder fraction. In the 44-episode snapshot 8/10 of cell C and 10/12 of cell D had
raw values above 1.0 (max 3.33), and capping at 1.0 piled them at the ceiling. The
resulting table — bounded arms realising ~97%, open arms ~78% — was an artifact of that
cap, not a result. It has been retracted.

An exact denominator needs an assertion -> fact -> holder mapping. The naming
convention does not supply one: across the six scenario instances only 1-4 of 16-20
assertions have an id matching a fact id; the rest are structural (`count`, `exists`)
or renamed. Hand-authoring ~108 mappings after seeing results would be motivated
mapping, so the metric is dropped rather than repaired under time pressure.

What replaces it: `attainable` is reported as a per-episode covariate so the ceiling is
visible, and the primary contrast is read on the **E=0.3 stratum**, where the ceiling
barely binds. E=0.7 is reported as a ceiling check, not as evidence about behaviour.

## `pollutionAbsorbed` was a false-positive detector (found in the pilot, 2026-09-01)

Absorption was counted if **any** number appearing in a distractor's sentence also
appeared in the artifact. Distractor sentences carry incidental numbers — dates, counts,
years — that a correct page contains too, so the metric fired on correct pages. Two
symptoms should have been read as failure earlier: absorption sat flat at 2-3 in all
four cells with no pattern, and a bounded arm reported absorbing 3 distractors in an
episode where it had seen only 1.

A second bug sat underneath: values were matched by substring, so a distractor whose
wrong value was `20` fired on every page mentioning the year `2027`.

Corrected definition: a distractor names the fact it contradicts via `flips`; the wrong
value is the number it carries that the true fact does not; absorbed means the artifact
shows that wrong value bounded by non-digits and does not show the true one. A page
showing both is ambiguous and is not counted. Thousands separators are normalised on
both sides.

Recomputed offline from saved artifacts: 277 of 288 beats changed in the main run.
Corrected absorption is near zero in every cell, which is itself the finding — with four
distractors present and seen, agents almost never adopt the wrong value. The earlier
"no pattern anywhere" was the bug, not the world.

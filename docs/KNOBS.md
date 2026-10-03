# Knobs — protocol

The old task family (conference, lab-dashboard, trip-planner) gave the
canonical result of the study: requirement F1 of A 0.808, B 0.911, C 0.596,
D 0.627 at E in {0.3, 0.7}. This experiment keeps that family unchanged and
asks one question about it: once every holder is reachable (E = 0), does the
private-minus-public difference D − A, and the store contrast S, grow as the
same facts are spread over more holders (dispersion d) and as more wrong
claims are planted around them (interference i)?

|            | sandbox (ask_agent only) | store (+ list_store / read_store) |
|------------|--------------------------|-----------------------------------|
| open       | A                        | B                                 |
| bounded    | C                        | D                                 |

## What is manipulated

**d — dispersion.** How many holders the same 14 facts are spread across.
The original allocation (6 holders for conference, 4 for lab-dashboard and
trip-planner) is d = 2.

- d = 1: the original holder list is split in half in its original order and
  each half is merged into one holder, so every base has two holders. A merged
  holder carries every fact of the roles it absorbs. Its name is
  "Role A and Role B", its tags the union of theirs.
- d = 2: the original allocation, untouched.
- d = 3: every original holder is split so that no holder carries more than
  two facts. A role with k facts becomes ceil(k/2) holders, facts assigned in
  their original order, two per holder, named "Role (1)", "Role (2)", … with
  the original role's tags. The holder count stays at or below 16 so that
  holders plus the 4 builders fit the 20-card roster.

Holder ids at d ≠ 2 are synthetic but card-safe (lowercase letters, digits,
hyphen): `finance-1`, `finance-2`, `venue-program`. The roles table
(`HOLDER_ROLE`) lives in `src/lib/roles.js` so the generator can import it
without a circular import through `directory.js`.

**i — interference.** How many planted distractors: wrong claims placed on a
holder other than the true holder, each naming the fact it contradicts via
`flips`.

- i = 0: none.
- i = 4: the original four of the base instance.
- i = 8: the original four plus four generated ones. Four facts not already
  contradicted and whose text contains a number are chosen by seed; the number
  is perturbed by a seed-chosen factor from {0.5, 0.75, 1.25, 1.5, 2}, rounded
  to the granularity of the original (integers stay integers, decimals keep
  two places), and the next factor is tried if the result equals the original
  or another fact's number. The claim is phrased like the originals (a hedging
  prefix on the original sentence with the number replaced, e.g. "I recall …
  is about <wrong>"), placed on a seed-chosen holder other than the true one,
  and never contains the true value.

Facts, assertions and the brief never change with d or i; the mapping of facts
to holders and the generated distractors depend only on (base, d, i, seed).

**Scenario ids.** `<base>-D<d>-I<i>` with base in `conf`, `lab`, `trip`
(conference, lab-dashboard, trip-planner): 27 ids from `conf-D1-I0` to
`trip-D3-I8`. Ids of one base have equal length, and the directory RNG mixes
the id length into its seed, so the nine cells of a base share one directory
per seed. The scenario objects carry `generated: true` and no `mode` field:
`run.js` leaves them out of its default `--scenarios` list (they run only when
named) and the harness treats them as the old facts family.

## What is held fixed

- The old task family as it was: the same 14 facts per instance, the same
  16-20 assertions in the same order, the same HTML + calculation scoring
  (`src/score.js`), the same responder prompt in the old facts mode, the same
  22-turn requester budget (`STUDY_MAX_ITERS`). Instance A for T1.
- E = 0: every holder is reachable in every arm, so the bounded arms are not
  handicapped by reach and what remains of D − A is formation and access.
- Directory 100 / roster 20, search cap 40, seed profile `control` (the
  control text), reputation off, no edge cost, no relay, k = 1, T1 only
  (`--beats 1`), same model and kernel in every arm.

## Primary question

With A..D the per-cell mean of requirement F1 at one (d, i):

- D − A — the canonical private-minus-public difference the old study reported
- S(d, i) = ½[(B − A) + (D − C)] — store effect
- F(d, i) = ½[(A − C) + (B − D)] — formation effect
- interaction = (B − A) − (D − C); when the two simple effects disagree, S is an
  average over a real interaction and is reported alongside both

The two primary slopes are the hardest cell minus the original allocation:

- Δ(D − A) = D − A at (d = 3, i = 8) − D − A at (d = 2, i = 4)
- ΔS = S at (d = 3, i = 8) − S at (d = 2, i = 4)

A positive slope says the contrast grew with dispersion and interference; it
says nothing about the contrast's sign, so both ends are reported on the same
blocks. D − A and S along one knob at a time (d at i = 4, i at d = 2) are
secondary, as are tokens and the pollution diagnostics.

The unit of pairing is a block: one (base, seed), whose four arms share one
directory and one instance. Every contrast is computed per block, then
averaged; intervals are percentile bootstraps that resample blocks and keep the
four arms of a block together, printed only when n ≥ 5. A block enters a
contrast only when all four arms delivered a parseable artifact; a lost beat is
never averaged in as F1 = 0. Intervals are descriptive and uncorrected.

## Running

Node 22, from the repository root; nothing loads `.env` automatically.

Pilot (the four corner cells of one base, 3 seeds, T1 only). It checks that
the merged and split holders are found, that the generated distractors read
like the originals, and that the paired variance is in range; it is not part
of the confirmatory result:

```
node --env-file=.env src/run.js --run knobs-pilot --scenarios conf-D1-I0,conf-D3-I0,conf-D1-I8,conf-D3-I8 --arms A,B,C,D --E 0 --seeds 3 --beats 1 --par 8
node src/knobs.js knobs-pilot
```

Main sweep: all 27 scenarios, fresh seeds. `--seed-start 4` matters: the
pilot used seeds 1..3, and every instance mapping, distractor set and
directory is a function of the seed, so the main sweep would otherwise re-run
worlds the pilot looked at while choosing the design. Three seeds per base give
nine blocks per cell; use more for intervals worth reading (5 seeds give 15).

```
node --env-file=.env src/run.js --run knobs-main --scenarios conf-D1-I0,conf-D1-I4,conf-D1-I8,conf-D2-I0,conf-D2-I4,conf-D2-I8,conf-D3-I0,conf-D3-I4,conf-D3-I8,lab-D1-I0,lab-D1-I4,lab-D1-I8,lab-D2-I0,lab-D2-I4,lab-D2-I8,lab-D3-I0,lab-D3-I4,lab-D3-I8,trip-D1-I0,trip-D1-I4,trip-D1-I8,trip-D2-I0,trip-D2-I4,trip-D2-I8,trip-D3-I0,trip-D3-I4,trip-D3-I8 --arms A,B,C,D --E 0 --seed-start 4 --seeds 3 --beats 1 --par 8
node src/knobs.js knobs-main
```

`run.js` writes `runs/<run>/manifest.json` before any worker starts and
resumes from `summary.json` on disk, so an interrupted sweep is re-run with the
same command. Do not re-run only the low-scoring episodes.

## Reading knobs.md

`node src/knobs.js <run>` reads `runs/<run>/*/summary.json` (never
`all.json`) and writes `runs/<run>/knobs.md`. Rows outside the fixed settings
above are excluded and counted, never merged. Sections, in order:

1. **Delivery** per (arm, d, i). Read this first. `UNSAFE` or `CAUTION` means
   the cells being compared are not the same population; re-run the affected
   cells before reading anything below. The second table breaks lost beats down
   into `model` (no submission, or an artifact that did not parse) and
   `technical` (a model-call failure, a crash, or the scorer throwing); the
   technical ones are the ones to re-run.
2. **Per-cell means** — n, delivered, F1, pass/total, tokens (k), asks, lists,
   reads, contacted, store use, pooled over bases and then per base. Store use
   near zero in B/D means the affordance was not used, which changes what S
   means. A base whose F1 sits at the ceiling in every arm contributes nothing
   to a slope.
3. **Contrasts per (d, i)** — the 2x2 of F1 and D − A, S, F, B − A, D − C,
   interaction with 95% CIs, the number of complete blocks n, and the blocks
   per base. `incomplete` means no block had all four arms delivered.
4. **Primary slopes** — Δ(D − A) and ΔS on the blocks complete in both cells,
   with both ends on the same blocks and on all blocks; then the one-knob rows
   (three points and end − start).
5. **Tokens** — per-cell means and the store cost B − A and D − C with CIs,
   whole-system and by role.
6. **Pollution** — seen, absorbed and invented per cell. Exposure accounting
   differs between routes: an ask marks every distractor on the card as seen,
   a read only the items returned, so absorbed/seen is not comparable across
   the store axis; absorbed and invented are counted on the page and are.
7. **Notes** — n per cell, definitions, and which beats had their failure kind
   inferred.

A wide interval is "not determined", not "equivalent".

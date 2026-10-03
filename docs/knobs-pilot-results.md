# knobs — knobs-pilot
episodes=48 (summary.json present, on protocol); excluded (off-protocol settings)=0; CRASHED directories=0; planned (manifest)=48

## Delivery (read this before any contrast below)

> This analysis excludes lost beats from every mean and every paired contrast (it does not
> count them as 0): a block enters a contrast only when all four of its arms delivered.

- beats: 48, no artifact: 0 (0%)
- worst cell: arm=A d=1 i=0 at 0%; spread across cells 0%

| cell | beats | no artifact | rate |
|---|---|---|---|
| arm=A d=1 i=0 | 3 | 0 | 0% |
| arm=A d=1 i=8 | 3 | 0 | 0% |
| arm=A d=3 i=0 | 3 | 0 | 0% |
| arm=A d=3 i=8 | 3 | 0 | 0% |
| arm=B d=1 i=0 | 3 | 0 | 0% |
| arm=B d=1 i=8 | 3 | 0 | 0% |
| arm=B d=3 i=0 | 3 | 0 | 0% |
| arm=B d=3 i=8 | 3 | 0 | 0% |
| arm=C d=1 i=0 | 3 | 0 | 0% |
| arm=C d=1 i=8 | 3 | 0 | 0% |
| arm=C d=3 i=0 | 3 | 0 | 0% |
| arm=C d=3 i=8 | 3 | 0 | 0% |
| arm=D d=1 i=0 | 3 | 0 | 0% |
| arm=D d=1 i=8 | 3 | 0 | 0% |
| arm=D d=3 i=0 | 3 | 0 | 0% |
| arm=D d=3 i=8 | 3 | 0 | 0% |


### Planned, summarised, delivered, and failure kinds per cell (T1)

Planned comes from manifest.json; summarised is a summary.json on
protocol; delivered is a parsed artifact. model = the requester ended without a submission or the
artifact did not parse; technical = an LLM call failed, the beat crashed, or the scorer threw.

| d | i | arm | planned | summarised | delivered | model | technical | crashed |
|---|---|---|---|---|---|---|---|---|
| 1 | 0 | A | 3 | 3 | 3 | 0 | 0 | 0 |
| 1 | 0 | B | 3 | 3 | 3 | 0 | 0 | 0 |
| 1 | 0 | C | 3 | 3 | 3 | 0 | 0 | 0 |
| 1 | 0 | D | 3 | 3 | 3 | 0 | 0 | 0 |
| 1 | 8 | A | 3 | 3 | 3 | 0 | 0 | 0 |
| 1 | 8 | B | 3 | 3 | 3 | 0 | 0 | 0 |
| 1 | 8 | C | 3 | 3 | 3 | 0 | 0 | 0 |
| 1 | 8 | D | 3 | 3 | 3 | 0 | 0 | 0 |
| 3 | 0 | A | 3 | 3 | 3 | 0 | 0 | 0 |
| 3 | 0 | B | 3 | 3 | 3 | 0 | 0 | 0 |
| 3 | 0 | C | 3 | 3 | 3 | 0 | 0 | 0 |
| 3 | 0 | D | 3 | 3 | 3 | 0 | 0 | 0 |
| 3 | 8 | A | 3 | 3 | 3 | 0 | 0 | 0 |
| 3 | 8 | B | 3 | 3 | 3 | 0 | 0 | 0 |
| 3 | 8 | C | 3 | 3 | 3 | 0 | 0 | 0 |
| 3 | 8 | D | 3 | 3 | 3 | 0 | 0 | 0 |

## Per-cell means (T1)

F1 = requirement F1 from the scorer, the score of the old study; pass/total = assertions passed
over assertions scored (16-20 per base). Both over delivered beats. asks/lists/reads = tool calls;
contacted = distinct cards the requester asked or read (the beat record's counter); store use =
share of episodes with at least one read_store call. Tokens are whole-system, in thousands,
missing when lost in a crash.

### Pooled over bases

| d | i | arm | n | delivered | F1 | pass/total | tokens (k) | asks | lists | reads | contacted | store use |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | A | 3 | 100% |  0.790 | 15.7/20.0 | 74.2 | 17.0 | 0.0 | 0.0 | 11.3 | 0% |
| 1 | 0 | B | 3 | 100% |  0.647 | 12.3/20.0 | 71.2 | 8.3 | 6.3 | 2.0 | 9.3 | 100% |
| 1 | 0 | C | 3 | 100% |  0.772 | 14.7/20.0 | 62.1 | 14.3 | 0.0 | 0.0 | 5.3 | 0% |
| 1 | 0 | D | 3 | 100% |  0.838 | 16.0/20.0 | 54.5 | 6.0 | 3.3 | 6.3 | 4.3 | 100% |
| 1 | 8 | A | 3 | 100% |  0.717 | 14.3/20.0 | 81.3 | 18.7 | 0.0 | 0.0 | 11.3 | 0% |
| 1 | 8 | B | 3 | 100% |  0.750 | 15.0/20.0 | 71.4 | 7.3 | 4.3 | 2.3 | 5.7 | 100% |
| 1 | 8 | C | 3 | 100% |  0.738 | 14.7/20.0 | 56.5 | 11.7 | 0.0 | 0.0 | 5.3 | 0% |
| 1 | 8 | D | 3 | 100% |  0.773 | 15.3/20.0 | 73.5 | 8.7 | 3.3 | 2.0 | 5.0 | 100% |
| 3 | 0 | A | 3 | 100% |  0.816 | 15.7/20.0 | 108.8 | 39.7 | 0.0 | 0.0 | 29.7 | 0% |
| 3 | 0 | B | 3 | 100% |  0.783 | 15.7/20.0 | 91.1 | 15.0 | 12.0 | 11.3 | 16.3 | 100% |
| 3 | 0 | C | 3 | 100% |  0.689 | 13.3/20.0 | 72.1 | 21.7 | 0.0 | 0.0 | 11.7 | 0% |
| 3 | 0 | D | 3 | 100% |  0.823 | 16.3/20.0 | 71.5 | 8.3 | 10.0 | 11.3 | 11.0 | 100% |
| 3 | 8 | A | 3 | 100% |  0.790 | 15.0/20.0 | 106.9 | 33.3 | 0.0 | 0.0 | 26.7 | 0% |
| 3 | 8 | B | 3 | 100% |  0.787 | 15.3/20.0 | 100.0 | 15.7 | 10.0 | 8.7 | 16.0 | 100% |
| 3 | 8 | C | 3 | 100% |  0.735 | 14.3/20.0 | 97.5 | 22.3 | 0.0 | 0.0 | 12.0 | 0% |
| 3 | 8 | D | 3 | 100% |  0.806 | 16.0/20.0 | 76.0 | 12.0 | 8.7 | 8.7 | 9.7 | 100% |

### Per base

| base | d | i | arm | n | delivered | F1 | pass/total | tokens (k) | asks | lists | reads | contacted | store use |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| conf | 1 | 0 | A | 3 | 100% |  0.790 | 15.7/20.0 | 74.2 | 17.0 | 0.0 | 0.0 | 11.3 | 0% |
| conf | 1 | 0 | B | 3 | 100% |  0.647 | 12.3/20.0 | 71.2 | 8.3 | 6.3 | 2.0 | 9.3 | 100% |
| conf | 1 | 0 | C | 3 | 100% |  0.772 | 14.7/20.0 | 62.1 | 14.3 | 0.0 | 0.0 | 5.3 | 0% |
| conf | 1 | 0 | D | 3 | 100% |  0.838 | 16.0/20.0 | 54.5 | 6.0 | 3.3 | 6.3 | 4.3 | 100% |
| conf | 1 | 8 | A | 3 | 100% |  0.717 | 14.3/20.0 | 81.3 | 18.7 | 0.0 | 0.0 | 11.3 | 0% |
| conf | 1 | 8 | B | 3 | 100% |  0.750 | 15.0/20.0 | 71.4 | 7.3 | 4.3 | 2.3 | 5.7 | 100% |
| conf | 1 | 8 | C | 3 | 100% |  0.738 | 14.7/20.0 | 56.5 | 11.7 | 0.0 | 0.0 | 5.3 | 0% |
| conf | 1 | 8 | D | 3 | 100% |  0.773 | 15.3/20.0 | 73.5 | 8.7 | 3.3 | 2.0 | 5.0 | 100% |
| conf | 3 | 0 | A | 3 | 100% |  0.816 | 15.7/20.0 | 108.8 | 39.7 | 0.0 | 0.0 | 29.7 | 0% |
| conf | 3 | 0 | B | 3 | 100% |  0.783 | 15.7/20.0 | 91.1 | 15.0 | 12.0 | 11.3 | 16.3 | 100% |
| conf | 3 | 0 | C | 3 | 100% |  0.689 | 13.3/20.0 | 72.1 | 21.7 | 0.0 | 0.0 | 11.7 | 0% |
| conf | 3 | 0 | D | 3 | 100% |  0.823 | 16.3/20.0 | 71.5 | 8.3 | 10.0 | 11.3 | 11.0 | 100% |
| conf | 3 | 8 | A | 3 | 100% |  0.790 | 15.0/20.0 | 106.9 | 33.3 | 0.0 | 0.0 | 26.7 | 0% |
| conf | 3 | 8 | B | 3 | 100% |  0.787 | 15.3/20.0 | 100.0 | 15.7 | 10.0 | 8.7 | 16.0 | 100% |
| conf | 3 | 8 | C | 3 | 100% |  0.735 | 14.3/20.0 | 97.5 | 22.3 | 0.0 | 0.0 | 12.0 | 0% |
| conf | 3 | 8 | D | 3 | 100% |  0.806 | 16.0/20.0 | 76.0 | 12.0 | 8.7 | 8.7 | 9.7 | 100% |

## Contrasts per (d, i) — requirement F1, paired by block

D−A is the canonical private-minus-public difference (bounded+store minus open+sandbox), the
number the old study reported. S = ½[(B−A)+(D−C)] is the store effect, F = ½[(A−C)+(B−D)] the
formation effect. If B−A and D−C disagree, S averages over a real interaction; read the
interaction line, not just S. A block is one (base, seed) with all four arms delivered.

### d=1 i=0
```
                sandbox     store
  open         0.790      0.647     A,B
  bounded      0.772      0.838     C,D
```
  D-A                    =  0.048   n too small for an interval   n=3
  S                      = -0.038   n too small for an interval   n=3
  F                      = -0.086   n too small for an interval   n=3
  B-A                    = -0.143   n too small for an interval   n=3
  D-C                    =  0.067   n too small for an interval   n=3
  (B-A)-(D-C)            = -0.210   n too small for an interval   n=3
  blocks by base: conf=3 lab=0 trip=0

### d=2 i=0
  incomplete (no block has all four arms delivered)

### d=3 i=0
```
                sandbox     store
  open         0.816      0.783     A,B
  bounded      0.689      0.823     C,D
```
  D-A                    =  0.007   n too small for an interval   n=3
  S                      =  0.050   n too small for an interval   n=3
  F                      =  0.044   n too small for an interval   n=3
  B-A                    = -0.033   n too small for an interval   n=3
  D-C                    =  0.134   n too small for an interval   n=3
  (B-A)-(D-C)            = -0.167   n too small for an interval   n=3
  blocks by base: conf=3 lab=0 trip=0

### d=1 i=4
  incomplete (no block has all four arms delivered)

### d=2 i=4 (original)
  incomplete (no block has all four arms delivered)

### d=3 i=4
  incomplete (no block has all four arms delivered)

### d=1 i=8
```
                sandbox     store
  open         0.717      0.750     A,B
  bounded      0.738      0.773     C,D
```
  D-A                    =  0.056   n too small for an interval   n=3
  S                      =  0.034   n too small for an interval   n=3
  F                      = -0.022   n too small for an interval   n=3
  B-A                    =  0.033   n too small for an interval   n=3
  D-C                    =  0.035   n too small for an interval   n=3
  (B-A)-(D-C)            = -0.001   n too small for an interval   n=3
  blocks by base: conf=3 lab=0 trip=0

### d=2 i=8
  incomplete (no block has all four arms delivered)

### d=3 i=8 (hardest)
```
                sandbox     store
  open         0.790      0.787     A,B
  bounded      0.735      0.806     C,D
```
  D-A                    =  0.017   n too small for an interval   n=3
  S                      =  0.034   n too small for an interval   n=3
  F                      =  0.018   n too small for an interval   n=3
  B-A                    = -0.003   n too small for an interval   n=3
  D-C                    =  0.071   n too small for an interval   n=3
  (B-A)-(D-C)            = -0.074   n too small for an interval   n=3
  blocks by base: conf=3 lab=0 trip=0

## Primary slopes

Δ(D−A) = D−A at (d=3, i=8) minus D−A at (d=2, i=4): the hardest cell minus the original
allocation, computed per block (a block must have all four arms delivered in both cells) and then
averaged. ΔS is the same for the store effect. A positive slope says the contrast grew as the facts
were dispersed and the distractors doubled; it says nothing about the sign of the contrast itself,
so both ends are printed on the same blocks.

### D-A
  ΔD-A                   incomplete (no complete blocks)   [blocks complete in both cells]
  D-A (3,8) | slope blocks incomplete (no complete blocks)   [same blocks as the slope]
  D-A (2,4) | slope blocks incomplete (no complete blocks)   [same blocks as the slope]
  D-A (3,8) all          =  0.017   n too small for an interval   n=3   [blocks complete at (3,8)]
  D-A (2,4) all          incomplete (no complete blocks)   [blocks complete at (2,4)]

### S
  ΔS                     incomplete (no complete blocks)   [blocks complete in both cells]
  S (3,8) | slope blocks incomplete (no complete blocks)   [same blocks as the slope]
  S (2,4) | slope blocks incomplete (no complete blocks)   [same blocks as the slope]
  S (3,8) all            =  0.034   n too small for an interval   n=3   [blocks complete at (3,8)]
  S (2,4) all            incomplete (no complete blocks)   [blocks complete at (2,4)]

### One knob at a time

D−A and S along dispersion at i=4 and along interference at d=2. Each point is the
contrast over every block complete in that cell (n in parentheses); end − start is the last point
minus the first, per block over the blocks complete at both ends, with its interval.

| contrast | axis | point 1 | point 2 | point 3 | end − start | 95% CI | n |
|---|---|---|---|---|---|---|---|
| D-A | d at i=4 | d=1: incomplete | d=2: incomplete | d=3: incomplete | incomplete | -- | 0 |
| D-A | i at d=2 | i=0: incomplete | i=4: incomplete | i=8: incomplete | incomplete | -- | 0 |
| S | d at i=4 | d=1: incomplete | d=2: incomplete | d=3: incomplete | incomplete | -- | 0 |
| S | i at d=2 | i=0: incomplete | i=4: incomplete | i=8: incomplete | incomplete | -- | 0 |

## Tokens (T1, k) and the token cost of store

Whole-system tokens for the beat, all roles summed, over the same delivered blocks as the F1
contrasts (a beat whose stats were lost in a crash is missing, not 0). The per-role table below
says where a difference sits: listing and reading a holder's store against asking it.

| d | i | A | B | C | D | B−A | 95% CI | D−C | 95% CI | n |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 74.2 | 71.2 | 62.1 | 54.5 | -3.0 | n too small for an interval | -7.6 | n too small for an interval | 3 |
| 3 | 0 | 108.8 | 91.1 | 72.1 | 71.5 | -17.7 | n too small for an interval | -0.6 | n too small for an interval | 3 |
| 1 | 8 | 81.3 | 71.4 | 56.5 | 73.5 | -9.9 | n too small for an interval | 17.0 | n too small for an interval | 3 |
| 3 | 8 | 106.9 | 100.0 | 97.5 | 76.0 | -6.9 | n too small for an interval | -21.5 | n too small for an interval | 3 |

### Tokens by role (T1, k)

Summed from the llm events of the beat by tag: req.* = requester, ask.* = responder, build.* =
builder, consult.* = builder consults (shown when non-zero). Same per-block contrasts as above.

| d | i | role | A | B | C | D | B−A | 95% CI | D−C | 95% CI | n |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | requester | 65.6 | 65.5 | 51.6 | 46.2 | -0.1 | n too small for an interval | -5.4 | n too small for an interval | 3 |
| 1 | 0 | responder | 5.0 | 1.9 | 6.3 | 1.9 | -3.0 | n too small for an interval | -4.4 | n too small for an interval | 3 |
| 1 | 0 | builder | 2.8 | 3.0 | 3.2 | 4.1 | 0.3 | n too small for an interval | 0.9 | n too small for an interval | 3 |
| 1 | 0 | consult | 0.8 | 0.7 | 1.0 | 2.3 | -0.1 | n too small for an interval | 1.4 | n too small for an interval | 3 |
| 3 | 0 | requester | 94.6 | 83.7 | 62.4 | 64.4 | -10.9 | n too small for an interval | 2.0 | n too small for an interval | 3 |
| 3 | 0 | responder | 10.8 | 2.7 | 6.2 | 2.0 | -8.1 | n too small for an interval | -4.2 | n too small for an interval | 3 |
| 3 | 0 | builder | 2.6 | 3.9 | 2.7 | 4.1 | 1.3 | n too small for an interval | 1.5 | n too small for an interval | 3 |
| 3 | 0 | consult | 0.8 | 0.8 | 0.8 | 1.0 | -0.0 | n too small for an interval | 0.2 | n too small for an interval | 3 |
| 1 | 8 | requester | 68.9 | 65.5 | 47.1 | 66.6 | -3.4 | n too small for an interval | 19.5 | n too small for an interval | 3 |
| 1 | 8 | responder | 6.4 | 1.9 | 5.5 | 3.3 | -4.5 | n too small for an interval | -2.2 | n too small for an interval | 3 |
| 1 | 8 | builder | 5.3 | 3.3 | 3.1 | 2.8 | -2.0 | n too small for an interval | -0.3 | n too small for an interval | 3 |
| 1 | 8 | consult | 0.7 | 0.7 | 0.8 | 0.9 | 0.0 | n too small for an interval | 0.1 | n too small for an interval | 3 |
| 3 | 8 | requester | 94.4 | 92.3 | 81.7 | 68.0 | -2.0 | n too small for an interval | -13.7 | n too small for an interval | 3 |
| 3 | 8 | responder | 9.9 | 3.1 | 7.5 | 3.2 | -6.8 | n too small for an interval | -4.3 | n too small for an interval | 3 |
| 3 | 8 | builder | 2.0 | 3.8 | 6.2 | 4.0 | 1.8 | n too small for an interval | -2.2 | n too small for an interval | 3 |
| 3 | 8 | consult | 0.7 | 0.8 | 2.1 | 0.8 | 0.1 | n too small for an interval | -1.3 | n too small for an interval | 3 |

## Pollution (diagnostics, per cell)

seen = planted distractors the requester was exposed to; absorbed = of those, how many wrong values
the page carries; invented = wrong values on the page that no distractor supplied. Over delivered
beats. At i=0 there is nothing to see or absorb by construction.

> **Exposure accounting differs between the ask and read routes.** An ask_agent call (and a builder
> consult) marks every distractor planted on that card as seen, whether or not the answer mentioned
> it; a read_store call marks only the planted items actually returned (all of them on a full read,
> one on an indexed read). A list_store call marks nothing. "seen" is therefore an upper bound in
> the sandbox arms and an exact count in the store arms, and absorbed/seen is not comparable across
> the store axis. Absorbed and invented are counted on the page and are comparable.

| d | i | arm | n | seen | absorbed | invented | absorbed/seen |
|---|---|---|---|---|---|---|---|
| 1 | 0 | A | 3 |  0.000 |  0.000 |  0.000 | n/a |
| 1 | 0 | B | 3 |  0.000 |  0.000 |  0.000 | n/a |
| 1 | 0 | C | 3 |  0.000 |  0.000 |  0.000 | n/a |
| 1 | 0 | D | 3 |  0.000 |  0.000 |  0.000 | n/a |
| 1 | 8 | A | 3 |  8.000 |  0.000 |  0.000 |  0.000 |
| 1 | 8 | B | 3 |  8.000 |  0.333 |  0.000 |  0.042 |
| 1 | 8 | C | 3 |  8.000 |  0.000 |  0.000 |  0.000 |
| 1 | 8 | D | 3 |  8.000 |  0.000 |  0.000 |  0.000 |
| 3 | 0 | A | 3 |  0.000 |  0.000 |  0.000 | n/a |
| 3 | 0 | B | 3 |  0.000 |  0.000 |  0.000 | n/a |
| 3 | 0 | C | 3 |  0.000 |  0.000 |  0.000 | n/a |
| 3 | 0 | D | 3 |  0.000 |  0.000 |  0.000 | n/a |
| 3 | 8 | A | 3 |  8.000 |  0.333 |  0.000 |  0.042 |
| 3 | 8 | B | 3 |  7.667 |  0.000 |  0.000 |  0.000 |
| 3 | 8 | C | 3 |  8.000 |  0.000 |  0.000 |  0.000 |
| 3 | 8 | D | 3 |  7.667 |  0.667 |  0.000 |  0.087 |

## Notes

- n per cell (summarised, on protocol, pooled over bases): D1I0A=3, D1I0B=3, D1I0C=3, D1I0D=3, D1I8A=3, D1I8B=3, D1I8C=3, D1I8D=3, D3I0A=3, D3I0B=3, D3I0C=3, D3I0D=3, D3I8A=3, D3I8B=3, D3I8C=3, D3I8D=3.
- episodes per base: conference=48, lab-dashboard=0, trip-planner=0. Scenario ids are <base>-D<d>-I<i> with base in conf, lab, trip.
- Rows are restricted to the protocol settings (E=0, k=1, seedProfile=control, edgeCost=0, relayDepth=0, dirSize=100, reputation=off, searchCap=40);
  0 row(s) were excluded for other settings, and 0 CRASHED directories never wrote a summary.
- The metric is requirement F1 at T1 from the beat record (`f1`), the score the old study reported.
  pass/total, asks, lists, reads, contacted, pollutionSeen, pollutionAbsorbed and wrongInvented are
  read from the same record; tokens by role come from the llm events of the beat.
- delivered = parsed && artifactLen > 0. Beats that produced no artifact are excluded from every
  mean and from every paired contrast; a block (one base and seed) needs all four arms delivered to
  enter. Nothing counts a lost beat as F1 = 0; the delivery table above is the place to look before
  reading any contrast. (The delivery module's "counts a lost beat as F1 = 0" note describes the
  older analyzers, not this one.) Token contrasts use the same delivered blocks, so an undelivered
  beat's cost is in the per-cell token means only when its stats survived.
- All intervals are descriptive 95% percentile bootstraps over blocks, keeping the four arms of a
  block together, printed only when n ≥ 5. Blocks pool the three bases: a base contributes
  one block per seed. They are not corrected for multiple comparisons.
- failureKind was read from the beat record.
# knobs — knobs-main
episodes=540 (summary.json present, on protocol); excluded (off-protocol settings)=0; CRASHED directories=0; planned (manifest)=540

## Delivery (read this before any contrast below)

> This analysis excludes lost beats from every mean and every paired contrast (it does not
> count them as 0): a block enters a contrast only when all four of its arms delivered.

- beats: 540, no artifact: 12 (2%)
- worst cell: arm=A d=2 i=0 at 20%; spread across cells 20%

| cell | beats | no artifact | rate |
|---|---|---|---|
| arm=A d=2 i=0 | 15 | 3 | 20% |
| arm=A d=3 i=4 | 15 | 2 | 13% |
| arm=C d=3 i=0 | 15 | 2 | 13% |
| arm=A d=3 i=8 | 15 | 1 | 7% |
| arm=B d=1 i=4 | 15 | 1 | 7% |
| arm=C d=2 i=8 | 15 | 1 | 7% |
| arm=D d=3 i=0 | 15 | 1 | 7% |
| arm=D d=3 i=4 | 15 | 1 | 7% |
| arm=A d=1 i=0 | 15 | 0 | 0% |
| arm=A d=1 i=4 | 15 | 0 | 0% |
| arm=A d=1 i=8 | 15 | 0 | 0% |
| arm=A d=2 i=4 | 15 | 0 | 0% |
| arm=A d=2 i=8 | 15 | 0 | 0% |
| arm=A d=3 i=0 | 15 | 0 | 0% |
| arm=B d=1 i=0 | 15 | 0 | 0% |
| arm=B d=1 i=8 | 15 | 0 | 0% |
| arm=B d=2 i=0 | 15 | 0 | 0% |
| arm=B d=2 i=4 | 15 | 0 | 0% |
| arm=B d=2 i=8 | 15 | 0 | 0% |
| arm=B d=3 i=0 | 15 | 0 | 0% |
| arm=B d=3 i=4 | 15 | 0 | 0% |
| arm=B d=3 i=8 | 15 | 0 | 0% |
| arm=C d=1 i=0 | 15 | 0 | 0% |
| arm=C d=1 i=4 | 15 | 0 | 0% |
| arm=C d=1 i=8 | 15 | 0 | 0% |
| arm=C d=2 i=0 | 15 | 0 | 0% |
| arm=C d=2 i=4 | 15 | 0 | 0% |
| arm=C d=3 i=4 | 15 | 0 | 0% |
| arm=C d=3 i=8 | 15 | 0 | 0% |
| arm=D d=1 i=0 | 15 | 0 | 0% |
| arm=D d=1 i=4 | 15 | 0 | 0% |
| arm=D d=1 i=8 | 15 | 0 | 0% |
| arm=D d=2 i=0 | 15 | 0 | 0% |
| arm=D d=2 i=4 | 15 | 0 | 0% |
| arm=D d=2 i=8 | 15 | 0 | 0% |
| arm=D d=3 i=8 | 15 | 0 | 0% |

> **UNSAFE — do not read the contrasts below as effects.** Delivery differs by more
> than 15 points across cells, so the cells being compared are not the same
> population. Every mean below counts a lost beat as F1 = 0. Re-run the affected
> cells, or recompute conditional on delivery and report the delivery rate itself.

### Planned, summarised, delivered, and failure kinds per cell (T1)

Planned comes from manifest.json; summarised is a summary.json on
protocol; delivered is a parsed artifact. model = the requester ended without a submission or the
artifact did not parse; technical = an LLM call failed, the beat crashed, or the scorer threw.

| d | i | arm | planned | summarised | delivered | model | technical | crashed |
|---|---|---|---|---|---|---|---|---|
| 1 | 0 | A | 15 | 15 | 15 | 0 | 0 | 0 |
| 1 | 0 | B | 15 | 15 | 15 | 0 | 0 | 0 |
| 1 | 0 | C | 15 | 15 | 15 | 0 | 0 | 0 |
| 1 | 0 | D | 15 | 15 | 15 | 0 | 0 | 0 |
| 1 | 4 | A | 15 | 15 | 15 | 0 | 0 | 0 |
| 1 | 4 | B | 15 | 15 | 14 | 1 | 0 | 0 |
| 1 | 4 | C | 15 | 15 | 15 | 0 | 0 | 0 |
| 1 | 4 | D | 15 | 15 | 15 | 0 | 0 | 0 |
| 1 | 8 | A | 15 | 15 | 15 | 0 | 0 | 0 |
| 1 | 8 | B | 15 | 15 | 15 | 0 | 0 | 0 |
| 1 | 8 | C | 15 | 15 | 15 | 0 | 0 | 0 |
| 1 | 8 | D | 15 | 15 | 15 | 0 | 0 | 0 |
| 2 | 0 | A | 15 | 15 | 12 | 3 | 0 | 0 |
| 2 | 0 | B | 15 | 15 | 15 | 0 | 0 | 0 |
| 2 | 0 | C | 15 | 15 | 15 | 0 | 0 | 0 |
| 2 | 0 | D | 15 | 15 | 15 | 0 | 0 | 0 |
| 2 | 4 | A | 15 | 15 | 15 | 0 | 0 | 0 |
| 2 | 4 | B | 15 | 15 | 15 | 0 | 0 | 0 |
| 2 | 4 | C | 15 | 15 | 15 | 0 | 0 | 0 |
| 2 | 4 | D | 15 | 15 | 15 | 0 | 0 | 0 |
| 2 | 8 | A | 15 | 15 | 15 | 0 | 0 | 0 |
| 2 | 8 | B | 15 | 15 | 15 | 0 | 0 | 0 |
| 2 | 8 | C | 15 | 15 | 14 | 1 | 0 | 0 |
| 2 | 8 | D | 15 | 15 | 15 | 0 | 0 | 0 |
| 3 | 0 | A | 15 | 15 | 15 | 0 | 0 | 0 |
| 3 | 0 | B | 15 | 15 | 15 | 0 | 0 | 0 |
| 3 | 0 | C | 15 | 15 | 13 | 2 | 0 | 0 |
| 3 | 0 | D | 15 | 15 | 14 | 1 | 0 | 0 |
| 3 | 4 | A | 15 | 15 | 13 | 2 | 0 | 0 |
| 3 | 4 | B | 15 | 15 | 15 | 0 | 0 | 0 |
| 3 | 4 | C | 15 | 15 | 15 | 0 | 0 | 0 |
| 3 | 4 | D | 15 | 15 | 14 | 1 | 0 | 0 |
| 3 | 8 | A | 15 | 15 | 14 | 1 | 0 | 0 |
| 3 | 8 | B | 15 | 15 | 15 | 0 | 0 | 0 |
| 3 | 8 | C | 15 | 15 | 15 | 0 | 0 | 0 |
| 3 | 8 | D | 15 | 15 | 15 | 0 | 0 | 0 |

## Per-cell means (T1)

F1 = requirement F1 from the scorer, the score of the old study; pass/total = assertions passed
over assertions scored (16-20 per base). Both over delivered beats. asks/lists/reads = tool calls;
contacted = distinct cards the requester asked or read (the beat record's counter); store use =
share of episodes with at least one read_store call. Tokens are whole-system, in thousands,
missing when lost in a crash.

### Pooled over bases

| d | i | arm | n | delivered | F1 | pass/total | tokens (k) | asks | lists | reads | contacted | store use |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | A | 15 | 100% |  0.867 | 15.6/18.0 | 65.9 | 15.6 | 0.0 | 0.0 | 10.9 | 0% |
| 1 | 0 | B | 15 | 100% |  0.859 | 15.2/18.0 | 48.9 | 6.1 | 3.6 | 4.1 | 7.9 | 100% |
| 1 | 0 | C | 15 | 100% |  0.859 | 15.2/18.0 | 43.3 | 9.7 | 0.0 | 0.0 | 4.9 | 0% |
| 1 | 0 | D | 15 | 100% |  0.858 | 15.1/18.0 | 37.7 | 2.9 | 4.3 | 3.8 | 4.7 | 100% |
| 1 | 4 | A | 15 | 100% |  0.907 | 16.1/18.0 | 64.3 | 17.1 | 0.0 | 0.0 | 11.8 | 0% |
| 1 | 4 | B | 15 | 93% |  0.935 | 16.9/18.1 | 68.2 | 8.7 | 4.4 | 3.3 | 9.3 | 100% |
| 1 | 4 | C | 15 | 100% |  0.794 | 14.3/18.0 | 44.7 | 10.1 | 0.0 | 0.0 | 5.3 | 0% |
| 1 | 4 | D | 15 | 100% |  0.891 | 15.9/18.0 | 48.8 | 4.5 | 4.5 | 6.0 | 5.3 | 100% |
| 1 | 8 | A | 15 | 100% |  0.879 | 15.7/18.0 | 68.6 | 17.0 | 0.0 | 0.0 | 11.9 | 0% |
| 1 | 8 | B | 15 | 100% |  0.896 | 15.9/18.0 | 62.1 | 7.3 | 4.8 | 2.8 | 8.5 | 100% |
| 1 | 8 | C | 15 | 100% |  0.792 | 14.3/18.0 | 42.7 | 9.5 | 0.0 | 0.0 | 5.2 | 0% |
| 1 | 8 | D | 15 | 100% |  0.915 | 16.3/18.0 | 56.5 | 5.6 | 4.7 | 2.3 | 5.4 | 93% |
| 2 | 0 | A | 15 | 80% |  0.805 | 14.3/18.2 | 89.2 | 23.3 | 0.0 | 0.0 | 17.9 | 0% |
| 2 | 0 | B | 15 | 100% |  0.838 | 14.7/18.0 | 59.5 | 9.9 | 4.9 | 4.7 | 12.1 | 93% |
| 2 | 0 | C | 15 | 100% |  0.830 | 14.7/18.0 | 56.3 | 12.7 | 0.0 | 0.0 | 7.3 | 0% |
| 2 | 0 | D | 15 | 100% |  0.874 | 15.3/18.0 | 44.4 | 4.9 | 5.8 | 4.4 | 7.3 | 100% |
| 2 | 4 | A | 15 | 100% |  0.774 | 13.8/18.0 | 84.0 | 19.1 | 0.0 | 0.0 | 14.5 | 0% |
| 2 | 4 | B | 15 | 100% |  0.833 | 14.9/18.0 | 74.3 | 10.5 | 6.1 | 7.2 | 12.3 | 100% |
| 2 | 4 | C | 15 | 100% |  0.870 | 15.3/18.0 | 50.7 | 10.5 | 0.0 | 0.0 | 7.0 | 0% |
| 2 | 4 | D | 15 | 100% |  0.890 | 15.9/18.0 | 56.0 | 5.9 | 5.1 | 6.1 | 6.9 | 100% |
| 2 | 8 | A | 15 | 100% |  0.817 | 14.5/18.0 | 79.6 | 18.9 | 0.0 | 0.0 | 14.8 | 0% |
| 2 | 8 | B | 15 | 100% |  0.884 | 15.5/18.0 | 80.8 | 13.1 | 5.9 | 6.1 | 14.0 | 100% |
| 2 | 8 | C | 15 | 93% |  0.781 | 13.9/18.0 | 53.3 | 11.5 | 0.0 | 0.0 | 7.1 | 0% |
| 2 | 8 | D | 15 | 100% |  0.848 | 14.9/18.0 | 50.1 | 6.3 | 4.3 | 3.5 | 6.3 | 93% |
| 3 | 0 | A | 15 | 100% |  0.740 | 12.9/18.0 | 105.4 | 30.7 | 0.0 | 0.0 | 21.7 | 0% |
| 3 | 0 | B | 15 | 100% |  0.883 | 15.7/18.0 | 69.2 | 12.5 | 8.7 | 7.3 | 17.3 | 100% |
| 3 | 0 | C | 15 | 87% |  0.767 | 13.5/18.2 | 77.7 | 19.2 | 0.0 | 0.0 | 10.1 | 0% |
| 3 | 0 | D | 15 | 93% |  0.851 | 15.1/18.0 | 51.8 | 7.7 | 8.3 | 8.1 | 10.0 | 100% |
| 3 | 4 | A | 15 | 87% |  0.774 | 13.8/18.2 | 89.5 | 27.7 | 0.0 | 0.0 | 20.5 | 0% |
| 3 | 4 | B | 15 | 100% |  0.931 | 16.4/18.0 | 87.5 | 14.8 | 11.3 | 9.9 | 18.7 | 100% |
| 3 | 4 | C | 15 | 100% |  0.831 | 14.7/18.0 | 70.2 | 19.3 | 0.0 | 0.0 | 9.7 | 0% |
| 3 | 4 | D | 15 | 93% |  0.896 | 15.9/18.1 | 69.3 | 9.2 | 8.9 | 8.9 | 10.2 | 100% |
| 3 | 8 | A | 15 | 93% |  0.845 | 14.6/18.0 | 100.1 | 29.4 | 0.0 | 0.0 | 22.6 | 0% |
| 3 | 8 | B | 15 | 100% |  0.882 | 15.6/18.0 | 94.3 | 19.3 | 9.5 | 7.9 | 20.6 | 100% |
| 3 | 8 | C | 15 | 100% |  0.759 | 13.2/18.0 | 77.5 | 19.1 | 0.0 | 0.0 | 9.5 | 0% |
| 3 | 8 | D | 15 | 100% |  0.888 | 15.6/18.0 | 85.9 | 11.8 | 8.1 | 8.3 | 9.7 | 100% |

### Per base

| base | d | i | arm | n | delivered | F1 | pass/total | tokens (k) | asks | lists | reads | contacted | store use |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| conf | 1 | 0 | A | 5 | 100% |  0.790 | 15.8/20.0 | 73.2 | 18.4 | 0.0 | 0.0 | 9.8 | 0% |
| conf | 1 | 0 | B | 5 | 100% |  0.703 | 13.6/20.0 | 74.1 | 11.6 | 4.6 | 5.6 | 10.8 | 100% |
| conf | 1 | 0 | C | 5 | 100% |  0.790 | 15.0/20.0 | 60.6 | 15.6 | 0.0 | 0.0 | 4.4 | 0% |
| conf | 1 | 0 | D | 5 | 100% |  0.620 | 12.4/20.0 | 59.7 | 7.2 | 5.0 | 4.4 | 5.0 | 100% |
| conf | 1 | 4 | A | 5 | 100% |  0.791 | 15.6/20.0 | 84.1 | 23.4 | 0.0 | 0.0 | 13.6 | 0% |
| conf | 1 | 4 | B | 5 | 100% |  0.830 | 16.6/20.0 | 79.2 | 8.2 | 4.2 | 5.2 | 7.2 | 100% |
| conf | 1 | 4 | C | 5 | 100% |  0.730 | 14.6/20.0 | 60.5 | 15.4 | 0.0 | 0.0 | 5.4 | 0% |
| conf | 1 | 4 | D | 5 | 100% |  0.724 | 14.4/20.0 | 66.3 | 7.2 | 3.6 | 10.6 | 4.8 | 100% |
| conf | 1 | 8 | A | 5 | 100% |  0.811 | 16.0/20.0 | 88.3 | 23.8 | 0.0 | 0.0 | 13.2 | 0% |
| conf | 1 | 8 | B | 5 | 100% |  0.700 | 14.0/20.0 | 80.7 | 10.6 | 5.8 | 2.4 | 9.6 | 100% |
| conf | 1 | 8 | C | 5 | 100% |  0.740 | 14.8/20.0 | 65.8 | 15.4 | 0.0 | 0.0 | 5.6 | 0% |
| conf | 1 | 8 | D | 5 | 100% |  0.770 | 15.4/20.0 | 71.1 | 7.6 | 4.4 | 2.0 | 4.8 | 100% |
| conf | 2 | 0 | A | 5 | 100% |  0.774 | 15.4/20.0 | 83.6 | 25.2 | 0.0 | 0.0 | 18.4 | 0% |
| conf | 2 | 0 | B | 5 | 100% |  0.710 | 14.2/20.0 | 80.4 | 12.8 | 4.4 | 6.8 | 14.4 | 100% |
| conf | 2 | 0 | C | 5 | 100% |  0.823 | 16.2/20.0 | 55.9 | 12.8 | 0.0 | 0.0 | 8.4 | 0% |
| conf | 2 | 0 | D | 5 | 100% |  0.783 | 15.4/20.0 | 48.2 | 6.2 | 6.0 | 4.2 | 8.4 | 100% |
| conf | 2 | 4 | A | 5 | 100% |  0.773 | 15.4/20.0 | 77.7 | 18.2 | 0.0 | 0.0 | 14.8 | 0% |
| conf | 2 | 4 | B | 5 | 100% |  0.720 | 14.4/20.0 | 94.7 | 13.4 | 8.0 | 7.6 | 14.6 | 100% |
| conf | 2 | 4 | C | 5 | 100% |  0.833 | 16.2/20.0 | 46.1 | 10.6 | 0.0 | 0.0 | 8.2 | 0% |
| conf | 2 | 4 | D | 5 | 100% |  0.784 | 15.6/20.0 | 55.9 | 8.4 | 4.8 | 3.8 | 8.0 | 100% |
| conf | 2 | 8 | A | 5 | 100% |  0.730 | 14.6/20.0 | 76.7 | 18.8 | 0.0 | 0.0 | 15.8 | 0% |
| conf | 2 | 8 | B | 5 | 100% |  0.797 | 15.6/20.0 | 89.7 | 12.6 | 7.0 | 6.8 | 13.2 | 100% |
| conf | 2 | 8 | C | 5 | 100% |  0.750 | 15.0/20.0 | 61.9 | 12.8 | 0.0 | 0.0 | 8.2 | 0% |
| conf | 2 | 8 | D | 5 | 100% |  0.710 | 14.2/20.0 | 53.2 | 7.8 | 5.0 | 5.4 | 7.4 | 80% |
| conf | 3 | 0 | A | 5 | 100% |  0.798 | 15.4/20.0 | 115.8 | 35.8 | 0.0 | 0.0 | 26.0 | 0% |
| conf | 3 | 0 | B | 5 | 100% |  0.765 | 15.2/20.0 | 93.8 | 15.4 | 10.0 | 9.6 | 21.0 | 100% |
| conf | 3 | 0 | C | 5 | 100% |  0.694 | 13.4/20.0 | 70.3 | 17.2 | 0.0 | 0.0 | 10.2 | 0% |
| conf | 3 | 0 | D | 5 | 100% |  0.780 | 15.6/20.0 | 62.6 | 7.4 | 10.4 | 9.0 | 11.2 | 100% |
| conf | 3 | 4 | A | 5 | 100% |  0.808 | 15.6/20.0 | 92.1 | 27.2 | 0.0 | 0.0 | 21.6 | 0% |
| conf | 3 | 4 | B | 5 | 100% |  0.817 | 16.0/20.0 | 101.5 | 18.4 | 8.4 | 11.2 | 19.4 | 100% |
| conf | 3 | 4 | C | 5 | 100% |  0.787 | 15.2/20.0 | 69.8 | 19.2 | 0.0 | 0.0 | 10.4 | 0% |
| conf | 3 | 4 | D | 5 | 100% |  0.761 | 15.0/20.0 | 77.4 | 10.6 | 9.0 | 9.2 | 11.0 | 100% |
| conf | 3 | 8 | A | 5 | 100% |  0.811 | 15.2/20.0 | 98.2 | 31.2 | 0.0 | 0.0 | 24.8 | 0% |
| conf | 3 | 8 | B | 5 | 100% |  0.787 | 15.4/20.0 | 115.0 | 23.2 | 13.4 | 10.0 | 25.0 | 100% |
| conf | 3 | 8 | C | 5 | 100% |  0.729 | 13.8/20.0 | 80.6 | 19.8 | 0.0 | 0.0 | 10.4 | 0% |
| conf | 3 | 8 | D | 5 | 100% |  0.825 | 16.0/20.0 | 92.8 | 11.4 | 9.6 | 7.4 | 10.6 | 100% |
| lab | 1 | 0 | A | 5 | 100% |  1.000 | 18.0/18.0 | 57.9 | 17.4 | 0.0 | 0.0 | 15.4 | 0% |
| lab | 1 | 0 | B | 5 | 100% |  1.000 | 18.0/18.0 | 32.2 | 3.2 | 3.4 | 2.2 | 6.2 | 100% |
| lab | 1 | 0 | C | 5 | 100% |  1.000 | 18.0/18.0 | 38.3 | 8.8 | 0.0 | 0.0 | 6.0 | 0% |
| lab | 1 | 0 | D | 5 | 100% |  1.000 | 18.0/18.0 | 22.9 | 0.0 | 3.8 | 4.4 | 4.2 | 100% |
| lab | 1 | 4 | A | 5 | 100% |  0.994 | 17.8/18.0 | 50.0 | 15.2 | 0.0 | 0.0 | 11.4 | 0% |
| lab | 1 | 4 | B | 5 | 100% |  1.000 | 18.0/18.0 | 47.5 | 5.0 | 5.2 | 2.0 | 9.0 | 100% |
| lab | 1 | 4 | C | 5 | 100% |  0.994 | 17.8/18.0 | 34.9 | 7.6 | 0.0 | 0.0 | 5.2 | 0% |
| lab | 1 | 4 | D | 5 | 100% |  1.000 | 18.0/18.0 | 36.9 | 2.6 | 4.8 | 5.4 | 5.6 | 100% |
| lab | 1 | 8 | A | 5 | 100% |  0.983 | 17.6/18.0 | 61.7 | 14.6 | 0.0 | 0.0 | 12.2 | 0% |
| lab | 1 | 8 | B | 5 | 100% |  1.000 | 18.0/18.0 | 55.8 | 5.6 | 5.8 | 4.0 | 9.8 | 100% |
| lab | 1 | 8 | C | 5 | 100% |  0.994 | 17.8/18.0 | 34.8 | 8.8 | 0.0 | 0.0 | 5.8 | 0% |
| lab | 1 | 8 | D | 5 | 100% |  1.000 | 18.0/18.0 | 37.9 | 2.0 | 4.8 | 2.0 | 5.2 | 100% |
| lab | 2 | 0 | A | 5 | 60% |  0.800 | 14.0/18.0 | 126.0 | 32.2 | 0.0 | 0.0 | 23.6 | 0% |
| lab | 2 | 0 | B | 5 | 100% |  0.970 | 17.2/18.0 | 40.6 | 6.8 | 5.6 | 4.6 | 10.4 | 100% |
| lab | 2 | 0 | C | 5 | 100% |  0.798 | 14.0/18.0 | 70.4 | 17.4 | 0.0 | 0.0 | 7.4 | 0% |
| lab | 2 | 0 | D | 5 | 100% |  0.933 | 16.2/18.0 | 38.9 | 4.8 | 6.0 | 5.8 | 7.0 | 100% |
| lab | 2 | 4 | A | 5 | 100% |  0.840 | 14.8/18.0 | 115.1 | 28.8 | 0.0 | 0.0 | 20.0 | 0% |
| lab | 2 | 4 | B | 5 | 100% |  1.000 | 18.0/18.0 | 65.5 | 9.0 | 6.4 | 10.6 | 13.0 | 100% |
| lab | 2 | 4 | C | 5 | 100% |  0.853 | 15.2/18.0 | 66.3 | 15.6 | 0.0 | 0.0 | 7.0 | 0% |
| lab | 2 | 4 | D | 5 | 100% |  1.000 | 18.0/18.0 | 64.5 | 5.2 | 6.0 | 9.2 | 6.8 | 100% |
| lab | 2 | 8 | A | 5 | 100% |  0.955 | 17.0/18.0 | 84.5 | 22.4 | 0.0 | 0.0 | 15.8 | 0% |
| lab | 2 | 8 | B | 5 | 100% |  0.937 | 16.6/18.0 | 84.6 | 14.8 | 8.0 | 8.2 | 18.0 | 100% |
| lab | 2 | 8 | C | 5 | 80% |  0.901 | 16.0/18.0 | 64.2 | 15.2 | 0.0 | 0.0 | 6.8 | 0% |
| lab | 2 | 8 | D | 5 | 100% |  0.949 | 16.8/18.0 | 54.5 | 5.8 | 4.8 | 3.0 | 6.0 | 100% |
| lab | 3 | 0 | A | 5 | 100% |  0.681 | 11.8/18.0 | 130.0 | 35.8 | 0.0 | 0.0 | 22.0 | 0% |
| lab | 3 | 0 | B | 5 | 100% |  0.994 | 17.8/18.0 | 46.5 | 7.8 | 7.8 | 7.4 | 13.6 | 100% |
| lab | 3 | 0 | C | 5 | 80% |  0.862 | 15.3/18.0 | 89.4 | 23.4 | 0.0 | 0.0 | 10.0 | 0% |
| lab | 3 | 0 | D | 5 | 80% |  0.993 | 17.8/18.0 | 35.4 | 5.0 | 7.8 | 8.0 | 8.6 | 100% |
| lab | 3 | 4 | A | 5 | 80% |  0.900 | 16.0/18.0 | 103.6 | 32.0 | 0.0 | 0.0 | 20.8 | 0% |
| lab | 3 | 4 | B | 5 | 100% |  0.994 | 17.8/18.0 | 76.3 | 11.6 | 13.2 | 13.0 | 16.8 | 100% |
| lab | 3 | 4 | C | 5 | 100% |  0.994 | 17.8/18.0 | 83.5 | 23.0 | 0.0 | 0.0 | 9.8 | 0% |
| lab | 3 | 4 | D | 5 | 100% |  1.000 | 18.0/18.0 | 67.7 | 8.4 | 9.4 | 11.2 | 10.4 | 100% |
| lab | 3 | 8 | A | 5 | 80% |  0.829 | 14.5/18.0 | 116.9 | 34.0 | 0.0 | 0.0 | 23.2 | 0% |
| lab | 3 | 8 | B | 5 | 100% |  0.994 | 17.8/18.0 | 85.8 | 17.6 | 7.8 | 7.2 | 19.6 | 100% |
| lab | 3 | 8 | C | 5 | 100% |  0.858 | 15.0/18.0 | 90.1 | 23.6 | 0.0 | 0.0 | 8.8 | 0% |
| lab | 3 | 8 | D | 5 | 100% |  0.967 | 17.4/18.0 | 101.9 | 15.0 | 8.6 | 11.8 | 10.0 | 100% |
| trip | 1 | 0 | A | 5 | 100% |  0.813 | 13.0/16.0 | 66.7 | 11.0 | 0.0 | 0.0 | 7.6 | 0% |
| trip | 1 | 0 | B | 5 | 100% |  0.875 | 14.0/16.0 | 40.4 | 3.4 | 2.8 | 4.4 | 6.8 | 100% |
| trip | 1 | 0 | C | 5 | 100% |  0.787 | 12.6/16.0 | 31.0 | 4.8 | 0.0 | 0.0 | 4.2 | 0% |
| trip | 1 | 0 | D | 5 | 100% |  0.954 | 14.8/16.0 | 30.6 | 1.6 | 4.2 | 2.6 | 4.8 | 100% |
| trip | 1 | 4 | A | 5 | 100% |  0.938 | 15.0/16.0 | 58.7 | 12.6 | 0.0 | 0.0 | 10.4 | 0% |
| trip | 1 | 4 | B | 5 | 80% |  0.984 | 15.8/16.0 | 78.0 | 13.0 | 3.8 | 2.6 | 11.8 | 100% |
| trip | 1 | 4 | C | 5 | 100% |  0.657 | 10.4/16.0 | 38.7 | 7.2 | 0.0 | 0.0 | 5.4 | 0% |
| trip | 1 | 4 | D | 5 | 100% |  0.950 | 15.2/16.0 | 43.0 | 3.8 | 5.2 | 2.0 | 5.4 | 100% |
| trip | 1 | 8 | A | 5 | 100% |  0.843 | 13.4/16.0 | 55.7 | 12.6 | 0.0 | 0.0 | 10.4 | 0% |
| trip | 1 | 8 | B | 5 | 100% |  0.988 | 15.8/16.0 | 49.8 | 5.8 | 2.8 | 2.0 | 6.0 | 100% |
| trip | 1 | 8 | C | 5 | 100% |  0.642 | 10.2/16.0 | 27.5 | 4.4 | 0.0 | 0.0 | 4.2 | 0% |
| trip | 1 | 8 | D | 5 | 100% |  0.975 | 15.6/16.0 | 60.4 | 7.2 | 4.8 | 2.8 | 6.2 | 80% |
| trip | 2 | 0 | A | 5 | 80% |  0.847 | 13.3/16.0 | 58.0 | 12.6 | 0.0 | 0.0 | 11.6 | 0% |
| trip | 2 | 0 | B | 5 | 100% |  0.835 | 12.8/16.0 | 57.7 | 10.0 | 4.6 | 2.8 | 11.6 | 80% |
| trip | 2 | 0 | C | 5 | 100% |  0.868 | 13.8/16.0 | 42.6 | 8.0 | 0.0 | 0.0 | 6.0 | 0% |
| trip | 2 | 0 | D | 5 | 100% |  0.906 | 14.4/16.0 | 46.1 | 3.8 | 5.4 | 3.2 | 6.6 | 100% |
| trip | 2 | 4 | A | 5 | 100% |  0.708 | 11.2/16.0 | 59.1 | 10.4 | 0.0 | 0.0 | 8.6 | 0% |
| trip | 2 | 4 | B | 5 | 100% |  0.779 | 12.2/16.0 | 62.7 | 9.2 | 4.0 | 3.4 | 9.4 | 100% |
| trip | 2 | 4 | C | 5 | 100% |  0.924 | 14.6/16.0 | 39.6 | 5.4 | 0.0 | 0.0 | 5.8 | 0% |
| trip | 2 | 4 | D | 5 | 100% |  0.887 | 14.0/16.0 | 47.6 | 4.2 | 4.6 | 5.4 | 5.8 | 100% |
| trip | 2 | 8 | A | 5 | 100% |  0.765 | 12.0/16.0 | 77.6 | 15.6 | 0.0 | 0.0 | 12.8 | 0% |
| trip | 2 | 8 | B | 5 | 100% |  0.917 | 14.4/16.0 | 68.0 | 11.8 | 2.6 | 3.2 | 10.8 | 100% |
| trip | 2 | 8 | C | 5 | 100% |  0.717 | 11.2/16.0 | 33.8 | 6.6 | 0.0 | 0.0 | 6.2 | 0% |
| trip | 2 | 8 | D | 5 | 100% |  0.884 | 13.8/16.0 | 42.5 | 5.2 | 3.2 | 2.2 | 5.6 | 100% |
| trip | 3 | 0 | A | 5 | 100% |  0.742 | 11.6/16.0 | 70.5 | 20.4 | 0.0 | 0.0 | 17.0 | 0% |
| trip | 3 | 0 | B | 5 | 100% |  0.890 | 14.0/16.0 | 67.3 | 14.4 | 8.2 | 5.0 | 17.2 | 100% |
| trip | 3 | 0 | C | 5 | 80% |  0.763 | 12.0/16.0 | 73.3 | 17.0 | 0.0 | 0.0 | 10.2 | 0% |
| trip | 3 | 0 | D | 5 | 100% |  0.809 | 12.6/16.0 | 57.4 | 10.6 | 6.6 | 7.2 | 10.2 | 100% |
| trip | 3 | 4 | A | 5 | 80% |  0.606 | 9.5/16.0 | 72.9 | 23.8 | 0.0 | 0.0 | 19.0 | 0% |
| trip | 3 | 4 | B | 5 | 100% |  0.981 | 15.4/16.0 | 84.7 | 14.4 | 12.4 | 5.6 | 20.0 | 100% |
| trip | 3 | 4 | C | 5 | 100% |  0.713 | 11.0/16.0 | 57.2 | 15.6 | 0.0 | 0.0 | 9.0 | 0% |
| trip | 3 | 4 | D | 5 | 80% |  0.935 | 14.5/16.0 | 62.8 | 8.6 | 8.2 | 6.4 | 9.2 | 100% |
| trip | 3 | 8 | A | 5 | 100% |  0.892 | 14.0/16.0 | 85.1 | 23.0 | 0.0 | 0.0 | 19.8 | 0% |
| trip | 3 | 8 | B | 5 | 100% |  0.865 | 13.6/16.0 | 82.2 | 17.0 | 7.2 | 6.6 | 17.2 | 100% |
| trip | 3 | 8 | C | 5 | 100% |  0.690 | 10.8/16.0 | 61.8 | 14.0 | 0.0 | 0.0 | 9.2 | 0% |
| trip | 3 | 8 | D | 5 | 100% |  0.874 | 13.4/16.0 | 62.9 | 9.0 | 6.2 | 5.6 | 8.6 | 100% |

## Contrasts per (d, i) — requirement F1, paired by block

D−A is the canonical private-minus-public difference (bounded+store minus open+sandbox), the
number the old study reported. S = ½[(B−A)+(D−C)] is the store effect, F = ½[(A−C)+(B−D)] the
formation effect. If B−A and D−C disagree, S averages over a real interaction; read the
interaction line, not just S. A block is one (base, seed) with all four arms delivered.

### d=1 i=0
```
                sandbox     store
  open         0.867      0.859     A,B
  bounded      0.859      0.858     C,D
```
  D-A                    = -0.010   95% CI [-0.102,  0.090]   spans 0   n=15
  S                      = -0.005   95% CI [-0.077,  0.079]   spans 0   n=15
  F                      =  0.005   95% CI [-0.039,  0.046]   spans 0   n=15
  B-A                    = -0.008   95% CI [-0.094,  0.075]   spans 0   n=15
  D-C                    = -0.001   95% CI [-0.096,  0.100]   spans 0   n=15
  (B-A)-(D-C)            = -0.007   95% CI [-0.105,  0.089]   spans 0   n=15
  blocks by base: conf=5 lab=5 trip=5

### d=2 i=0
```
                sandbox     store
  open         0.805      0.821     A,B
  bounded      0.833      0.876     C,D
```
  D-A                    =  0.071   95% CI [ 0.005,  0.137]   excludes 0   n=12
  S                      =  0.029   95% CI [-0.036,  0.102]   spans 0   n=12
  F                      = -0.042   95% CI [-0.103,  0.019]   spans 0   n=12
  B-A                    =  0.016   95% CI [-0.045,  0.079]   spans 0   n=12
  D-C                    =  0.042   95% CI [-0.060,  0.150]   spans 0   n=12
  (B-A)-(D-C)            = -0.026   95% CI [-0.128,  0.079]   spans 0   n=12
  blocks by base: conf=5 lab=3 trip=4

### d=3 i=0
```
                sandbox     store
  open         0.736      0.867     A,B
  bounded      0.767      0.847     C,D
```
  D-A                    =  0.111   95% CI [-0.064,  0.273]   spans 0   n=13
  S                      =  0.106   95% CI [ 0.005,  0.204]   excludes 0   n=13
  F                      = -0.005   95% CI [-0.082,  0.076]   spans 0   n=13
  B-A                    =  0.131   95% CI [ 0.024,  0.244]   excludes 0   n=13
  D-C                    =  0.080   95% CI [-0.084,  0.220]   spans 0   n=13
  (B-A)-(D-C)            =  0.051   95% CI [-0.130,  0.245]   spans 0   n=13
  blocks by base: conf=5 lab=4 trip=4

### d=1 i=4
```
                sandbox     store
  open         0.905      0.935     A,B
  bounded      0.814      0.897     C,D
```
  D-A                    = -0.008   95% CI [-0.064,  0.036]   spans 0   n=14
  S                      =  0.056   95% CI [ 0.006,  0.106]   excludes 0   n=14
  F                      =  0.065   95% CI [ 0.019,  0.109]   excludes 0   n=14
  B-A                    =  0.030   95% CI [-0.006,  0.062]   spans 0   n=14
  D-C                    =  0.083   95% CI [ 0.006,  0.171]   excludes 0   n=14
  (B-A)-(D-C)            = -0.054   95% CI [-0.134,  0.018]   spans 0   n=14
  blocks by base: conf=5 lab=5 trip=4

### d=2 i=4 (original)
```
                sandbox     store
  open         0.774      0.833     A,B
  bounded      0.870      0.890     C,D
```
  D-A                    =  0.116   95% CI [ 0.051,  0.180]   excludes 0   n=15
  S                      =  0.040   95% CI [-0.045,  0.111]   spans 0   n=15
  F                      = -0.077   95% CI [-0.140, -0.023]   excludes 0   n=15
  B-A                    =  0.059   95% CI [-0.055,  0.160]   spans 0   n=15
  D-C                    =  0.020   95% CI [-0.047,  0.081]   spans 0   n=15
  (B-A)-(D-C)            =  0.039   95% CI [-0.049,  0.128]   spans 0   n=15
  blocks by base: conf=5 lab=5 trip=5

### d=3 i=4
```
                sandbox     store
  open         0.774      0.920     A,B
  bounded      0.818      0.888     C,D
```
  D-A                    =  0.114   95% CI [-0.014,  0.226]   spans 0   n=13
  S                      =  0.108   95% CI [ 0.009,  0.211]   excludes 0   n=13
  F                      = -0.006   95% CI [-0.048,  0.042]   spans 0   n=13
  B-A                    =  0.146   95% CI [ 0.038,  0.250]   excludes 0   n=13
  D-C                    =  0.071   95% CI [-0.063,  0.199]   spans 0   n=13
  (B-A)-(D-C)            =  0.075   95% CI [-0.042,  0.193]   spans 0   n=13
  blocks by base: conf=5 lab=4 trip=4

### d=1 i=8
```
                sandbox     store
  open         0.879      0.896     A,B
  bounded      0.792      0.915     C,D
```
  D-A                    =  0.036   95% CI [-0.023,  0.116]   spans 0   n=15
  S                      =  0.070   95% CI [-0.011,  0.166]   spans 0   n=15
  F                      =  0.034   95% CI [-0.027,  0.109]   spans 0   n=15
  B-A                    =  0.017   95% CI [-0.063,  0.104]   spans 0   n=15
  D-C                    =  0.123   95% CI [ 0.018,  0.265]   excludes 0   n=15
  (B-A)-(D-C)            = -0.106   95% CI [-0.243, -0.006]   excludes 0   n=15
  blocks by base: conf=5 lab=5 trip=5

### d=2 i=8
```
                sandbox     store
  open         0.806      0.890     A,B
  bounded      0.781      0.839     C,D
```
  D-A                    =  0.033   95% CI [-0.071,  0.143]   spans 0   n=14
  S                      =  0.071   95% CI [ 0.008,  0.140]   excludes 0   n=14
  F                      =  0.038   95% CI [-0.033,  0.112]   spans 0   n=14
  B-A                    =  0.084   95% CI [ 0.017,  0.161]   excludes 0   n=14
  D-C                    =  0.058   95% CI [-0.035,  0.146]   spans 0   n=14
  (B-A)-(D-C)            =  0.026   95% CI [-0.070,  0.123]   spans 0   n=14
  blocks by base: conf=5 lab=4 trip=5

### d=3 i=8 (hardest)
```
                sandbox     store
  open         0.845      0.876     A,B
  bounded      0.742      0.880     C,D
```
  D-A                    =  0.035   95% CI [-0.043,  0.102]   spans 0   n=14
  S                      =  0.085   95% CI [ 0.020,  0.151]   excludes 0   n=14
  F                      =  0.049   95% CI [-0.013,  0.115]   spans 0   n=14
  B-A                    =  0.031   95% CI [-0.054,  0.106]   spans 0   n=14
  D-C                    =  0.139   95% CI [ 0.061,  0.228]   excludes 0   n=14
  (B-A)-(D-C)            = -0.108   95% CI [-0.211, -0.010]   excludes 0   n=14
  blocks by base: conf=5 lab=4 trip=5

## Primary slopes

Δ(D−A) = D−A at (d=3, i=8) minus D−A at (d=2, i=4): the hardest cell minus the original
allocation, computed per block (a block must have all four arms delivered in both cells) and then
averaged. ΔS is the same for the store effect. A positive slope says the contrast grew as the facts
were dispersed and the distractors doubled; it says nothing about the sign of the contrast itself,
so both ends are printed on the same blocks.

### D-A
  ΔD-A                   = -0.075   95% CI [-0.161,  0.015]   spans 0   n=14   [blocks complete in both cells]
  D-A (3,8) | slope blocks =  0.035   95% CI [-0.043,  0.102]   spans 0   n=14   [same blocks as the slope]
  D-A (2,4) | slope blocks =  0.110   95% CI [ 0.039,  0.179]   excludes 0   n=14   [same blocks as the slope]
  D-A (3,8) all          =  0.035   95% CI [-0.043,  0.102]   spans 0   n=14   [blocks complete at (3,8)]
  D-A (2,4) all          =  0.116   95% CI [ 0.051,  0.180]   excludes 0   n=15   [blocks complete at (2,4)]

### S
  ΔS                     =  0.049   95% CI [-0.039,  0.140]   spans 0   n=14   [blocks complete in both cells]
  S (3,8) | slope blocks =  0.085   95% CI [ 0.020,  0.151]   excludes 0   n=14   [same blocks as the slope]
  S (2,4) | slope blocks =  0.035   95% CI [-0.054,  0.112]   spans 0   n=14   [same blocks as the slope]
  S (3,8) all            =  0.085   95% CI [ 0.020,  0.151]   excludes 0   n=14   [blocks complete at (3,8)]
  S (2,4) all            =  0.040   95% CI [-0.045,  0.111]   spans 0   n=15   [blocks complete at (2,4)]

### One knob at a time

D−A and S along dispersion at i=4 and along interference at d=2. Each point is the
contrast over every block complete in that cell (n in parentheses); end − start is the last point
minus the first, per block over the blocks complete at both ends, with its interval.

| contrast | axis | point 1 | point 2 | point 3 | end − start | 95% CI | n |
|---|---|---|---|---|---|---|---|
| D-A | d at i=4 | d=1: -0.008 (14) | d=2:  0.116 (15) | d=3:  0.114 (13) |  0.101 | [-0.028,  0.214] | 12 |
| D-A | i at d=2 | i=0:  0.071 (12) | i=4:  0.116 (15) | i=8:  0.033 (14) | -0.022 | [-0.176,  0.135] | 11 |
| S | d at i=4 | d=1:  0.056 (14) | d=2:  0.040 (15) | d=3:  0.108 (13) |  0.026 | [-0.070,  0.128] | 12 |
| S | i at d=2 | i=0:  0.029 (12) | i=4:  0.040 (15) | i=8:  0.071 (14) |  0.058 | [-0.067,  0.188] | 11 |

## Tokens (T1, k) and the token cost of store

Whole-system tokens for the beat, all roles summed, over the same delivered blocks as the F1
contrasts (a beat whose stats were lost in a crash is missing, not 0). The per-role table below
says where a difference sits: listing and reading a holder's store against asking it.

| d | i | A | B | C | D | B−A | 95% CI | D−C | 95% CI | n |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 65.9 | 48.9 | 43.3 | 37.7 | -17.0 | [-28.6, -4.7] | -5.6 | [-13.3, 4.1] | 15 |
| 2 | 0 | 87.4 | 61.8 | 50.0 | 46.3 | -25.6 | [-51.8, -0.7] | -3.7 | [-15.5, 6.9] | 12 |
| 3 | 0 | 108.6 | 72.8 | 77.7 | 52.6 | -35.8 | [-58.7, -15.6] | -25.0 | [-41.7, -9.2] | 13 |
| 1 | 4 | 64.2 | 66.8 | 45.1 | 47.8 | 2.6 | [-9.3, 13.8] | 2.7 | [-6.8, 12.3] | 14 |
| 2 | 4 | 84.0 | 74.3 | 50.7 | 56.0 | -9.7 | [-27.4, 6.8] | 5.3 | [-6.4, 17.2] | 15 |
| 3 | 4 | 88.6 | 86.3 | 73.2 | 68.4 | -2.3 | [-15.6, 9.6] | -4.9 | [-15.6, 5.6] | 13 |
| 1 | 8 | 68.6 | 62.1 | 42.7 | 56.5 | -6.5 | [-18.7, 6.5] | 13.8 | [3.0, 24.2] | 15 |
| 2 | 8 | 79.0 | 82.6 | 52.8 | 50.8 | 3.5 | [-9.6, 14.7] | -1.9 | [-18.4, 15.0] | 14 |
| 3 | 8 | 99.2 | 95.6 | 77.9 | 85.8 | -3.6 | [-15.8, 7.9] | 7.9 | [-2.7, 17.9] | 14 |

### Tokens by role (T1, k)

Summed from the llm events of the beat by tag: req.* = requester, ask.* = responder, build.* =
builder, consult.* = builder consults (shown when non-zero). Same per-block contrasts as above.

| d | i | role | A | B | C | D | B−A | 95% CI | D−C | 95% CI | n |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | requester | 56.5 | 43.3 | 34.7 | 32.4 | -13.2 | [-24.2, -1.7] | -2.3 | [-9.0, 6.5] | 15 |
| 1 | 0 | responder | 5.0 | 1.4 | 4.1 | 1.0 | -3.6 | [-4.4, -2.6] | -3.2 | [-4.2, -2.1] | 15 |
| 1 | 0 | builder | 3.6 | 3.5 | 3.7 | 3.6 | -0.1 | [-1.0, 0.9] | -0.1 | [-1.0, 0.7] | 15 |
| 1 | 0 | consult | 0.9 | 0.8 | 0.8 | 0.8 | -0.1 | [-0.3, 0.0] | 0.0 | [-0.0, 0.1] | 15 |
| 2 | 0 | requester | 75.3 | 55.2 | 42.1 | 41.2 | -20.1 | [-44.5, 3.5] | -0.8 | [-11.2, 8.7] | 12 |
| 2 | 0 | responder | 6.8 | 2.0 | 4.0 | 1.2 | -4.7 | [-6.4, -3.2] | -2.8 | [-4.3, -1.5] | 12 |
| 2 | 0 | builder | 4.6 | 3.6 | 3.2 | 3.0 | -1.0 | [-2.5, 0.3] | -0.2 | [-1.4, 1.0] | 12 |
| 2 | 0 | consult | 0.8 | 1.0 | 0.7 | 0.8 | 0.2 | [-0.1, 0.6] | 0.1 | [-0.0, 0.3] | 12 |
| 3 | 0 | requester | 94.8 | 66.1 | 64.3 | 46.7 | -28.7 | [-50.7, -9.1] | -17.7 | [-31.7, -4.4] | 13 |
| 3 | 0 | responder | 9.0 | 2.3 | 6.4 | 1.6 | -6.7 | [-8.2, -5.1] | -4.8 | [-6.2, -3.4] | 13 |
| 3 | 0 | builder | 4.1 | 3.7 | 5.6 | 3.6 | -0.4 | [-1.8, 1.0] | -1.9 | [-3.8, 0.1] | 13 |
| 3 | 0 | consult | 0.8 | 0.7 | 1.3 | 0.7 | -0.1 | [-0.2, 0.0] | -0.6 | [-1.4, -0.0] | 13 |
| 1 | 4 | requester | 54.7 | 59.9 | 35.5 | 41.6 | 5.2 | [-5.8, 15.2] | 6.1 | [-2.4, 14.8] | 14 |
| 1 | 4 | responder | 5.8 | 2.0 | 4.5 | 1.4 | -3.8 | [-5.1, -2.6] | -3.1 | [-4.0, -2.2] | 14 |
| 1 | 4 | builder | 3.1 | 3.7 | 4.3 | 3.8 | 0.7 | [-0.4, 1.7] | -0.5 | [-2.1, 1.4] | 14 |
| 1 | 4 | consult | 0.7 | 1.2 | 0.8 | 1.0 | 0.5 | [-0.0, 1.6] | 0.2 | [-0.0, 0.8] | 14 |
| 2 | 4 | requester | 72.7 | 67.9 | 41.2 | 50.4 | -4.7 | [-21.4, 11.0] | 9.1 | [-1.7, 20.2] | 15 |
| 2 | 4 | responder | 5.8 | 2.0 | 3.9 | 1.6 | -3.8 | [-5.2, -2.5] | -2.4 | [-3.6, -1.4] | 15 |
| 2 | 4 | builder | 4.0 | 3.6 | 3.9 | 3.3 | -0.4 | [-1.4, 0.7] | -0.6 | [-1.8, 0.4] | 15 |
| 2 | 4 | consult | 1.5 | 0.7 | 1.6 | 0.8 | -0.7 | [-2.1, 0.0] | -0.8 | [-2.2, 0.0] | 15 |
| 3 | 4 | requester | 76.4 | 79.8 | 62.2 | 62.4 | 3.4 | [-9.2, 14.6] | 0.2 | [-9.6, 9.6] | 13 |
| 3 | 4 | responder | 8.5 | 2.8 | 7.4 | 2.1 | -5.7 | [-7.2, -4.4] | -5.3 | [-6.5, -4.0] | 13 |
| 3 | 4 | builder | 3.1 | 3.0 | 3.0 | 3.2 | -0.1 | [-1.2, 0.9] | 0.2 | [-0.5, 1.0] | 13 |
| 3 | 4 | consult | 0.6 | 0.7 | 0.7 | 0.7 | 0.1 | [-0.0, 0.3] | 0.0 | [-0.1, 0.2] | 13 |
| 1 | 8 | requester | 58.4 | 56.1 | 34.9 | 50.6 | -2.2 | [-13.3, 9.6] | 15.7 | [5.6, 25.3] | 15 |
| 1 | 8 | responder | 5.9 | 2.0 | 4.4 | 2.0 | -3.9 | [-5.4, -2.5] | -2.4 | [-3.7, -1.1] | 15 |
| 1 | 8 | builder | 3.6 | 3.1 | 2.7 | 3.1 | -0.4 | [-1.0, 0.1] | 0.3 | [-0.2, 0.9] | 15 |
| 1 | 8 | consult | 0.7 | 0.8 | 0.7 | 0.8 | 0.0 | [-0.0, 0.1] | 0.1 | [0.0, 0.2] | 15 |
| 2 | 8 | requester | 67.3 | 75.0 | 43.6 | 45.1 | 7.7 | [-3.1, 17.2] | 1.4 | [-13.2, 16.8] | 14 |
| 2 | 8 | responder | 6.0 | 2.7 | 4.1 | 1.8 | -3.3 | [-4.4, -2.2] | -2.4 | [-3.5, -1.4] | 14 |
| 2 | 8 | builder | 4.8 | 4.1 | 3.9 | 3.2 | -0.6 | [-2.5, 1.2] | -0.7 | [-1.9, 0.4] | 14 |
| 2 | 8 | consult | 1.0 | 0.7 | 1.1 | 0.8 | -0.2 | [-0.4, -0.0] | -0.3 | [-0.9, 0.1] | 14 |
| 3 | 8 | requester | 85.5 | 88.2 | 66.5 | 78.4 | 2.7 | [-7.9, 12.8] | 11.9 | [2.2, 21.1] | 14 |
| 3 | 8 | responder | 8.9 | 3.9 | 6.9 | 2.9 | -5.0 | [-6.2, -3.9] | -4.0 | [-4.9, -3.1] | 14 |
| 3 | 8 | builder | 3.5 | 2.9 | 3.4 | 3.7 | -0.6 | [-1.5, 0.3] | 0.3 | [-1.1, 1.8] | 14 |
| 3 | 8 | consult | 1.3 | 0.6 | 1.0 | 0.7 | -0.7 | [-1.9, 0.0] | -0.3 | [-0.9, -0.0] | 14 |

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
| 1 | 0 | A | 15 |  0.000 |  0.000 |  0.000 | n/a |
| 1 | 0 | B | 15 |  0.000 |  0.000 |  0.000 | n/a |
| 1 | 0 | C | 15 |  0.000 |  0.000 |  0.000 | n/a |
| 1 | 0 | D | 15 |  0.000 |  0.000 |  0.000 | n/a |
| 1 | 4 | A | 15 |  4.000 |  0.000 |  0.000 |  0.000 |
| 1 | 4 | B | 14 |  4.000 |  0.000 |  0.000 |  0.000 |
| 1 | 4 | C | 15 |  4.000 |  0.067 |  0.000 |  0.017 |
| 1 | 4 | D | 15 |  4.000 |  0.000 |  0.000 |  0.000 |
| 1 | 8 | A | 15 |  8.000 |  0.200 |  0.000 |  0.025 |
| 1 | 8 | B | 15 |  8.000 |  0.200 |  0.000 |  0.025 |
| 1 | 8 | C | 15 |  8.000 |  0.067 |  0.000 |  0.008 |
| 1 | 8 | D | 15 |  8.000 |  0.067 |  0.000 |  0.008 |
| 2 | 0 | A | 12 |  0.000 |  0.000 |  0.000 | n/a |
| 2 | 0 | B | 15 |  0.000 |  0.000 |  0.000 | n/a |
| 2 | 0 | C | 15 |  0.000 |  0.000 |  0.000 | n/a |
| 2 | 0 | D | 15 |  0.000 |  0.000 |  0.000 | n/a |
| 2 | 4 | A | 15 |  3.667 |  0.267 |  0.000 |  0.073 |
| 2 | 4 | B | 15 |  3.867 |  0.000 |  0.000 |  0.000 |
| 2 | 4 | C | 15 |  3.867 |  0.200 |  0.000 |  0.052 |
| 2 | 4 | D | 15 |  3.867 |  0.000 |  0.000 |  0.000 |
| 2 | 8 | A | 15 |  7.800 |  0.200 |  0.000 |  0.026 |
| 2 | 8 | B | 15 |  7.467 |  0.533 |  0.000 |  0.071 |
| 2 | 8 | C | 14 |  7.786 |  0.214 |  0.000 |  0.028 |
| 2 | 8 | D | 15 |  7.467 |  0.400 |  0.000 |  0.054 |
| 3 | 0 | A | 15 |  0.000 |  0.000 |  0.000 | n/a |
| 3 | 0 | B | 15 |  0.000 |  0.000 |  0.000 | n/a |
| 3 | 0 | C | 13 |  0.000 |  0.000 |  0.000 | n/a |
| 3 | 0 | D | 14 |  0.000 |  0.000 |  0.000 | n/a |
| 3 | 4 | A | 13 |  3.615 |  0.231 |  0.000 |  0.064 |
| 3 | 4 | B | 15 |  3.800 |  0.067 |  0.000 |  0.018 |
| 3 | 4 | C | 15 |  3.800 |  0.000 |  0.000 |  0.000 |
| 3 | 4 | D | 14 |  3.714 |  0.000 |  0.000 |  0.000 |
| 3 | 8 | A | 14 |  7.714 |  0.214 |  0.000 |  0.028 |
| 3 | 8 | B | 15 |  7.600 |  0.067 |  0.067 |  0.009 |
| 3 | 8 | C | 15 |  7.533 |  0.467 |  0.000 |  0.062 |
| 3 | 8 | D | 15 |  7.667 |  0.267 |  0.000 |  0.035 |

## Notes

- n per cell (summarised, on protocol, pooled over bases): D1I0A=15, D1I0B=15, D1I0C=15, D1I0D=15, D1I4A=15, D1I4B=15, D1I4C=15, D1I4D=15, D1I8A=15, D1I8B=15, D1I8C=15, D1I8D=15, D2I0A=15, D2I0B=15, D2I0C=15, D2I0D=15, D2I4A=15, D2I4B=15, D2I4C=15, D2I4D=15, D2I8A=15, D2I8B=15, D2I8C=15, D2I8D=15, D3I0A=15, D3I0B=15, D3I0C=15, D3I0D=15, D3I4A=15, D3I4B=15, D3I4C=15, D3I4D=15, D3I8A=15, D3I8B=15, D3I8C=15, D3I8D=15.
- episodes per base: conference=180, lab-dashboard=180, trip-planner=180. Scenario ids are <base>-D<d>-I<i> with base in conf, lab, trip.
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
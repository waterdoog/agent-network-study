# Payables — protocol

Once every needed document is reachable (E = 0), does the value of reading
documents directly (store) relative to asking their keeper (sandbox) change
with the cross-source integration burden L, and with version conflicts M?

That is the only question this experiment answers. It keeps the 2x2 of the
main study and adds two task factors; it does not re-sweep anything else.

|            | sandbox (ask_agent only) | store (+ list_store / read_store) |
|------------|--------------------------|-----------------------------------|
| open       | A                        | B                                 |
| bounded    | C                        | D                                 |

## What is manipulated

**L — integration burden.** Each of the 6 orders needs 4 evidence groups
(invoice, contract, acceptance, payment). L is how many holders one order's
groups are spread across:

| L | holder of (order i, group j) | sources per order |
|---|------------------------------|-------------------|
| 1 | i                            | 1                 |
| 2 | (i + floor(j/2)) mod 6       | 2                 |
| 4 | (i + j) mod 6                | 4                 |

Holder labels and document order are then permuted with a seed-dependent
permutation so labels do not encode the answer. Every holder has exactly 8
documents at every L, and document bodies are identical across L; only the
holder changes.

**M — version conflicts.** Each evidence group holds one current document
(status `final`, later effective date) and one historical/background one.

- M0: the second document carries no competing value for the field.
- M1: four historical documents — on four distinct orders, one per group type,
  chosen by a seed-dependent rotation — are replaced by conflicting earlier
  records (proforma invoice with another amount, earlier quotation with another
  discount, unsigned draft acceptance contradicting the official record,
  earlier remittance advice with another paid amount). Each, if adopted, changes
  balance, status or payable. They are marked `superseded`/`draft` with earlier
  dates and are never labelled as wrong.

Scenario ids: `pay-L1-M0 pay-L2-M0 pay-L4-M0 pay-L1-M1 pay-L2-M1 pay-L4-M1`.
All are 9 characters, so the directory RNG stream is identical across L and M
for a given seed, and `buildDirectory` feeds that stream the holders and the
tag vocabulary in sorted order rather than in the order the documents happen
to mention them (which would follow L). The directory is therefore identical
across all six cells of a seed: the same 100 cards in the same order with the
same names and kinds, the same near-miss and noise filler, and the same
search results for any order id. The one thing that moves is each desk card's
own order tags, which say which orders that desk keeps and so follow L by
definition. `verify-payables.mjs` asserts all of this. The scenario objects
carry `generated: true`, and `run.js` leaves generated scenarios out of its
default `--scenarios` list, so the payables cells run only when named.

## What is held fixed

- The order world depends only on the seed: 6 orders `PO-nnn`, invoice amount
  a multiple of 100 in 1000..10000, discount in {0,5,10,15,20}, exactly 4
  accepted / 2 not, paid strictly below net. Same world in all 24 cells of a
  seed, so every contrast is paired.
- E = 0, directory 100 / roster 20, search cap 40, seed profile `control`,
  reputation off, edge cost 0, relay 0, k = 1, same model and kernel in every
  arm.
- Holders are generic records keepers of equal ability
  (`Purchasing Records Desk n`), never experts.
- Harness symmetry: builds return the same receipt in every arm, submit takes
  the final component from the store in every arm, so requester context cost
  does not differ by construction. Responders in documents mode answer from
  their folder, cite ids and effective dates, and are not subject to the
  "never volunteer" sandbox rule.
- Scoring is deterministic and typed: 42 `attr` assertions on
  `#orders tr.order[data-order=...]` (invoice, discount, accepted, paid,
  balance, status, payable per order) plus a row count. No substring (`text`)
  assertions.

## Document format

Each holder's folder is a list of 8 documents. A document is a header line then
2-4 plain sentences (about 60-120 words):

```
DOCUMENT <doc_id> | type=<invoice|contract|acceptance|payment> | order=<PO-nnn> | contract=<C-nnn> | issued=<YYYY-MM-DD> | effective=<YYYY-MM-DD> | version=<n> | supersedes=<doc_id|none> | status=<final|superseded|draft|background>
<body>
```

`version` is always `1` and `supersedes` always `none`, by design. Recency is
carried by `status` (`final` against `superseded`/`draft`/`background`) and by
the effective date, which is always later on the current record. A version
counter that moved with M would change the 44 documents the two conflict
conditions share, and the M contrast depends on those 44 being byte-identical;
the verifier checks both the constant fields and the shared documents. Every
header line is shorter than 200 characters, the `list_store` preview cap, so
a folder listing always shows the status.

The requester's turn budget in documents mode is `STUDY_MAX_ITERS_DOCS`
(default 30) rather than `STUDY_MAX_ITERS`, because reading 48 documents one
folder at a time needs more turns than asking for a handful of facts. The
system prompt states the budget and the turn at which the requester is told to
stop gathering and build, so the cut-off is a rule the model can plan around
rather than a surprise. The builder's consult round (one extra question to a
specialist when a builder is short a number) is disabled in documents mode:
the responders are records desks with no expertise beyond their folder, and a
consult would let the builder fetch a document the requester never retrieved,
which is the very cost the arms are meant to differ on.

The brief states the rules verbatim: use the formal record that is current and
effective for the order; unapproved drafts and earlier quotations do not
override formal documents; balance = invoice × (1 − discount) − paid; status is
PAY only if acceptance passed, otherwise HOLD; payable = balance if PAY else 0;
balance is computed even for HOLD orders; cite the document ids relied on.

## Primary contrast

With A..D the per-cell mean of Q at one (L, M):

- S(L, M) = ½[(B − A) + (D − C)] — store effect
- F(L, M) = ½[(A − C) + (B − D)] — formation effect
- interaction = (B − A) − (D − C); when B − A and D − C disagree, S is an
  average over a real interaction and is reported alongside both simple effects

**K = S(L=4) − S(L=1) at M0** is the pre-registered primary contrast, with
S(L=4) at M0 as its companion: K > 0 alone can mean store went from worse to
less bad, and only S(L=4) > 0 is a quality gain at high burden. Both are
reported; neither is selected. The conflict condition (M1), the M1 − M0
difference in S, D − C inside bounded, and tokens are secondary.

Q is the share of the 6 orders whose balance, status and payable are all
correct. Field accuracy (24 invoice/discount/accepted/paid attributes) is
reported to separate fact acquisition from the final computation.

Every contrast is computed per seed, then averaged; intervals are percentile
bootstraps that resample seeds and keep the four arms of a seed together.
They are descriptive. The confirmatory test in the design is a paired t-test
on the per-seed K_i and S_i(L=4) with Holm correction; `payables.js` does not
run it.

## Running

Node 22, from the repository root; nothing loads `.env` automatically.

Offline acceptance before any model call (every cell can reach all 24 current
groups, folder loads are 8/holder at every L, the reference answer scores
full marks, a wrong discount is penalised, HOLD orders still need a balance,
old versions cannot pass as current):

```
node scripts/verify-payables.mjs
```

Engineering pilot (5 seeds, L = 1 and 4, no conflicts, T1 only). It checks
permissions, answer length, difficulty spread and the paired variance; it is
not part of the confirmatory result:

```
node --env-file=.env src/run.js --run pay-pilot --scenarios pay-L1-M0,pay-L4-M0 --arms A,B,C,D --E 0 --seeds 5 --beats 1 --par 8
node src/payables.js pay-pilot
```

Main sweep, no conflicts (30 seeds × 3 L × 4 arms = 360 T1 episodes). Add the
`-M1` scenarios for the conflict condition (720 episodes):

```
node --env-file=.env src/run.js --run pay-main --scenarios pay-L1-M0,pay-L2-M0,pay-L4-M0 --arms A,B,C,D --E 0 --seed-start 6 --seeds 30 --beats 1 --par 8
node src/payables.js pay-main
```

`--seed-start 6` matters: the pilot used seeds 1..5, and every world, document
set and directory is a function of the seed, so the confirmatory sweep would
otherwise re-run five worlds the pilot already looked at while choosing the
design. Seeds 6..35 are fresh. `seedStart` is recorded in the episode meta.

`--beats 1` runs only the cold T1 beat; `beats` is recorded in the episode
meta. The queue of planned episodes is shuffled before the workers start, with
`--order-seed` (recorded as `orderSeed` in the meta) fixing the shuffle, so a
rate limit or an outage part-way through a sweep does not land on one cell;
`run.js` writes `runs/<run>/manifest.json` listing every planned episode id
with its cell fields before any worker starts, so what was attempted is on
disk independently of what finished. `run.js` resumes from `summary.json` on
disk, so an interrupted sweep is re-run with the same command. Do not re-run
only the low-scoring episodes.

## Reading payables.md

`node src/payables.js <run>` reads `runs/<run>/*/summary.json` (never
`all.json`) and writes `runs/<run>/payables.md`. Sections, in order:

1. **Delivery** per (arm, L, M). Read this first. `UNSAFE` or `CAUTION` means
   the cells being compared are not the same population; re-run the affected
   cells before reading anything below. Lost beats are excluded from the
   delivered-only quality means and paired contrasts, but kept in the token
   columns. Because excluding them can flatter an arm that fails more often,
   the section also reports Q with every non-submission counted as zero (the
   full denominator), and breaks the lost beats down by `failureKind`:
   `model` (the requester ended without a submission, or the artifact did not
   parse) against `technical` (a model-call failure, a crash, or the scorer
   child throwing or timing out). A gap between the two denominators that
   differs by arm is itself a finding; `technical` losses are the ones to
   re-run.
2. **Per-cell means** — n, delivered, Q, field accuracy, F1, tokens (k),
   asks, lists, reads, contacted, store use (share of episodes with ≥ 1
   `read_store`). Store use near zero in B/D means the affordance was not
   used, which changes what S means.
3. **Contrasts per (L, M)** — the 2x2 of Q and S, F, B − A, D − C, interaction
   with 95% CIs and the number of complete seed blocks n. `incomplete` means
   no seed had all four arms delivered in that cell. The section ends with an
   **S on secondary metrics** table: S per (L, M) on field accuracy and on
   requirement F1, so a store effect on Q can be checked against the same
   effect on the fields it is computed from.
4. **Primary contrast** — K, S(L=4), S(L=1) at M0 (pre-registered) and at M1;
   then S(M1) − S(M0) per L and K(M1) − K(M0).
5. **Tokens** — per-cell means and the store cost B − A and D − C with CIs.
6. **Notes** — n per cell, definitions, and a warning if any episode lacked
   `failedAll` (the beat's `failures` list is capped at 12 ids and would
   overstate Q for weak episodes).

A wide interval is "not determined", not "equivalent". Equivalence claims
need the whole interval inside a pre-set band (the design proposes ±0.05).

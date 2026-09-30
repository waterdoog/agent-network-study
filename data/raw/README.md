# Raw experimental records

This snapshot contains every file from the four completed runs supporting
[PR #2](https://github.com/waterdoog/agent-network-study/pull/2), including the two
Payables pilots from the earlier experiment, plus the preserved technical failure.
The payload is **3,341 files / 31,997,465 bytes**, archived per run to keep the PR
file list readable. These are the original file bytes, not reconstructed results.
`manifest.json` lists exact sizes, model IDs, counts, and archive SHA-256 hashes.

| Archive | Completed episodes | T1 HTML artifacts | Contents |
|---|---:|---:|---|
| `knobs-main.tar.gz` | 540 | 528 | 27 scenarios x A-D x seeds 4-8, E=0, T1 |
| `knobs-pilot.tar.gz` | 48 | 48 | Conference, d in {1,3}, i in {0,8}, seeds 1-3 |
| `pay-pilot.tar.gz` | 40 | 40 | Payables L in {1,4}, M=0, seeds 1-5 |
| `pay-pilot-m1.tar.gz` | 40 | 40 | Payables L in {1,4}, M=1, seeds 1-5 |
| `knobs-main-technical-fail-B_lab-D2-I8_s6.tar.gz` | Superseded attempt | 0 | Original technical failure; excluded from the 540-episode analysis |

The 12 main-sweep episodes without a submitted artifact remain in the data with
their original summaries and transcripts. Their absence is a model outcome, not
a missing upload. The failed B / lab-D2-I8 / seed 6 attempt is kept at
`runs/knobs-main-technical-fail-B_lab-D2-I8_s6/`; its protocol-approved rerun is
already inside `runs/knobs-main/`. Do not mix that superseded attempt into the
main analysis or count it as an additional planned episode.

## What is preserved

Each archive restores the original `runs/<run>/...` paths and, where present,
the corresponding `runs/<run>.log` console output:

- Per-episode `summary.json`, `events.jsonl`, and `T1.transcript.jsonl`.
- Submitted `T1.html` and `T1.assertions.json` wherever an artifact was produced.
- Run-level `manifest.json`, `usage.json`, `all.json`, error logs, and saved
  analysis reports, wherever present.

The episode manifests describe the planned queue. The analysis scripts read
individual `summary.json` files, not `all.json`; the latter can reflect only the
last resumed invocation and is retained as a historical artifact.

The source revision before this data-only addition is
`72c3e6d6fd97fc8753ae936fbfe89ff53a27002b`. The archives cover the new Knobs and
Payables experiments; they do not contain the earlier baseline experiments from
Yu's study. API credentials and dependencies are not part of these archives.
The working `runs/` directory remains ignored so future runs are not committed
automatically.

## Restore and verify

Use the checkout containing PR #2 (or its merged revision), and run these commands
from the repository root in Linux/WSL. Start with an empty `runs/` directory or a
fresh checkout. `--keep-old-files` refuses to overwrite an existing file.

```bash
sha256sum -c data/raw/SHA256SUMS
for archive in data/raw/*.tar.gz; do
  tar --keep-old-files -xzf "$archive"
done
sha256sum --quiet -c data/raw/FILES.sha256
```

`SHA256SUMS` verifies the five compressed archives. `FILES.sha256` verifies all
3,341 restored file contents before analysis. Tar ownership, modes and timestamps
are normalized; the file contents are unchanged. Gzip timestamps are fixed at
zero so the packages have no machine-specific creation metadata.

## Recompute the reported results

With the repository's Node.js dependencies installed (`npm ci`, Node >=20.11),
these commands analyze the recorded episodes without making model API calls:

```bash
node src/knobs.js knobs-main
node src/knobs.js knobs-pilot
node src/payables.js pay-pilot
node src/payables.js pay-pilot-m1

cmp runs/knobs-main/knobs.md docs/knobs-main-results.md
cmp runs/knobs-pilot/knobs.md docs/knobs-pilot-results.md
```

Reports are written under each restored run directory. All four analyses were
run from an isolated checkout using only the unpacked data; every regenerated
report matched its archived original byte for byte, and both Knobs reports also
matched the committed `docs/` reports. JSON/JSONL syntax and manifest-to-summary
coverage were checked. This checks packaging and reproducibility, not the
scientific interpretation of the experiments.

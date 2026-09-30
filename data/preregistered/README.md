# Pre-registered experiment records (Studies 5–7)

The raw records of the three pre-registered studies of the AAMAS 2027
manuscript, run on 30 September 2026 on the shared experiment VM. The
pre-registrations are committed in the manuscript's repository
(`docs/PREREGISTRATION-formation-and-reach.md`, Studies 5 and 6;
`docs/PREREGISTRATION-access-decomposed.md`, Study 7) before any of these
episodes ran.

| Archive | Episodes | What it is | Harness |
|---|---:|---|---|
| `az-narrow.tar.gz` | 180 | Study 5: A, B, C, D, Cr, Dr at E = 0, conditions (2,4) and (3,8), 3 templates, seeds 4–8 | `d090a5c` |
| `az-reach.tar.gz` | 120 | Study 6: A–D at E = 0.3 and 0.7, condition (2,4); its E = 0 cells are Study 5's | `d090a5c` |
| `az-access.tar.gz` | 60 | Study 7: Ab, Cb at E = 0, conditions (2,4) and (3,8); pairs with Study 5's A–D | `3408758` |
| `set-aside.tar.gz` | – | smoke tests, episodes cut off when a session restarted (rerun from scratch), and technical failures rerun once under the pre-registered rule; not analysed | both |

Every model call went through the SysteMind gateway pinned to
`azure:DeepSeek-V4-Flash` with no failover; each call's serving deployment and
charged cost are logged in the episode's `events.jsonl` (`evt: "llm"`,
`served`, `cost_microusd`). `manifest.json` counts the calls per deployment:
all 12,091 analysed calls (and the 544 set-aside ones) were served by
`azure:DeepSeek-V4-Flash`. The run scripts are in `scripts/preregistered/`;
they read the gateway key from `~/.study.env`, which is not in the repository.
No archive contains API credentials.

As in `data/raw/` and `data/baseline/`, these are the original file bytes;
tar ownership, modes and timestamps are normalized and gzip timestamps are
zero.

## Restore and verify

```bash
sha256sum -c data/preregistered/SHA256SUMS            # macOS: shasum -a 256 -c
for archive in data/preregistered/*.tar.gz; do
  tar --keep-old-files -xzf "$archive"
done
sha256sum --quiet -c data/preregistered/FILES.sha256  # macOS: shasum -a 256 -c --quiet
```

## Reproducing the manuscript's numbers

Point the manuscript's `analysis/aamas-2027/analyze.py` at the restored
`runs/` with `EXP_RUNS=<repo>/runs`, together with `STUDY2_RUNS` for the
`data/raw/` archives. Studies 5–7 are analysed only when all 180, 120 and 60
planned summaries are present.

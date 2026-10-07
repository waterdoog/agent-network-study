# Second-model replication: GPT-6 Astra

Raw records for the 270-episode second-model design. All 270 planned summaries
were complete on **7 October 2026 at 13:54:56 UTC+8**. No statistical contrasts
or quality analysis were performed during collection or packaging.

| Run | Completed/planned | Technical episode reruns | Remaining technical failures | Successful calls in final episodes |
|---|---:|---:|---:|---:|
| `m2-e0` | 180/180 | 5 | 0 | 2,580 |
| `m2-dir` | 30/30 | 0 | 0 | 403 |
| `m2-e7` | 60/60 | 0 | 0 | 1,121 |

A missing page is a model outcome and was retained, not rerun. The five
`m2-e0` technical failures were preserved and rerun once at parallelism 3;
all other initial episodes ran at parallelism 10. The five superseded
attempts are in `runs/m2-e0-technical-fail/` inside `set-aside.tar.gz`.
The ordinary transient-call retry policy is separate from episode reruns:
the ledgers contain 8 call errors in `m2-e0`, 1 in `m2-dir`, and none in
`m2-e7`. Do not count an automatically retried call as an episode rerun.

The separate smoke used A / conf-D2-I4 / seeds 1 and 2. Both final summaries
passed the technical/serving gate. One original smoke episode hit a revoked
OAuth login and was rerun once after normal Codex login refresh; its original
attempt is in `runs/m2-smoke-technical-fail/`. Smoke, preflight and superseded
attempts are not part of the 270 confirmatory episodes.

## Registration and harness

- [Model registration, `44a2421`](https://github.com/LeoYiLi/agentic-web-paper/commit/44a242195f828e616a77adfacf45a4c0082ac48f): GPT-6 Astra through the owner's ChatGPT subscription, committed before any Astra experimental episode.
- [Transport amendment, `8d05ae5`](https://github.com/LeoYiLi/agentic-web-paper/commit/8d05ae53378e528ad06bf2dbb9e97ad3522f9ea4): parameter compatibility recorded before experimental smoke.
- The earlier `azure:gpt-4.1-mini` registration at `c420bf9` is retained verbatim in the paper repository as `docs/PREREGISTRATION-second-model-azure-2026-10-05.md`. Its attempt status is unknown here; this dataset does not relabel or replace those records.
- Study 7 harness `3408758`, checked out at `08e492e` (comments and earlier archives). The task generator, arms, requester/responder logic and scorer remain unchanged. The subscription transport and operational cost display are recorded in the branch. `runs/environment.json` records the exact source revision and file hashes.

The three runs use the registered scenarios/arms, seeds 4–8, one cold beat,
order seed 2, directory 100, roster 20, search cap 40, control seed profile,
reputation off, edge cost 0 and relay 0. Their run manifests preserve exact
flags and episode IDs. `scripts/second-model/README.md` documents execution.

## Serving identity and model-specific limitations

All **4,104 successful calls in the final 270 episodes** report
`served: gpt-6-astra`. Serving identity comes from the upstream terminal
response's `model` field, not just the request. Each event is cross-checked
against its ledger response ID. There is no alternate-model or API-key fallback.

The transport maps original system instructions, message history, function
schemas and function outputs into Responses format. It adds no coding-agent
wrapper or coding tools. The subscription rejects `temperature`, so all calls
use service-default sampling and `reasoning.effort=medium`. The original
per-call output limit is sent as `max_output_tokens`, which includes reasoning
tokens. These are declared differences from the DeepSeek transport and must
accompany any cross-model comparison.

## Cost and recorded usage

**Total monetary cost is unavailable, not zero.** The subscription returns no
per-call USD or consumed-credit charge, so ledger `cost_microusd` and manifest
`cost_usd` remain null. No API-price estimate is substituted. OAuth credentials,
API keys and account identifiers are not included in these records.

Across main attempts, technical reruns, smoke and connectivity checks, the
received terminal responses record **4,232 calls, 4,805,193 input tokens
and 1,484,951 output tokens** (6,290,144 total). Output tokens already include
reasoning tokens; do not add reasoning tokens again. Failed streams may consume
tokens without returning usage, so these counts are **recorded usage, not a
complete billing total**. The per-run ledger breakdown is in `manifest.json`.

The append-only `ledger.jsonl` includes initial and retried attempts. In
contrast, `usage.json` describes only its corresponding invocation. Original
run-level files are preserved as `*-initial.json` where a rerun occurs;
`all.json` and invocation usage should not be treated as the accounting ledger.

## Contents, restore and verify

Each main run has its own archive. `set-aside.tar.gz` contains smoke and
preflight records, superseded failures, controller state/logs and source
provenance. All archives retain the original `runs/...` paths and file bytes.
Tar ownership, modes and timestamps are normalized; gzip timestamps are zero.

From the repository root (or the root of the unpacked delivery ZIP):

```sh
shasum -a 256 -c data/second-model/SHA256SUMS
for archive in data/second-model/*.tar.gz; do
  tar --keep-old-files -xzf "$archive"
done
shasum -a 256 -c data/second-model/FILES.sha256
```

Use an empty destination; `--keep-old-files` refuses to overwrite an existing
run. On Linux, `sha256sum` can replace `shasum -a 256`.

Verification restored **1,431 files** into a clean directory, validated
**1,149 JSON/JSONL files**, checked every restored SHA-256 digest, and confirmed
exact 180/30/60 manifest-to-summary coverage, episode IDs, model, conditions,
seeds and one-beat counts. Ledger/event identity checks also passed. This is
an integrity check, not an analysis of the experimental hypotheses.

# Second-model preregistered replication records

Raw records collected on 5 October 2026 with `azure:gpt-4.1-mini` through the
SysteMind gateway (`https://agentport.world/v1`). The fixed preregistration is
[paper commit c420bf94](https://github.com/LeoYiLi/agentic-web-paper/blob/c420bf94fbd384421f7117076297c6fe07aea590/docs/PREREGISTRATION-second-model.md),
committed at **2026-10-05 15:10:03 UTC**, before the smoke test or formal runs.
All episodes ran on unchanged harness commit
`3408758ecace59dab0b384a0eb81b2adb4fd18df`.

## Record counts and failures

**270 final summary records are present; 22 still represent technical failures.**
These counts must not be described as 270 successful episodes.

| Run | Final summaries | Initial technical failures | Episodes rerun once | Final technical failures |
|---|---:|---:|---:|---:|
| `m2-e0` | 180 / 180 | 92 | 92 | 22 |
| `m2-dir` | 30 / 30 | 0 | 0 | 0 |
| `m2-e7` | 60 / 60 | 5 | 5 | 0 |

All 97 first technical attempts are preserved separately. Each was rerun once
at `--par 2`, with the same experimental settings; none received a third
attempt. A missing page is a model outcome and is not eligible for this retry.
The final technical-failure episode IDs are listed in `manifest.json` and
`execution/verification.json`.

The original run manifests and shuffled order are retained under
`execution/*-initial-manifest.json`, alongside stage commands, timestamps and
retry selections. The harness writes another run manifest when invoked for
resumption; the archived initial manifests preserve the first invocation.

## Design and archives

| Archive | Design | Summary records |
|---|---|---:|
| `m2-e0.tar.gz` | A, B, C, D, Ab, Cb; E = 0; conf/lab/trip at (d,i) = (2,4) and (3,8); seeds 4-8 | 180 |
| `m2-dir.tar.gz` | Cr, Dr; E = 0; conf/lab/trip at (2,4); seeds 4-8 | 30 |
| `m2-e7.tar.gz` | A, B, C, D; E = 0.7; conf/lab/trip at (2,4); seeds 4-8 | 60 |
| `set-aside.tar.gz` | Smoke: A/D at conf-D2-I4, E = 0, seeds 1-2 (4 episodes); first technical attempts (97 episodes) | 101 |

Formal runs use one beat, order seed 2 and initial concurrency 10. Exact
commands and run settings are in `execution/plan.json` and the stage records.
The smoke test preceded the formal runs and had 76 successful calls, all with
the expected serving model and no technical failure.

All **6,948 recorded successful model calls** have `served` equal to
`azure:gpt-4.1-mini`: 6,570 in the final run directories and 378 in the
set-aside archive. Serving identity comes from `x-rmg-served-by`, retained as
`served` in each `llm` event. Failed requests without a successful response
cannot provide that evidence and remain recorded as failures.

## Network interruptions and operational interventions

The observed technical errors were `fetch failed` and request timeouts.
The `m2-e0` retry process was paused with SIGSTOP at 17:23:16 UTC and resumed
as the same process at 17:32:20 UTC. The `m2-e7` initial process was paused by
an external network guard at 19:59:49 UTC and resumed as the same process at
20:05:31 UTC. Read-only connectivity checks preceded resumption; successful
model calls were subsequently confirmed. GET connectivity alone was not
treated as evidence that a model request succeeded.

The guard pauses a run after failures in three distinct episodes within
90 seconds. It never retries episodes itself. Operational scripts and pause
records are preserved in `execution/`. Pausing can affect in-flight request
timers; these interventions and the transport failures are limitations of
this collection. No model, harness code, HTTP timeout or experimental setting
was changed to hide failures. Concurrency was lowered only for the prescribed
technical reruns.

No contrasts were computed for this delivery. The analyst must apply the
preregistered complete-block and sensitivity rules, including the 80%
complete-block delivery gate, before interpreting R1-R5. Presence of all
270 summaries does not establish that this gate is met.

## Billing: actual ledger reconciliation pending

The sum of `x-rmg-cost-microusd` retained in successful-call events is
**2,697,015 micro-USD ($2.697015)**, including smoke and archived failed first
attempts. This is a response-header subtotal, **not a verified total bill**.
Timed-out or otherwise failed requests may have incurred charges absent from
these successful-response headers.

The actual ledger is at <https://agentport.world/calls>. Reconcile using the
supplied API key and the UTC windows in `execution/billing-windows.json`:
overall **2026-10-05 16:00:41 through 20:29:09 UTC**, allowing for late-settled
timed-out requests. The unchanged harness did not send `x-rmg-experiment-id`
or `x-rmg-episode-id`. `usage.json` uses legacy model pricing and must not be
used as the actual bill. Ledger export is still required to close billing.

## Restore and verify

From the repository root, restore into an empty directory to avoid overwriting
existing runs:

```bash
sha256sum -c data/second-model/SHA256SUMS
restore_dir=$(mktemp -d)
for archive in data/second-model/*.tar.gz; do
  tar --keep-old-files -xzf "$archive" -C "$restore_dir"
done
cp data/second-model/FILES.sha256 "$restore_dir/FILES.sha256"
(cd "$restore_dir" && sha256sum --quiet -c FILES.sha256)
```

All **1,649 raw files** were restored in a clean temporary directory and
matched their SHA-256 hashes. Original file bytes are retained; tar ownership,
mode and timestamps are normalized, and gzip timestamps are zero. The supplied
API key was scanned for and is absent from the archives and published metadata.

The Python scripts in `execution/` are the operational versions used on the
collection machine, with its absolute paths. They are retained for audit;
see the archived commands and pinned harness to reproduce the design on a
fresh machine. Credentials are read from an external file and are not included.
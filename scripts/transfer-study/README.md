# Independent project-allocation transfer study

This extension adds only files in this directory. It does not modify the original
harness or any Study 1–8 scores. The collection transport is imported directly
from `../../src/lib/subscription.js`; no API-key client or fallback is used.
No model call is authorized by this README, implementation, or offline tests.
The final protocol must first be committed and pushed, and the supervising
agent/author must explicitly authorize starting collection.

## Offline preparation

```sh
node scripts/transfer-study/tests.mjs
node scripts/transfer-study/manifest.mjs > scripts/transfer-study/source-manifest.json
```

Tests use deterministic fixtures and mocked calls only. They verify fresh
world generation and all optimal ties, the solver against independent recursive
enumeration for 1,100 worlds, invalid decisions, question and iteration limits,
first-submission finality, equal full-information iteration limits, transport
failure reruns/resume, serving exclusions, authorization guards and incomplete
primary-analysis handling. No login file is read by these tests.

`task.mjs` generates projects using mulberry32 initialized from the first
little-endian 32 bits of SHA-256(`portfolio-transfer-v1:<seed>`). There is no
rejection sampling or selection by solution quality. Episode order uses the
explicit configured seed 20261008. The two policies are fixed in `engine.mjs`.
Only requester/holder policy text differs between the comparison arms.
The full-information arm supplies all holder facts, exposes submission only,
and has the same eight requester iterations and 3,000 output-token limit.
A parseable submission ends immediately, including invalid/empty selections;
there is no feedback on its feasibility or quality.

All worlds, exact answer keys, and their hashes are saved before the first
model call. The generator's 256-subset reference enumeration never calls a model.

## Registration receipt and execution gate

After committing/pushing the protocol and explicitly authorizing collection,
prepare an authorization JSON outside any publishable credential bundle:

```json
{
  "authorized": true,
  "registration_commit": "FULL_40_CHARACTER_REGISTRATION_COMMIT",
  "protocol_file": "ABSOLUTE_PATH_TO_THE_FROZEN_PROTOCOL",
  "protocol_sha256": "SHA256_OF_THOSE_PROTOCOL_BYTES",
  "source_manifest": {"schema": 1, "files": {"COPY": "THE_EXACT_MANIFEST_OBJECT"}}
}
```

Replace `source_manifest` with the complete object printed by `manifest.mjs`.
The runner verifies protocol bytes and every frozen source/config hash before
starting; each worker verifies them again. The receipt records the parent's
attestation of pushed registration and permission, not a claim that this script
itself independently verifies the remote Git timestamp. It contains no login
secrets. Do not alter source/config after freezing; a change requires an explicit
protocol amendment before further calls, and the saved run identity must agree.

Only after that gate:

```sh
node scripts/transfer-study/run.mjs --mode smoke --execute --authorization PATH_TO_RECEIPT
node scripts/transfer-study/score.mjs --run scripts/transfer-study/runs/smoke --validate-only
node scripts/transfer-study/run.mjs --mode formal --execute --authorization PATH_TO_RECEIPT
```

Smoke validation reports only record/scorer completion and technical status.
Do not inspect smoke outcome values to adapt tasks, budgets or policies.
The formal sample is 48 paired worlds and 12 predetermined full-information
diagnostics (108 episodes). Initial concurrency is six; permitted technical
reruns occur after the initial sweep, with concurrency two. A separate worker
process per attempt isolates the original adapter's environment-based ledger.
The original adapter's transient call retry behavior is unchanged.

## Status, failures and preservation

```sh
node scripts/transfer-study/run.mjs --mode formal --status
```

Status contains completion/technical counts and known resource use only.
It never shows selections, utilities or treatment effects. Each attempt stores
full model messages, prompts, tool inputs/outputs, caller/response hashes,
upstream serving metadata and usage. The transport ledger retains response IDs
and every retry. These are synthetic task records; credentials are never copied.
Original SSE wire bytes are not retained: the adapter returns parsed response
messages plus upstream metadata, which are preserved without text truncation.

Completed attempts/finals are never overwritten. A technical failure receives
one rerun with identical settings. Model non-submission, malformed calls,
invalid selections and output truncation are model outcomes, not rerun reasons.
A wrong/missing served identity stops the sweep and terminates active workers;
it is not rerun as an ordinary transient failure. Raw interrupted records remain.
Implementation faults also stop the sweep for explicit review.

A newly executed attempt returning HTTP 401 pauses the whole sweep before an
immediate rerun can spend the remaining opportunity. Restore the normal Codex
login, then resume manually; the controller must not automatically resume an
authentication pause. The saved failed attempt is preserved. On explicit
resume, its recorded 401 is processed as the original technical failure, so
only the single allowed rerun is available. A fresh 401 during attempt 2 pauses
again; the next explicit resume finalizes that saved record as
`technical-exhausted`, without an attempt 3. No credential refresh or extra
model call is performed by this handling. In-flight workers terminated by the
pause retain raw records and use the interruption procedure below.

For a genuine interrupted process, first stop all workers, inspect the operational
cause without examining quality, then explicitly classify the interrupted
attempts while preserving their events:

```sh
node scripts/transfer-study/run.mjs --mode formal --mark-interrupted-technical
```

This command makes no model call, refuses serving exclusions, and writes only
technical summaries plus a recovery record. Resume with the same execution
command. Attempt 2 is the only episode rerun; a second technical failure is
finalized as `technical-exhausted`, not utility zero. Fatal serving exclusions
require external investigation, not this recovery operation.

## Outcome files after collection

`score.mjs` refuses outcome analysis while any planned final status is absent.
Smoke permits only `--validate-only`. Formal scoring can be run after all
attempts conclude:

```sh
node scripts/transfer-study/score.mjs --run scripts/transfer-study/runs/formal --out scripts/transfer-study/formal-results.json
```

The scorer ignores any model-reported utility and recomputes feasibility/value
from the saved world. Normalized utility is zero for invalid/model failures.
Technical exhaustion remains null. The primary comparison requires all 48
nontechnical pairs; otherwise no confirmatory estimate, CI or p-value is
computed. The initial statistical helper uses the frozen percentile paired
bootstrap and fixed-seed Monte Carlo sign flip; the parent analysis should
independently verify it. Full-information outcomes are descriptive, not a
cost-matched baseline. Raw ledgers may contain reported usage for failed calls;
aggregate resource counters label when they only sum verified successful calls.

The supervising `control.py` uses an exclusive process lock and saved operational state. It runs the six smoke episodes, checks record/scorer execution without displaying quality, then runs the fixed formal manifest. It never computes formal contrasts or restarts itself after an authentication/serving failure. `runs/registration-receipt.json` records the frozen protocol and source manifest; no credentials enter this receipt.

# GPT-6 Astra subscription replication

The experiment design is registered in `LeoYiLi/agentic-web-paper` at
`44a242195f828e616a77adfacf45a4c0082ac48f`; transport parameters were recorded
before experimental smoke at `8d05ae53378e528ad06bf2dbb9e97ad3522f9ea4`.
The earlier Azure registration is preserved separately in that repository.

The task generator, arm definitions, requester/responder behavior and scorer
are from Study 7 (`3408758`; checkout `08e492e` adds comments and archives).
Only model transport and operational cost display change. The transport sends
the original system instructions, conversation and function schemas to the
Codex subscription Responses endpoint. It does not run a coding-agent wrapper
or add coding tools. It reads the existing ChatGPT login from Codex's auth
store and has no API-key or alternate-model fallback.

`gpt-6-astra` rejects the harness's `temperature`. The registration therefore
declares service-default sampling and medium reasoning, with the original
per-call token limits sent as `max_output_tokens`. That limit includes
reasoning tokens. These differences must be disclosed in comparisons with the
original DeepSeek experiment.

Each terminal response's own `model`, usage, response ID, timing, actual
parameters and request/output hashes are appended to `runs/<run>/ledger.jsonl`.
`served` is copied from the upstream response's model field. A mismatch fails
closed and is explicitly logged. Prompts, OAuth tokens and account identifiers
are not written to the ledger. The ordinary experiment transcripts remain in
the run directory.

The subscription does not return per-call USD charges. The ledger records null
costs, and the driver's legacy cost estimate is disabled for this transport.
Do not interpret null as zero or price these runs at DeepSeek's API rates.
`usage.json` describes one invocation; the append-only ledger covers initial
calls and technical retries and is the accounting source.

## Run

With Node dependencies installed and Codex signed in using ChatGPT:

```sh
node --test scripts/second-model/test-transport.mjs
STUDY_SUBSCRIPTION_LEDGER=runs/transport-preflight/ledger.jsonl \
  node scripts/second-model/preflight.mjs

STUDY_TRANSPORT=codex-subscription STUDY_MODEL=gpt-6-astra \
STUDY_SUBSCRIPTION_LEDGER=runs/m2-smoke/ledger.jsonl \
STUDY_HTTP_TIMEOUT_MS=180000 \
node src/run.js --run m2-smoke --arms A --scenarios conf-D2-I4 \
  --E 0 --seeds 2 --seed-start 1 --beats 1 --order-seed 2 --par 2 --log silent

python3 scripts/second-model/run-all.py
python3 scripts/second-model/status.py m2-e0 m2-dir m2-e7
```

The controller refuses to start the 270 episodes until the two smoke episodes
have summaries, no technical failures, and nonempty matching `served` fields.
It runs the registered 180/30/60 cells sequentially, each at parallelism 10.
Technical failures and crashes are preserved in `<run>-technical-fail` and
retried once at parallelism 3. Model failures (including missing pages) are
retained. A second technical failure is reported without another episode retry.
The controller saves original manifests, usage and aggregate files before a
technical rerun can replace them. Do not start a second controller concurrently.

The status script reports only operational completion, technical failures and
serving identity. Do not inspect quality measures or compute contrasts until
all 270 summaries exist.

## Package

```sh
python3 scripts/second-model/package.py
shasum -a 256 -c data/second-model/SHA256SUMS
```

Packaging refuses incomplete sweeps, verifies every response against its event
record, archives each main run separately plus a set-aside archive, and verifies
all archived file bytes. It computes no quality statistics or contrasts.
Preserve the original records and the per-run ledgers, including failures.

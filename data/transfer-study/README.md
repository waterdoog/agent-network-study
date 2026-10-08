# Transfer-study raw archive (author-facing)

Paper registration commit: `f34dc4606b11e8d711430ad2da65c6e05e69a8ff`.
Experiment source commit: `cec9631550af39e7c0f8435bb6908c4eff41c1d2`.
Protocol SHA-256: `056cab1ff1b74685ed557e14902db1000d2129ae0513009c78681f0eb8df7ee0`.
Model: `gpt-6-astra`; transport: ChatGPT subscription; USD cost: unknown/null.

This package was made only after all 6 smoke and 108 formal final statuses
existed and the controller/runner lock was inactive. It preserves every
included raw file byte-for-byte, including technical attempts, transport
ledgers, complete parsed prompts/messages, tool inputs/outputs and final
records. It does not reconstruct SSE wire bytes that were never saved.
No quality outcome was computed by the packaging helper. Known resource
counts per mode are in `manifest.json`; missing terminal responses can leave
unobserved consumption, so these are known-usage sums, not guaranteed billing.
Reasoning tokens are included in output tokens and are not added twice.

`formal.tar.gz` and `smoke.tar.gz` restore under `runs/`.
`frozen-source.tar.gz` contains the registered source tree under
`agent-network-study/`, the frozen protocol under `paper-registration/`,
and the post-registration packaging helper under `audit/`.
Any `operations-reviewed.tar.gz` contains only explicitly reviewed operational
files named in the manifest. Credentials, registration receipt and controller
lock are excluded. All other excluded operational files and reasons are listed;
no included content was silently redacted or changed. This raw author-facing
archive is not automatically an anonymous public supplement.

## Verify and restore offline

```sh
shasum -a 256 -c SHA256SUMS
mkdir restored
for archive in *.tar.gz; do tar -xzf "$archive" -C restored; done
(cd restored && shasum -a 256 -c ../FILES.sha256)
```

Every tar member was extracted into a clean temporary directory and matched
its original SHA-256 and byte count before publication (700 files).
Source/protocol bytes were also checked against their full Git revisions.
No model/login is needed for deterministic testing or scoring:

```sh
node restored/agent-network-study/scripts/transfer-study/tests.mjs
node restored/agent-network-study/scripts/transfer-study/score.mjs --run restored/runs/smoke --validate-only
node restored/agent-network-study/scripts/transfer-study/score.mjs --run restored/runs/formal --out reproduced-results.json
```

The formal scorer refuses a confirmatory primary result with unresolved
technical comparison pairs. Smoke never joins formal analysis. Do not run
collection/control commands when reproducing this offline archive.

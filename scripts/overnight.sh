#!/usr/bin/env bash
# Unattended sweep. Every stage is resumable: re-running this script skips
# episodes that already have a summary.json, so a killed run is restarted by
# issuing the same command again.
set -uo pipefail
cd "$(dirname "$0")/.."
source ~/.study.env

STAMP=$(date -u +%Y%m%dT%H%M)
LOG=runs/overnight-$STAMP.log
mkdir -p runs
exec > >(tee -a "$LOG") 2>&1

echo "=== $(date -u +%FT%TZ)  agent-network-study overnight ==="
echo "model=$STUDY_MODEL  node=$(node -v)  cores=$(nproc)"
echo

echo "--- stage 1: answer keys ---"
node scripts/verify-keys.mjs || { echo "ABORT: answer keys are wrong"; exit 1; }
echo

echo "--- stage 2: smoke (2 episodes) ---"
node src/run.js --smoke --run smoke --par 2
SMOKE_OK=$(find runs/smoke -name summary.json 2>/dev/null | wc -l)
echo "smoke episodes complete: $SMOKE_OK/2"
if [ "$SMOKE_OK" -lt 2 ]; then echo "ABORT: smoke did not complete"; exit 1; fi
node -e '
const fs=require("fs");
const rs=fs.readdirSync("runs/smoke").filter(d=>fs.existsSync(`runs/smoke/${d}/summary.json`))
  .map(d=>JSON.parse(fs.readFileSync(`runs/smoke/${d}/summary.json`,"utf8")));
let built=0,total=0;
for(const r of rs) for(const b of r.beats){total++; if(b.artifactLen>0)built++;}
console.log(`smoke: ${built}/${total} beats produced an artifact`);
if(built/total < 0.75){console.log("ABORT: too many beats produced nothing");process.exit(1);}
' || exit 1
echo

echo "--- stage 3: main sweep ---"
node src/run.js --run main --par 8 --seeds 3
echo

echo "--- stage 4: analysis ---"
node src/analyze.js main
echo

echo "--- stage 5: model replication (glm-4.6, conference only, 2 seeds) ---"
STUDY_MODEL=z-ai/glm-4.6 node src/run.js --run repl-glm --scenarios conference --par 6 --seeds 2 || echo "replication failed, main results stand"
node src/analyze.js repl-glm || true
echo

echo "=== $(date -u +%FT%TZ) done ==="
echo "main results:  runs/main/RESULTS.md"
echo "replication:   runs/repl-glm/RESULTS.md"

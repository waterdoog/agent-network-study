#!/bin/bash
# Pre-registered runs (docs/PREREGISTRATION-formation-and-reach.md), resumed on the VM.
set -uo pipefail
export PATH=/mnt/data0/yuchen/toolchain/node-v24.18.0-linux-x64/bin:$PATH
cd /mnt/data0/yuchen/repos/agent-network-study-exp
. ~/.study.env
REACH="--run az-reach --arms A,B,C,D --scenarios conf-D2-I4,lab-D2-I4,trip-D2-I4 --E 0.3,0.7 --seeds 5 --seed-start 4 --beats 1 --order-seed 2"
echo "=== az-reach resumed on VM $(date "+%F %T")" >> runs/az-reach.log
node src/run.js $REACH --par 20 >> runs/az-reach.log 2>&1
echo "=== az-reach exit $? $(date "+%F %T")" >> runs/az-reach.log
# rule: a technical failure is rerun once with the same settings
mkdir -p runs/az-reach-technical-fail
python3 - <<PY
import json, glob, os, shutil
for f in glob.glob("runs/az-reach/*/summary.json"):
    b = json.load(open(f))["beats"][0]
    if b.get("failureKind") == "technical":
        d = os.path.dirname(f); shutil.move(d, "runs/az-reach-technical-fail/"); print("set aside", os.path.basename(d))
PY
echo "=== az-reach technical rerun $(date "+%F %T")" >> runs/az-reach.log
node src/run.js $REACH --par 10 >> runs/az-reach.log 2>&1
echo "=== az-reach technical rerun exit $? $(date "+%F %T")" >> runs/az-reach.log
touch runs/az-VM-DONE

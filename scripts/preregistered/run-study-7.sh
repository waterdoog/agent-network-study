#!/bin/bash
# Pre-registered: docs/PREREGISTRATION-access-decomposed.md (harness 3408758).
set -uo pipefail
export PATH=/mnt/data0/yuchen/toolchain/node-v24.18.0-linux-x64/bin:$PATH
cd /mnt/data0/yuchen/repos/agent-network-study-access
. ~/.study.env
RUN="--run az-access --arms Ab,Cb --scenarios conf-D2-I4,lab-D2-I4,trip-D2-I4,conf-D3-I8,lab-D3-I8,trip-D3-I8 --E 0 --seeds 5 --seed-start 4 --beats 1 --order-seed 2"
echo "=== az-access start $(date "+%F %T")" >> runs/az-access.log
node src/run.js $RUN --par 20 >> runs/az-access.log 2>&1
echo "=== az-access exit $? $(date "+%F %T")" >> runs/az-access.log
mkdir -p runs/az-access-technical-fail
python3 - <<PY
import json, glob, os, shutil
for f in glob.glob("runs/az-access/*/summary.json"):
    if json.load(open(f))["beats"][0].get("failureKind") == "technical":
        d = os.path.dirname(f); shutil.move(d, "runs/az-access-technical-fail/"); print("set aside", os.path.basename(d))
PY
node src/run.js $RUN --par 10 >> runs/az-access.log 2>&1
echo "=== az-access technical rerun exit $? $(date "+%F %T")" >> runs/az-access.log
touch runs/az-access-DONE

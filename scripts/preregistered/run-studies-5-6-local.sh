#!/bin/bash
# The two pre-registered runs (docs/PREREGISTRATION-formation-and-reach.md), resumable:
# episodes with a summary.json are skipped. Logs are appended, never truncated.
set -uo pipefail
cd ~/Desktop/ans-wt-exp
source ~/.study.env
export NODE_USE_ENV_PROXY=1
echo "=== az-narrow start $(date '+%F %T')" >> runs/az-narrow.log
node src/run.js --run az-narrow --arms A,B,C,D,Cr,Dr \
  --scenarios conf-D2-I4,lab-D2-I4,trip-D2-I4,conf-D3-I8,lab-D3-I8,trip-D3-I8 \
  --E 0 --seeds 5 --seed-start 4 --beats 1 --par 10 --order-seed 2 >> runs/az-narrow.log 2>&1
echo "=== az-narrow exit $? $(date '+%F %T')" >> runs/az-narrow.log
echo "=== az-reach start $(date '+%F %T')" >> runs/az-reach.log
node src/run.js --run az-reach --arms A,B,C,D \
  --scenarios conf-D2-I4,lab-D2-I4,trip-D2-I4 \
  --E 0.3,0.7 --seeds 5 --seed-start 4 --beats 1 --par 10 --order-seed 2 >> runs/az-reach.log 2>&1
echo "=== az-reach exit $? $(date '+%F %T')" >> runs/az-reach.log
echo done > runs/az-ALL-DONE

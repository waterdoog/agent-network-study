#!/bin/bash
# Pre-registered rule: a technical failure is rerun once with the same settings.
set -uo pipefail
cd ~/Desktop/ans-wt-exp
source ~/.study.env
export NODE_USE_ENV_PROXY=1
echo "=== az-narrow technical rerun start $(date '+%F %T')" >> runs/az-narrow.log
node src/run.js --run az-narrow --arms A,B,C,D,Cr,Dr \
  --scenarios conf-D2-I4,lab-D2-I4,trip-D2-I4,conf-D3-I8,lab-D3-I8,trip-D3-I8 \
  --E 0 --seeds 5 --seed-start 4 --beats 1 --par 2 --order-seed 2 >> runs/az-narrow.log 2>&1
echo "=== az-narrow technical rerun exit $? $(date '+%F %T')" >> runs/az-narrow.log

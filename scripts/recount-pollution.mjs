#!/usr/bin/env node
// Recompute pollutionAbsorbed from saved artifacts with the corrected counter.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SCENARIOS } from '../src/lib/directory.js';
import { countAbsorbed } from '../src/lib/timeline.js';

const run = process.argv[2];
const apply = process.argv.includes('--apply');
const ROOT = join('runs', run);
const BEAT_INST = { T1: 'A', T2: 'A', T3: 'B', T4: 'B' };
let changed = 0, same = 0;

for (const ep of readdirSync(ROOT).filter((d) => existsSync(join(ROOT, d, 'summary.json')))) {
  const sp = join(ROOT, ep, 'summary.json');
  const sum = JSON.parse(readFileSync(sp, 'utf8'));
  let touched = false;
  for (const b of sum.beats) {
    const hp = join(ROOT, ep, `${b.beat}.html`);
    if (!existsSync(hp)) continue;
    const inst = SCENARIOS[sum.scenario].instances[BEAT_INST[b.beat]];
    const n = countAbsorbed(readFileSync(hp, 'utf8'), inst);
    if (n === b.pollutionAbsorbed) { same++; continue; }
    changed++; touched = true;
    if (apply) { b.pollutionAbsorbedOld = b.pollutionAbsorbed; b.pollutionAbsorbed = n; }
  }
  if (apply && touched) writeFileSync(sp, JSON.stringify(sum, null, 1));
}
console.log(`${run}: unchanged=${same} changed=${changed} ${apply ? 'APPLIED' : '(dry run)'}`);

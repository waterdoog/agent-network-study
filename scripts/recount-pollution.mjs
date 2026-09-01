#!/usr/bin/env node
// Recompute pollution from saved artifacts, splitting adoption from fabrication.
//
// `pollutionSeen` is stored as a count, not a set, so the texts an episode
// actually encountered are reconstructed from the card ids in its event log:
// the directory is deterministic in (scenario, instance, E, seed, profile), so
// which planted texts a contacted card held is recoverable exactly.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SCENARIOS, buildDirectory } from '../src/lib/directory.js';
import { countAbsorbed } from '../src/lib/timeline.js';

const run = process.argv[2];
const apply = process.argv.includes('--apply');
const ROOT = join('runs', run);
const BEAT_INST = { T1: 'A', T2: 'A', T3: 'B', T4: 'B' };
const reworked = (facts, rw) => facts.map((f) => (rw?.factOverrides?.[f.id] ? { ...f, ...rw.factOverrides[f.id] } : f));

let changed = 0, same = 0, invTotal = 0;
for (const ep of readdirSync(ROOT).filter((d) => existsSync(join(ROOT, d, 'summary.json')))) {
  const sp = join(ROOT, ep, 'summary.json');
  const sum = JSON.parse(readFileSync(sp, 'utf8'));
  const events = readFileSync(join(ROOT, ep, 'events.jsonl'), 'utf8')
    .split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  let touched = false;
  for (const b of sum.beats) {
    const hp = join(ROOT, ep, `${b.beat}.html`);
    if (!existsSync(hp)) continue;
    const instKey = BEAT_INST[b.beat];
    const base = SCENARIOS[sum.scenario].instances[instKey];
    const isRework = b.mode === 'rework';
    const inst = isRework ? { ...base, facts: reworked(base.facts, base.rework) } : base;

    const dir = buildDirectory({ scenario: sum.scenario, instance: instKey, E: sum.E, seed: sum.seed, profile: sum.profile || 'bare' });
    const seen = new Set();
    for (const e of events) {
      if (e.beat !== b.beat) continue;
      if (!['tool.ask', 'tool.read', 'tool.build', 'consult'].includes(e.evt)) continue;
      const card = dir.byId.get(e.card);
      if (card) for (const p of card.planted) seen.add(p);
    }

    const r = countAbsorbed(readFileSync(hp, 'utf8'), inst, seen);
    if (r.absorbed === b.pollutionAbsorbed && r.invented === b.wrongInvented) { same++; continue; }
    changed++; touched = true;
    if (apply) { b.pollutionAbsorbed = r.absorbed; b.wrongInvented = r.invented; b.pollutionSeenTexts = seen.size; }
    invTotal += r.invented;
  }
  if (apply && touched) writeFileSync(sp, JSON.stringify(sum, null, 1));
}
console.log(`${run}: unchanged=${same} changed=${changed} invented(total)=${invTotal} ${apply ? 'APPLIED' : '(dry run)'}`);

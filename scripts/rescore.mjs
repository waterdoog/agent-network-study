#!/usr/bin/env node
// Re-score saved artifacts with the current scorer. No model calls: the HTML is
// already on disk, so a scorer bug is repairable for free after the fact.
//
// Non-error beats must come back byte-identical — that is the check that this
// is a repair and not a silent re-interpretation of the whole run.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const SCORER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'score.js');
const runId = process.argv[2];
const apply = process.argv.includes('--apply');
const ROOT = join('runs', runId);

const FN = { conference: 'registrationTotal', 'lab-dashboard': 'statusFor', 'trip-planner': 'tripBudget' };

async function scoreOne(hp, ap, fn) {
  const { stdout } = await exec(process.execPath, [SCORER, hp, ap, fn], { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
  const line = stdout.split('\n').find((l) => l.startsWith('__SCORE__'));
  if (!line) throw new Error('no result line');
  return JSON.parse(line.slice('__SCORE__'.length));
}
const f1 = (r) => {
  const asserted = r.results.filter((x) => x.got != null && x.got !== '').length || r.total;
  const rec = r.total ? r.pass / r.total : 0;
  const pre = asserted ? r.pass / asserted : 0;
  return rec + pre ? (2 * rec * pre) / (rec + pre) : 0;
};

let changed = 0, same = 0, still = 0;
for (const ep of readdirSync(ROOT).filter((d) => existsSync(join(ROOT, d, 'summary.json')))) {
  const sp = join(ROOT, ep, 'summary.json');
  const sum = JSON.parse(readFileSync(sp, 'utf8'));
  const fn = FN[sum.scenario];
  let touched = false;
  for (const b of sum.beats) {
    const hp = join(ROOT, ep, `${b.beat}.html`), ap = join(ROOT, ep, `${b.beat}.assertions.json`);
    if (!existsSync(hp) || !existsSync(ap)) { if ((b.errors || []).length) still++; continue; }
    let r;
    try { r = await scoreOne(hp, ap, fn); } catch (e) { still++; continue; }
    const nf1 = f1(r);
    if (b.pass === r.pass && b.total === r.total) { same++; continue; }
    console.log(`  ${ep} ${b.beat}: ${b.pass}/${b.total} f1=${(b.f1 ?? 0).toFixed(2)}  ->  ${r.pass}/${r.total} f1=${nf1.toFixed(2)}${(b.errors || []).length ? '   (was: ' + b.errors[0].slice(0, 50) + ')' : ''}`);
    changed++; touched = true;
    if (apply) {
      b.pass = r.pass; b.total = r.total; b.parsed = r.parsed; b.fnPresent = r.fnPresent;
      b.f1 = nf1; b.recall = r.total ? r.pass / r.total : 0;
      b.failures = r.results.filter((x) => !x.ok).map((x) => x.id).slice(0, 12);
      b.errors = []; b.rescored = true;
    }
  }
  if (apply && touched) writeFileSync(sp, JSON.stringify(sum, null, 1));
}
console.log(`\nunchanged=${same}  changed=${changed}  unrecoverable=${still}   ${apply ? 'APPLIED' : '(dry run — pass --apply to write)'}`);

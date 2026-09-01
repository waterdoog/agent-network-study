#!/usr/bin/env node
// The 2x2. Everything here is the point of the redesign: with all four cells
// present, the access effect and the discovery effect separate additively, and
// a study that ran only A against D cannot tell you which term carried it.
//
//   A open+sandbox   B open+store
//   C bounded+sandbox D bounded+store
//
//   d_access    = 1/2 [ (B-A) + (D-C) ]
//   d_discovery = 1/2 [ (A-C) + (B-D) ]
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const runId = process.argv[2] || readdirSync('runs').sort().pop();
const ROOT = join('runs', runId);
const rows = JSON.parse(readFileSync(join(ROOT, 'all.json'), 'utf8'));

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

/**
 * DISABLED — the denominator is wrong. See docs/DESIGN-FLAWS.md.
 *
 * Realization was meant to divide out the ceiling the fact allocation imposed.
 *
 * A bounded arm at E=0.7 cannot reach 70% of the fact holders, so its low recall
 * is arithmetic, not behaviour. `attainable` is the share of this scenario's
 * holders the arm could address at all — read from the beat.dir event, so this
 * is exact at the holder level and needs no re-run. What is left after dividing
 * is what the configuration actually converted: did it find the right holders,
 * ask enough of them, resolve the conflicts.
 */
function attainableFor(runId, ep, armId) {
  if (armId === 'A' || armId === 'B') return 1; // open directory reaches every holder
  try {
    const lines = readFileSync(join('runs', runId, ep, 'events.jsonl'), 'utf8').split('\n');
    for (const l of lines) {
      if (!l.includes('"beat.dir"')) continue;
      const e = JSON.parse(l);
      const inR = e.holdersInRoster, out = e.holdersOutside;
      if (inR == null || out == null) continue;
      return (inR + out) > 0 ? inR / (inR + out) : 1;
    }
  } catch { /* fall through */ }
  return NaN;
}
const f2 = (x) => (Number.isFinite(x) ? (x >= 0 ? ' ' : '') + x.toFixed(3) : '   -- ');
const beatsOf = (r) => Object.fromEntries(r.beats.map((b) => [b.beat, b]));

/** Percentile bootstrap over episodes, resampled within cell. */
function boot(cells, fn, n = 4000, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const out = [];
  for (let i = 0; i < n; i++) {
    const draw = {};
    for (const [k, vals] of Object.entries(cells)) {
      if (!vals.length) { draw[k] = NaN; continue; }
      let acc = 0;
      for (let j = 0; j < vals.length; j++) acc += vals[Math.floor(rnd() * vals.length)];
      draw[k] = acc / vals.length;
    }
    const v = fn(draw);
    if (Number.isFinite(v)) out.push(v);
  }
  out.sort((a, b) => a - b);
  return out.length ? [out[Math.floor(out.length * 0.025)], out[Math.floor(out.length * 0.975)]] : [NaN, NaN];
}

const say = (s = '') => { lines.push(s); console.log(s); };
const lines = [];

say(`# 2x2 factorial — ${runId}`);
say(`episodes=${rows.length}`);
say();

const METRICS = [
  ['requirement F1 (T1 cold)',  (r) => beatsOf(r).T1?.f1],
  ['requirement F1 (T2 rework)', (r) => beatsOf(r).T2?.f1],
  ['requirement F1 (T3 warm)',  (r) => beatsOf(r).T3?.f1],
  ['assertions passed (T1)',    (r) => { const b = beatsOf(r).T1; return b && b.total ? b.pass / b.total : undefined; }],
  ['pollution absorbed (T1)',   (r) => beatsOf(r).T1?.pollutionAbsorbed],
  ['tokens (T1, k)',            (r) => { const v = beatsOf(r).T1?.tokens; return v == null ? undefined : v / 1000; }],
  ['contacts (T1)',             (r) => beatsOf(r).T1?.contacted],
];

// `attainable` is kept as a per-episode covariate so the ceiling is visible in
// the output, but it is NOT used as a denominator: it counts holders while
// recall counts assertions, and the two do not correspond one to one.
for (const r of rows) r.attainable = attainableFor(runId, r.id, r.arm);

const Es = [...new Set(rows.map((r) => r.E))].sort();

for (const [label, get] of METRICS) {
  const cell = (arm, filt = () => true) =>
    rows.filter((r) => r.arm === arm && filt(r)).map(get).filter((v) => v != null && Number.isFinite(v));

  const A = cell('A'), B = cell('B'), C = cell('C'), D = cell('D');
  if (!A.length || !B.length || !C.length || !D.length) { say(`## ${label}\n  (incomplete: A=${A.length} B=${B.length} C=${C.length} D=${D.length})\n`); continue; }

  const mA = mean(A), mB = mean(B), mC = mean(C), mD = mean(D);
  const dAcc = ((mB - mA) + (mD - mC)) / 2;
  const dDis = ((mA - mC) + (mB - mD)) / 2;
  const naive = mB - mC; // what an A-vs-D style comparison of "public" vs "private" reports

  const cells = { A, B, C, D };
  const ciAcc = boot(cells, (d) => ((d.B - d.A) + (d.D - d.C)) / 2);
  const ciDis = boot(cells, (d) => ((d.A - d.C) + (d.B - d.D)) / 2);

  say(`## ${label}`);
  say('```');
  say('                sandbox     store');
  say(`  open        ${f2(mA)}     ${f2(mB)}     A,B`);
  say(`  bounded     ${f2(mC)}     ${f2(mD)}     C,D`);
  say('```');
  say(`  d_access    = ${f2(dAcc)}   95% CI [${f2(ciAcc[0])}, ${f2(ciAcc[1])}]   ${ciAcc[0] * ciAcc[1] > 0 ? 'excludes 0' : 'spans 0'}`);
  say(`  d_discovery = ${f2(dDis)}   95% CI [${f2(ciDis[0])}, ${f2(ciDis[1])}]   ${ciDis[0] * ciDis[1] > 0 ? 'excludes 0' : 'spans 0'}`);
  say(`  |access| / |discovery| = ${Number.isFinite(dAcc / dDis) ? Math.abs(dAcc / dDis).toFixed(2) : '--'}`);
  if (Es.length > 1) {
    for (const E of Es) {
      const f = (r) => r.E === E;
      const a = mean(cell('A', f)), b = mean(cell('B', f)), c = mean(cell('C', f)), d = mean(cell('D', f));
      say(`    E=${E}:  access ${f2(((b - a) + (d - c)) / 2)}   discovery ${f2(((a - c) + (b - d)) / 2)}`);
    }
  }
  say();
}

// H4: do agents use the store affordance when it exists?
say('## H4 — affordance use (store cells only)');
say('| arm | asks/T1 | lists/T1 | reads/T1 | store share |');
say('|---|---|---|---|---|');
for (const arm of ['B', 'D']) {
  const rs = rows.filter((r) => r.arm === arm).map(beatsOf).map((b) => b.T1).filter(Boolean);
  if (!rs.length) continue;
  const a = mean(rs.map((b) => b.asks || 0));
  const l = mean(rs.map((b) => b.lists || 0));
  const rd = mean(rs.map((b) => b.reads || 0));
  say(`| ${arm} | ${a.toFixed(1)} | ${l.toFixed(1)} | ${rd.toFixed(1)} | ${((l + rd) / (a + l + rd) || 0).toFixed(2)} |`);
}
say();
say('A store share near zero is H4 confirmed: the affordance exists and is not used.');

writeFileSync(join(ROOT, 'factorial.md'), lines.join('\n'));
console.log(`\nwritten: ${join(ROOT, 'factorial.md')}`);

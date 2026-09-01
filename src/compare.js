#!/usr/bin/env node
// bare vs realistic. The question the second batch exists to answer: what is a
// vetted roster and a card that says who someone is to you actually worth?
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [R1, R2] = [process.argv[2] || 'axis2x2', process.argv[3] || 'realistic'];
const load = (r) => readdirSync(join('runs', r)).filter((d) => existsSync(join('runs', r, d, 'summary.json')))
  .map((d) => JSON.parse(readFileSync(join('runs', r, d, 'summary.json'), 'utf8')));

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (x, n = 3) => (Number.isFinite(x) ? (x >= 0 ? ' ' : '') + x.toFixed(n) : '   -- ');
const t1 = (r) => r.beats.find((b) => b.beat === 'T1');

function boot(cells, fn, n = 4000) {
  let s = 11; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = {};
    for (const [k, v] of Object.entries(cells)) {
      if (!v.length) { d[k] = NaN; continue; }
      let a = 0; for (let j = 0; j < v.length; j++) a += v[Math.floor(rnd() * v.length)];
      d[k] = a / v.length;
    }
    const x = fn(d); if (Number.isFinite(x)) out.push(x);
  }
  out.sort((a, b) => a - b);
  return out.length ? [out[Math.floor(out.length * 0.025)], out[Math.floor(out.length * 0.975)]] : [NaN, NaN];
}

const METRICS = [
  ['requirement F1 (T1)', (r) => t1(r)?.f1],
  ['contacts (T1)', (r) => t1(r)?.contacted],
  ['search precision (T1)', (r) => t1(r)?.searchPrecision],
  ['tokens k (T1)', (r) => (t1(r)?.tokens ?? NaN) / 1000],
];

const runs = { bare: load(R1), realistic: load(R2) };
console.log(`# ${R1} (bare) vs ${R2} (realistic)`);
console.log(`episodes: bare=${runs.bare.length} realistic=${runs.realistic.length}\n`);

for (const E of [null, 0.3, 0.7]) {
  console.log(E == null ? '## pooled over E' : `## E = ${E}`);
  for (const [label, get] of METRICS) {
    const cell = (run, arm) => runs[run].filter((r) => r.arm === arm && (E == null || r.E === E)).map(get).filter(Number.isFinite);
    const row = {};
    for (const run of ['bare', 'realistic']) {
      const c = { A: cell(run, 'A'), B: cell(run, 'B'), C: cell(run, 'C'), D: cell(run, 'D') };
      if (Object.values(c).some((v) => !v.length)) { row[run] = null; continue; }
      const m = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, mean(v)]));
      row[run] = {
        m, c,
        acc: ((m.B - m.A) + (m.D - m.C)) / 2,
        dis: ((m.A - m.C) + (m.B - m.D)) / 2,
      };
    }
    if (!row.bare || !row.realistic) { console.log(`  ${label}: incomplete`); continue; }
    const ciA = boot(row.realistic.c, (d) => ((d.B - d.A) + (d.D - d.C)) / 2);
    const ciD = boot(row.realistic.c, (d) => ((d.A - d.C) + (d.B - d.D)) / 2);
    console.log(`\n  ${label}`);
    console.log('        cell:      A       B       C       D   |  d_access  d_discovery');
    for (const run of ['bare', 'realistic']) {
      const r = row[run];
      console.log(`    ${run.padEnd(10)}${f(r.m.A)} ${f(r.m.B)} ${f(r.m.C)} ${f(r.m.D)}   |  ${f(r.acc)}   ${f(r.dis)}`);
    }
    const dr = row.realistic, db = row.bare;
    console.log(`    ${'delta'.padEnd(10)}${f(dr.m.A - db.m.A)} ${f(dr.m.B - db.m.B)} ${f(dr.m.C - db.m.C)} ${f(dr.m.D - db.m.D)}   |  ${f(dr.acc - db.acc)}   ${f(dr.dis - db.dis)}`);
    if (E == null) console.log(`    realistic CIs: access [${f(ciA[0])},${f(ciA[1])}]  discovery [${f(ciD[0])},${f(ciD[1])}]`);
  }
  console.log();
}

console.log('## pollution (T1): seen / adopted / invented');
console.log('| arm | bare seen | bare adopt | bare invent | real seen | real adopt | real invent |');
console.log('|---|---|---|---|---|---|---|');
for (const arm of ['A', 'B', 'C', 'D']) {
  const g = (run, k) => mean(runs[run].filter((r) => r.arm === arm).map(t1).filter(Boolean).map((b) => b[k] ?? 0));
  console.log(`| ${arm} | ${f(g('bare', 'pollutionSeenTexts'), 2)} | ${f(g('bare', 'pollutionAbsorbed'), 2)} | ${f(g('bare', 'wrongInvented'), 2)} | ${f(g('realistic', 'pollutionSeenTexts'), 2)} | ${f(g('realistic', 'pollutionAbsorbed'), 2)} | ${f(g('realistic', 'wrongInvented'), 2)} |`);
}

console.log('\n## affordance use (store cells): does giving read access change what agents do?');
console.log('| arm | run | asks | lists | reads | store share |');
console.log('|---|---|---|---|---|---|');
for (const arm of ['B', 'D']) for (const run of ['bare', 'realistic']) {
  const bs = runs[run].filter((r) => r.arm === arm).map(t1).filter(Boolean);
  if (!bs.length) continue;
  const a = mean(bs.map((b) => b.asks || 0)), l = mean(bs.map((b) => b.lists || 0)), rd = mean(bs.map((b) => b.reads || 0));
  console.log(`| ${arm} | ${run} | ${f(a, 1)} | ${f(l, 1)} | ${f(rd, 1)} | ${f((l + rd) / (a + l + rd), 2)} |`);
}

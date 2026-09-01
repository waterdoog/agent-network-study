#!/usr/bin/env node
// The sandbox tax against composition depth.
//
// Paired by (scenario, E, seed): the same task under both arms, so between-task
// variance — which swamped the earlier unpaired comparison — cancels.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const run = process.argv[2] || 'kscan';
const R = join('runs', run);
const eps = readdirSync(R).filter((d) => existsSync(join(R, d, 'summary.json')))
  .map((d) => ({
    s: JSON.parse(readFileSync(join(R, d, 'summary.json'), 'utf8')),
    ev: readFileSync(join(R, d, 'events.jsonl'), 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean),
  }));

const t1 = (s) => s.beats.find((b) => b.beat === 'T1');
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (x, n = 0) => (Number.isFinite(x) ? (x >= 0 ? ' ' : '') + x.toFixed(n) : '  --');
const key = (s) => `${s.scenario}|${s.E}|${s.seed}`;
const buildTokens = (e) => e.ev.filter((x) => x.evt === 'tool.build' && x.beat === 'T1').reduce((a, x) => a + (x.ti || 0), 0);

let seed = 17; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function ciPaired(d) {
  if (!d.length) return [NaN, NaN, NaN];
  const m = mean(d), bs = [];
  for (let i = 0; i < 4000; i++) { let a = 0; for (let j = 0; j < d.length; j++) a += d[Math.floor(rnd() * d.length)]; bs.push(a / d.length); }
  bs.sort((a, b) => a - b);
  return [m, bs[100], bs[3899]];
}

const KS = [...new Set(eps.map((e) => e.s.k))].sort((a, b) => a - b);
const METRICS = [
  ['build prompt tokens (T1)', buildTokens],
  ['total tokens (T1)', (e) => t1(e.s)?.tokens ?? NaN],
  ['requirement F1 (T1)', (e) => t1(e.s)?.f1 ?? NaN],
];

console.log(`# sandbox tax vs composition — ${run}`);
console.log(`episodes=${eps.length}  k values: ${KS.join(', ')}\n`);

for (const [label, get] of METRICS) {
  console.log(`## ${label}`);
  console.log('|  k | sandbox (C) | store (D) | paired tax C-D | 95% CI |');
  console.log('|---|---|---|---|---|');
  for (const k of KS) {
    const byKey = new Map();
    for (const e of eps.filter((x) => x.s.k === k)) {
      const kk = key(e.s);
      if (!byKey.has(kk)) byKey.set(kk, {});
      byKey.get(kk)[e.s.arm] = get(e);
    }
    const pairs = [...byKey.values()].filter((p) => Number.isFinite(p.C) && Number.isFinite(p.D));
    const [m, lo, hi] = ciPaired(pairs.map((p) => p.C - p.D));
    const sig = Number.isFinite(lo) && !(lo < 0 && 0 < hi) ? '  **' : '';
    console.log(`| ${k} | ${f(mean(pairs.map((p) => p.C)))} | ${f(mean(pairs.map((p) => p.D)))} | ${f(m)} | [${f(lo)}, ${f(hi)}]${sig} |`);
  }
  console.log();
}

console.log('## slope: does the tax grow with k?');
const taxAt = (k) => {
  const byKey = new Map();
  for (const e of eps.filter((x) => x.s.k === k)) {
    const kk = key(e.s); if (!byKey.has(kk)) byKey.set(kk, {});
    byKey.get(kk)[e.s.arm] = buildTokens(e);
  }
  return mean([...byKey.values()].filter((p) => p.C != null && p.D != null).map((p) => p.C - p.D));
};
for (const k of KS) console.log(`   k=${k}: tax = ${f(taxAt(k))} tokens`);
if (KS.length >= 2) {
  const a = KS[0], b = KS[KS.length - 1];
  console.log(`   slope over k ${a}->${b}: ${f((taxAt(b) - taxAt(a)) / (b - a))} tokens per component`);
  console.log('\n   k=1 has no dependencies, so its tax is the negative control: it should sit near zero.');
}

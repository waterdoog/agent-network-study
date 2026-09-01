#!/usr/bin/env node
// Three checks the k-scan must pass before it is worth scaling.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const run = process.argv[2] || 'k-pilot';
const R = join('runs', run);
const eps = readdirSync(R).filter((d) => existsSync(join(R, d, 'summary.json')))
  .map((d) => ({ id: d, s: JSON.parse(readFileSync(join(R, d, 'summary.json'), 'utf8')),
                 ev: readFileSync(join(R, d, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) }));
const t1 = (s) => s.beats.find((b) => b.beat === 'T1');
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (x, n = 1) => (Number.isFinite(x) ? x.toFixed(n) : ' --');

console.log(`# k-scan check — ${run} (n=${eps.length})\n`);
console.log('## 1. were components actually delegated separately?');
console.log('| arm | k | builds | distinct components | expected |');
console.log('|---|---|---|---|---|');
for (const arm of ['C', 'D']) for (const k of [1, 5]) {
  const g = eps.filter((e) => e.s.arm === arm && e.s.k === k);
  if (!g.length) continue;
  const builds = mean(g.map((e) => t1(e.s)?.builds ?? 0));
  const comps = mean(g.map((e) => new Set(e.ev.filter((x) => x.evt === 'tool.build' && x.beat === 'T1').map((x) => x.comp)).size));
  console.log(`| ${arm} | ${k} | ${f(builds)} | ${f(comps)} | ${k} |`);
}

console.log('\n## 2. did the arms diverge the way the mechanism says?');
console.log('| arm | k | inlined bytes | store reads | build prompt tokens |');
console.log('|---|---|---|---|---|');
for (const arm of ['C', 'D']) for (const k of [1, 5]) {
  const g = eps.filter((e) => e.s.arm === arm && e.s.k === k);
  if (!g.length) continue;
  const inl = mean(g.map((e) => t1(e.s)?.inlineBytes ?? 0));
  const rd = mean(g.map((e) => t1(e.s)?.storeReads ?? 0));
  const bt = mean(g.flatMap((e) => e.ev.filter((x) => x.evt === 'tool.build' && x.beat === 'T1').map((x) => x.ti)));
  console.log(`| ${arm} | ${k} | ${f(inl, 0)} | ${f(rd)} | ${f(bt, 0)} |`);
}
console.log('\n   C (sandbox) at k=5 must inline; D (store) must read and inline nothing.');

console.log('\n## 3. is k=1 a clean null? (built-in negative control)');
const at = (arm, k, get) => mean(eps.filter((e) => e.s.arm === arm && e.s.k === k).map(get));
for (const k of [1, 5]) {
  const c = at('C', k, (e) => mean(e.ev.filter((x) => x.evt === 'tool.build' && x.beat === 'T1').map((x) => x.ti)));
  const d = at('D', k, (e) => mean(e.ev.filter((x) => x.evt === 'tool.build' && x.beat === 'T1').map((x) => x.ti)));
  console.log(`   k=${k}: C=${f(c, 0)}  D=${f(d, 0)}  tax = ${f(c - d, 0)} tokens${k === 1 ? '   <- should be ~0' : '   <- should be large'}`);
}
const errs = eps.flatMap((e) => e.s.beats.filter((b) => b.errors?.length).map((b) => `${e.id} ${b.beat} ${b.errors[0]}`));
console.log(`\nfailures: ${errs.length}`);
errs.slice(0, 4).forEach((x) => console.log('   ' + x));

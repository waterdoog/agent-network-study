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

console.log('\n## 2. where the tax now lands: the requester\'s own context');
console.log('| arm | k | requester peak prompt | requester total in | builder total in |');
console.log('|---|---|---|---|---|');
const reqTok = (e, how) => {
  const v = e.ev.filter((x) => x.evt === 'llm' && String(x.tag || '').startsWith('req.i') && x.beat === undefined).map((x) => x.ti || 0);
  const all = e.ev.filter((x) => x.evt === 'llm' && String(x.tag || '').startsWith('req.i')).map((x) => x.ti || 0);
  const use = all.length ? all : v;
  return how === 'peak' ? Math.max(0, ...use) : use.reduce((a, b) => a + b, 0);
};
const bldTok = (e) => e.ev.filter((x) => x.evt === 'llm' && String(x.tag || '').startsWith('build.')).reduce((a, x) => a + (x.ti || 0), 0);
for (const arm of ['C', 'D']) for (const k of [1, 5]) {
  const g = eps.filter((e) => e.s.arm === arm && e.s.k === k);
  if (!g.length) continue;
  console.log(`| ${arm} | ${k} | ${f(mean(g.map((e) => reqTok(e, 'peak'))), 0)} | ${f(mean(g.map((e) => reqTok(e, 'sum'))), 0)} | ${f(mean(g.map(bldTok)), 0)} |`);
}
console.log('\n   The sandbox requester has to hold every component to forward it.');
console.log('   The store requester holds names. The gap should open as k grows.');

console.log('\n## 3. is k=1 a clean null? (built-in negative control)');
const at = (arm, k, get) => mean(eps.filter((e) => e.s.arm === arm && e.s.k === k).map(get));
for (const k of [1, 5]) {
  const rq = (e) => e.ev.filter((x) => x.evt === 'llm' && String(x.tag || '').startsWith('req.i')).reduce((a, x) => a + (x.ti || 0), 0);
  const c = at('C', k, rq);
  const d = at('D', k, rq);
  console.log(`   k=${k}: C=${f(c, 0)}  D=${f(d, 0)}  tax = ${f(c - d, 0)} tokens${k === 1 ? '   <- should be ~0' : '   <- should be large'}`);
}
const errs = eps.flatMap((e) => e.s.beats.filter((b) => b.errors?.length).map((b) => `${e.id} ${b.beat} ${b.errors[0]}`));
console.log(`\nfailures: ${errs.length}`);
errs.slice(0, 4).forEach((x) => console.log('   ' + x));

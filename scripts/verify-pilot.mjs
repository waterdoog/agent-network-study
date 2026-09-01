#!/usr/bin/env node
// The three things a realistic-profile pilot has to show before it is worth
// scaling. If any of them fails, scaling just buys 72 episodes of the same
// mistake.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [pilot, baseline] = [process.argv[2] || 'realistic-pilot', process.argv[3] || 'axis2x2'];
const load = (run) => readdirSync(join('runs', run))
  .filter((d) => existsSync(join('runs', run, d, 'summary.json')))
  .map((d) => ({ ...JSON.parse(readFileSync(join('runs', run, d, 'summary.json'), 'utf8')), _dir: d, _run: run }));
const ev = (run, ep) => readFileSync(join('runs', run, ep, 'events.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const P = load(pilot);
const B = load(baseline).filter((r) => r.scenario === 'conference' && r.E === 0.3 && r.seed <= 2);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const t1 = (r) => r.beats.find((b) => b.beat === 'T1');
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : ' -- ');

console.log(`# pilot check — ${pilot} (n=${P.length}) vs ${baseline} matched cells (n=${B.length})\n`);

// ── 1. did the relational metadata reach the model at all? ────────────────
console.log('## 1. relational metadata in context');
let anyRel = 0, searches = 0, relLogged = false;
for (const r of P) for (const e of ev(pilot, r._dir)) {
  if (e.evt !== 'tool.search') continue;
  searches++;
  if (e.rel != null) { relLogged = true; if (e.rel > 0) anyRel++; }
}
if (!relLogged) {
  console.log('   the `rel` field is not in these logs (added after this pilot started).');
  console.log('   indirect check — prompt size for bounded arms, which is where the metadata lives:');
  for (const arm of ['C', 'D']) {
    const pt = mean(P.filter((r) => r.arm === arm).flatMap((r) => ev(pilot, r._dir).filter((e) => e.evt === 'llm' && String(e.tag).startsWith('req.')).map((e) => e.ti)));
    const bt = mean(B.filter((r) => r.arm === arm).flatMap((r) => ev(baseline, r._dir).filter((e) => e.evt === 'llm' && String(e.tag).startsWith('req.')).map((e) => e.ti)));
    console.log(`   arm ${arm}: requester prompt tokens  bare=${f2(bt)}  realistic=${f2(pt)}  delta=${f2(pt - bt)}`);
  }
} else {
  console.log(`   searches returning >=1 card with relational metadata: ${anyRel}/${searches}`);
}

// ── 2. is the vetted roster actually cleaner, in behaviour ────────────────
console.log('\n## 2. vetted roster — pollution seen and absorbed');
console.log('| arm | run | pollution seen | absorbed |');
console.log('|---|---|---|---|');
for (const arm of ['A', 'B', 'C', 'D']) {
  for (const [tag, rows, run] of [['bare', B, baseline], ['realistic', P, pilot]]) {
    const rs = rows.filter((r) => r.arm === arm).map(t1).filter(Boolean);
    if (!rs.length) continue;
    console.log(`| ${arm} | ${tag} | ${f2(mean(rs.map((b) => b.pollutionSeen)))} | ${f2(mean(rs.map((b) => b.pollutionAbsorbed)))} |`);
  }
}
console.log('\n   bounded arms (C,D) should now see LESS pollution than open arms (A,B):');
console.log('   that is what "the roster was vetted" means operationally.');

// ── 3. did behaviour change at all? ───────────────────────────────────────
console.log('\n## 3. behaviour change in the bounded arms');
console.log('| arm | metric | bare | realistic | delta |');
console.log('|---|---|---|---|---|');
for (const arm of ['C', 'D']) {
  for (const [name, get] of [['contacts', (b) => b.contacted], ['asks', (b) => b.asks],
    ['search precision', (b) => b.searchPrecision], ['f1', (b) => b.f1], ['tokens/1k', (b) => b.tokens / 1000]]) {
    const bv = mean(B.filter((r) => r.arm === arm).map(t1).filter(Boolean).map(get));
    const pv = mean(P.filter((r) => r.arm === arm).map(t1).filter(Boolean).map(get));
    console.log(`| ${arm} | ${name} | ${f2(bv)} | ${f2(pv)} | ${f2(pv - bv)} |`);
  }
}
console.log('\n   If every delta is ~0, that is the first evidence for the paper\'s main');
console.log('   hypothesis: relational text is inert. It is a result, not a failed pilot —');
console.log('   but only if check 1 shows the text was actually in context.');

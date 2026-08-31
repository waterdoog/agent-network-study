#!/usr/bin/env node
// Reads runs/<id>/all.json and prints the tables the paper needs. No plotting
// here on purpose: the numbers should be readable in a terminal at 3am.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const runId = process.argv[2] || readdirSync('runs').sort().pop();
const ROOT = join('runs', runId);
const rows = JSON.parse(readFileSync(join(ROOT, 'all.json'), 'utf8'));
const usage = existsSync(join(ROOT, 'usage.json')) ? JSON.parse(readFileSync(join(ROOT, 'usage.json'), 'utf8')) : {};

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const f2 = (x) => (x == null || Number.isNaN(x) ? '  --' : x.toFixed(2));
const f0 = (x) => (x == null || Number.isNaN(x) ? ' --' : Math.round(x).toString());

const ARMS = [...new Set(rows.map((r) => r.arm))];
const BEATS = ['T1', 'T2', 'T3', 'T4'];
const out = [];
const say = (s = '') => { out.push(s); console.log(s); };

say(`# agent-network-study — ${runId}`);
say(`model=${usage.model || '?'}  episodes=${rows.length}  calls=${usage.calls || '?'}  cost=$${(usage.costUSD || 0).toFixed(3)}  elapsed=${Math.round((usage.elapsedSec || 0) / 60)}min`);
say();

const beatsOf = (r) => Object.fromEntries(r.beats.map((b) => [b.beat, b]));

say('## Requirement F1 by arm and beat');
say('| arm | T1 cold | T2 rework | T3 warm | T4 warm-rework |');
say('|---|---|---|---|---|');
for (const a of ARMS) {
  const rs = rows.filter((r) => r.arm === a).map(beatsOf);
  say(`| ${a} | ${BEATS.map((b) => f2(mean(rs.map((x) => x[b]?.f1).filter((v) => v != null)))).join(' | ')} |`);
}
say();

say('## Cost in tokens by arm and beat');
say('| arm | T1 | T2 | T3 | T4 | warm speedup | rework decay |');
say('|---|---|---|---|---|---|---|');
for (const a of ARMS) {
  const rs = rows.filter((r) => r.arm === a);
  const bs = rs.map(beatsOf);
  const toks = BEATS.map((b) => f0(mean(bs.map((x) => x[b]?.tokens).filter((v) => v != null))));
  const ws = mean(rs.map((r) => r.warmSpeedup).filter((v) => v != null));
  const rd = mean(rs.map((r) => r.reworkDecay).filter((v) => v != null));
  say(`| ${a} | ${toks.join(' | ')} | ${f2(ws)} | ${f2(rd)} |`);
}
say();

say('## Regression: untouched assertions that broke during rework (lower is better)');
say('| arm | T2 | T4 |');
say('|---|---|---|');
for (const a of ARMS) {
  const bs = rows.filter((r) => r.arm === a).map(beatsOf);
  say(`| ${a} | ${f2(mean(bs.map((x) => x.T2?.regression).filter((v) => v != null)))} | ${f2(mean(bs.map((x) => x.T4?.regression).filter((v) => v != null)))} |`);
}
say();

say('## Search and pollution (all beats pooled)');
say('| arm | contacted | useful | search precision | pollution seen | absorbed |');
say('|---|---|---|---|---|---|');
for (const a of ARMS) {
  const bs = rows.filter((r) => r.arm === a).flatMap((r) => r.beats);
  say(`| ${a} | ${f2(mean(bs.map((b) => b.contacted)))} | ${f2(mean(bs.map((b) => b.useful)))} | ${f2(mean(bs.map((b) => b.searchPrecision)))} | ${f2(mean(bs.map((b) => b.pollutionSeen)))} | ${f2(mean(bs.map((b) => b.pollutionAbsorbed)))} |`);
}
say();

say('## By external fraction E (T1 cold F1)');
const ES = [...new Set(rows.map((r) => r.E))].sort();
say(`| arm | ${ES.map((e) => `E=${e}`).join(' | ')} |`);
say(`|---|${ES.map(() => '---').join('|')}|`);
for (const a of ARMS) {
  say(`| ${a} | ${ES.map((e) => f2(mean(rows.filter((r) => r.arm === a && r.E === e).map((r) => beatsOf(r).T1?.f1).filter((v) => v != null)))).join(' | ')} |`);
}
say();

say('## Kernel decisions (SharedOS)');
say('| arm | grants minted | allowed | denied | reasons | max delegation depth |');
say('|---|---|---|---|---|---|');
for (const a of ARMS) {
  const g = rows.filter((r) => r.arm === a).map((r) => r.grants);
  const reasons = {};
  for (const x of g) for (const [k, v] of Object.entries(x.reasons || {})) reasons[k] = (reasons[k] || 0) + v;
  say(`| ${a} | ${f0(mean(g.map((x) => x.minted)))} | ${f0(mean(g.map((x) => x.allowed)))} | ${f0(mean(g.map((x) => x.denied)))} | ${Object.entries(reasons).map(([k, v]) => `${k}:${v}`).join(' ') || '-'} | ${f0(mean(g.map((x) => x.maxDepthSeen)))} |`);
}
say();

say('## Health');
const allBeats = rows.flatMap((r) => r.beats);
say(`- beats: ${allBeats.length}, artifacts parsed: ${allBeats.filter((b) => b.parsed).length}, calculator present: ${allBeats.filter((b) => b.fnPresent).length}`);
say(`- beats with no artifact: ${allBeats.filter((b) => !b.artifactLen).length}`);
const topFail = {};
for (const b of allBeats) for (const f of b.failures || []) topFail[f] = (topFail[f] || 0) + 1;
say(`- most-failed assertions: ${Object.entries(topFail).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}(${v})`).join(' ')}`);

writeFileSync(join(ROOT, 'RESULTS.md'), out.join('\n') + '\n');
console.log(`\nwritten: ${join(ROOT, 'RESULTS.md')}`);

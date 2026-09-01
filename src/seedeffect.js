#!/usr/bin/env node
// The textual axis.
//
// arms.js manipulates structure the kernel enforces. This reads the other half:
// relational properties asserted as context — prior trust, attribution, and how
// the tie itself is narrated — with the architectural configuration held fixed.
//
// The contrast that matters most is `origin` against `stranger`. Those two
// differ in one sentence of narration and in nothing else: same directory, same
// grants, same knowledge, same store. If the primary metrics move across that
// pair, relational framing does real work on behaviour. If they do not, the
// richer relational metadata deployed systems put on cards is unlikely to do
// better, because it is the same channel carrying more words.
//
// Every contrast is reported against ARCH_REF, the discovery effect measured on
// the 2x2. A textual effect is only interesting relative to the structural one.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const runId = process.argv[2] || readdirSync('runs').sort().pop();
const ROOT = join('runs', runId);

// all.json is written when the sweep finishes. Reading the per-episode
// summaries instead means this runs against a sweep still in flight, which is
// the only way to find a bug in the analysis before spending the whole run.
const rows = existsSync(join(ROOT, 'all.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'all.json'), 'utf8'))
  : readdirSync(ROOT)
      .filter((d) => existsSync(join(ROOT, d, 'summary.json')))
      .map((d) => JSON.parse(readFileSync(join(ROOT, d, 'summary.json'), 'utf8')));
if (!rows.length) { console.error(`no episodes yet in ${ROOT}`); process.exit(1); }

// Discovery effect on requirement F1 (T1), from runs/axis2x2/factorial.md.
const ARCH_REF = { label: 'd_discovery (2x2, T1 F1)', value: 0.232 };

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f3 = (x) => (Number.isFinite(x) ? (x >= 0 ? ' ' : '') + x.toFixed(3) : '   -- ');
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

// `prop` marks a metric on the same 0-1 scale as ARCH_REF. Dividing a count of
// agents by an F1 difference produces a number, and that number means nothing;
// the ratio is printed only where the units agree.
const METRICS = [
  ['requirement F1 (T1)',       (r) => beatsOf(r).T1?.f1, 'prop'],
  ['requirement F1 (T3 warm)',  (r) => beatsOf(r).T3?.f1, 'prop'],
  ['assertions passed (T1)',    (r) => { const b = beatsOf(r).T1; return b && b.total ? b.pass / b.total : undefined; }, 'prop'],
  ['pollution absorbed (T1)',   (r) => beatsOf(r).T1?.pollutionAbsorbed, 'count'],
  ['agents contacted (T1)',     (r) => beatsOf(r).T1?.contacted, 'count'],
  ['asks (T1)',                 (r) => beatsOf(r).T1?.asks, 'count'],
  // Verification proxy: consultations spent per counterpart that actually held
  // something. If an assertion of prior trust enters the stopping rule at all,
  // this is where it shows up.
  ['asks per useful contact (T1)', (r) => { const b = beatsOf(r).T1; return b && b.useful ? b.asks / b.useful : undefined; }, 'count'],
];

// (label, seeded, baseline)
const CONTRASTS = [
  ['origin - stranger  [narration only]', 'origin', 'stranger'],
  ['trust - control',                      'trust', 'control'],
  ['accountability - control',             'accountability', 'control'],
  ['origin - control    [positive framing]', 'origin', 'control'],
  ['stranger - control  [negative framing]', 'stranger', 'control'],
  // The dilution check. If any added text costs the same as a relational
  // assertion costs, the assertion is not what is being measured.
  ['placebo - control   [added text only]', 'placebo', 'control'],
  ['stranger - placebo  [relational, net of text]', 'stranger', 'placebo'],
  ['origin - placebo    [relational, net of text]', 'origin', 'placebo'],
];

const lines = [];
const say = (s = '') => { lines.push(s); console.log(s); };

const profiles = [...new Set(rows.map((r) => r.seedProfile))].sort();
const arms = [...new Set(rows.map((r) => r.arm))].sort();

say(`# textual axis — ${runId}`);
say(`episodes=${rows.length}  arms=${arms.join('/')}  profiles=${profiles.join('/')}`);
say(`architectural reference: ${ARCH_REF.label} = ${ARCH_REF.value}`);
say();

const biggest = [];

const strata = [...new Set(rows.map((r) => `${r.arm}|${r.scenario}`))].sort();

for (const [label, get, scale] of METRICS) {
  const vals = (prof, arm) => rows
    .filter((r) => r.seedProfile === prof && (arm ? r.arm === arm : true))
    .map(get).filter((v) => v != null && Number.isFinite(v));
  const inStratum = (prof, st) => rows
    .filter((r) => r.seedProfile === prof && `${r.arm}|${r.scenario}` === st)
    .map(get).filter((v) => v != null && Number.isFinite(v));

  say(`## ${label}`);
  say('```');
  say('  profile          ' + arms.map((a) => a.padStart(8)).join('') + '     pooled   n');
  for (const p of profiles) {
    const pooled = vals(p);
    say(`  ${p.padEnd(16)}` + arms.map((a) => f3(mean(vals(p, a))).padStart(8)).join('')
        + `  ${f3(mean(pooled))}  ${String(pooled.length).padStart(3)}`);
  }
  say('```');

  for (const [clabel, hi, lo] of CONTRASTS) {
    const paired = strata
      .map((st) => ({ st, H: inStratum(hi, st), L: inStratum(lo, st) }))
      .filter((x) => x.H.length && x.L.length);
    if (!paired.length) { say(`  ${clabel.padEnd(40)}  (no stratum has both sides yet)`); continue; }
    const d = mean(paired.map((x) => mean(x.H) - mean(x.L)));
    const cells = {};
    for (const [i, x] of paired.entries()) { cells[`H${i}`] = x.H; cells[`L${i}`] = x.L; }
    const [c1, c2] = boot(cells, (dr) => mean(paired.map((_, i) => dr[`H${i}`] - dr[`L${i}`])));
    const spans = c1 <= 0 && c2 >= 0;
    const ratio = scale === 'prop' ? `  |d|/arch=${(Math.abs(d) / ARCH_REF.value).toFixed(2)}` : '';
    say(`  ${clabel.padEnd(40)} d=${f3(d)}  95% CI [${f3(c1)},${f3(c2)}]  ${spans ? 'spans 0 ' : 'excludes 0'}${ratio}  {${paired.map((x) => x.st).join(' ')}}`);
    if (label.startsWith('requirement F1 (T1)')) biggest.push({ clabel, d: Math.abs(d), spans });
  }
  say();
}

// ---------------------------------------------------------------------------
// The interaction. A main effect of relational text answers "does changing the
// prompt change the output", which is not in doubt and not worth an experiment.
// The question with an answer nobody can guess is whether a relational claim
// works when the structure does not back it.
//
//   arm A: open directory, per-contact namespace, counterpart has no memory.
//          "a colleague of two years" is false by construction -- an UNBACKED claim.
//   arm C: bounded roster, persistent namespace, counterpart remembers.
//          the same sentence is BACKED.
//
//   interaction = (origin - stranger | C) - (origin - stranger | A)
//
//   ~0    relational text works whether or not anything backs it. An open
//         network cannot resist an asserted relationship: claiming a tie buys
//         the cooperation of holding one.
//   large relational text only works where structure already backs it, and the
//         claim on its own is inert.
say('## backed against unbacked relational claims');
say();
say('  A = open, ephemeral, no counterpart memory   -> "colleague of two years" is unbacked');
say('  C = bounded, persistent, counterpart remembers -> the same claim is backed');
say();
for (const [label, get, scale] of METRICS) {
  if (scale !== 'prop') continue;
  const cell = (prof, arm) => rows
    .filter((r) => r.seedProfile === prof && r.arm === arm)
    .map(get).filter((v) => v != null && Number.isFinite(v));
  const oA = cell('origin', 'A'), sA = cell('stranger', 'A');
  const oC = cell('origin', 'C'), sC = cell('stranger', 'C');
  if (!oA.length || !sA.length || !oC.length || !sC.length) {
    say(`  ${label.padEnd(28)} (incomplete: A ${oA.length}/${sA.length}, C ${oC.length}/${sC.length})`);
    continue;
  }
  const dA = mean(oA) - mean(sA);
  const dC = mean(oC) - mean(sC);
  const inter = dC - dA;
  const [i1, i2] = boot({ oA, sA, oC, sC }, (d) => (d.oC - d.sC) - (d.oA - d.sA));
  const spans = i1 <= 0 && i2 >= 0;
  say(`  ${label.padEnd(28)} unbacked(A)=${f3(dA)}  backed(C)=${f3(dC)}  interaction=${f3(inter)}  95% CI [${f3(i1)},${f3(i2)}]  ${spans ? 'spans 0' : 'excludes 0'}`);
}
say();
say('  An interaction indistinguishable from zero, with a non-zero effect in A, is');
say('  the result worth reporting: an asserted tie buys what holding one buys, and');
say('  an open network has nothing with which to refuse it.');
say();

say('## headline');
const anySig = biggest.filter((b) => !b.spans);
const maxAbs = biggest.length ? Math.max(...biggest.map((b) => b.d)) : NaN;
say(`  largest |textual effect| on T1 F1: ${f3(maxAbs)}   (architectural reference ${ARCH_REF.value})`);
say(`  ratio: ${(maxAbs / ARCH_REF.value).toFixed(2)}`);
say(`  contrasts whose CI excludes 0: ${anySig.length ? anySig.map((b) => b.clabel.split('  ')[0]).join(', ') : 'none'}`);
say();
const perCell = Math.min(...profiles.flatMap((p) => arms.map((a) =>
  rows.filter((r) => r.seedProfile === p && r.arm === a).length)).filter((n) => n > 0));
say(`  Smallest cell holds ${perCell} episodes. A percentile bootstrap over ${perCell} values`);
say(`  resamples ${perCell} numbers; treat "excludes 0" as meaningless below about n=10`);
say('  per cell and read the cell means instead.');
say();
say('  Read with care: a null here bounds the weakest form of relational encoding —');
say('  an assertion in context. It does not bound trust wired into routing, memory,');
say('  retrieval, or permission policy, which is where deployed reputation lives.');

writeFileSync(join(ROOT, 'seedeffect.md'), lines.join('\n') + '\n');
console.log(`\nwrote ${join(ROOT, 'seedeffect.md')}`);

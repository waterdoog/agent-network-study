#!/usr/bin/env node
// Knobs analysis. The old task family (conference, lab-dashboard, trip-planner:
// 14 hidden-profile facts, planted distractors, a scored HTML page) is re-run
// with every holder reachable (E = 0) and two knobs added to the instance:
//
//   d  dispersion    how many holders the same 14 facts are spread across
//                    (1 = two merged holders, 2 = the original allocation,
//                     3 = every holder split so none carries more than two facts)
//   i  interference  how many planted distractors (0, the original 4, or 8)
//
//   A open+sandbox   B open+store
//   C bounded+sandbox D bounded+store
//
//   D-A                          the canonical private-minus-public difference
//   S(d,i) = 1/2 [ (B-A) + (D-C) ]  store effect
//   F(d,i) = 1/2 [ (A-C) + (B-D) ]  formation effect
//
// The primary question is whether D-A and S grow with dispersion and
// interference: the two slopes are (d=3,i=8) minus (d=2,i=4), the hardest
// cell minus the original allocation.
//
// The unit of pairing is a block: one (base, seed), whose four arms share one
// directory and one instance. Every contrast is computed per block first and
// then averaged, and the bootstrap resamples blocks, never episodes. A block
// enters a contrast only when all four arms delivered a parseable artifact,
// so no lost beat is ever averaged in as F1 = 0.
//
// Reads runs/<run>/*/summary.json, never all.json: all.json is rewritten by
// every driver invocation and a resumed or partial sweep can leave it stale.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { deliveryReport, formatDelivery } from './lib/delivery.js';

const runId = process.argv[2];
if (!runId) { console.error('usage: node src/knobs.js <runId>'); process.exit(1); }
const ROOT = join('runs', runId);
if (!existsSync(ROOT)) { console.error(`no such run: ${ROOT}`); process.exit(1); }

const ARMS = ['A', 'B', 'C', 'D'];
const DS = [1, 2, 3];
const IS = [0, 4, 8];
const BASES = ['conf', 'lab', 'trip'];
const BASE_NAME = { conf: 'conference', lab: 'lab-dashboard', trip: 'trip-planner' };
// The original allocation and the hardest cell: the two ends of the primary slopes.
const ORIGINAL = { d: 2, i: 4 };
const HARDEST = { d: 3, i: 8 };
const N_BOOT = 4000;
// Below this many blocks a percentile bootstrap of the mean has too few
// distinct resamples to be an interval of anything; the estimate is printed
// alone.
const MIN_N_CI = 5;

// The protocol fixes every other knob of the harness (docs/KNOBS.md, "What is
// held fixed"). A row from a different setting is not part of the design and
// must not enter a paired block, however it got into the run directory.
const FIXED = { E: 0, k: 1, seedProfile: 'control', edgeCost: 0, relayDepth: 0, dirSize: 100, reputation: 'off', searchCap: 40 };

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f2 = (x) => (Number.isFinite(x) ? (x >= 0 ? ' ' : '') + x.toFixed(3) : '   -- ');
const f1d = (x) => (Number.isFinite(x) ? x.toFixed(1) : '--');
const pct = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : '--');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ── load ────────────────────────────────────────────────────────────────
const SCENARIO_RE = /^(conf|lab|trip)-D(\d)-I(\d)$/;
const cellOf = (scenario) => {
  const m = SCENARIO_RE.exec(String(scenario));
  return { base: m ? m[1] : null, d: m ? Number(m[2]) : NaN, i: m ? Number(m[3]) : NaN };
};

const dirs = readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const crashedDirs = dirs.filter((d) => existsSync(join(ROOT, d, 'CRASHED')));
const allRows = dirs
  .filter((d) => existsSync(join(ROOT, d, 'summary.json')))
  .map((d) => ({ ...readJson(join(ROOT, d, 'summary.json')), dir: d }))
  .filter((r) => SCENARIO_RE.test(String(r.scenario)));
for (const r of allRows) Object.assign(r, cellOf(r.scenario));

// Rows outside the fixed settings are dropped and counted, never silently
// merged. A row missing one of the fields is treated as outside: the driver
// has written every one of them for as long as generated scenarios exist.
const offProtocol = (r) => Object.entries(FIXED).filter(([key, want]) => r[key] !== want).map(([key]) => `${key}=${r[key]}`);
const excluded = allRows.map((r) => ({ r, why: offProtocol(r) })).filter((x) => x.why.length);
const rows = allRows.filter((r) => !offProtocol(r).length);

// run.js keys episodes on (arm, scenario, seed); a second row with the same
// key means two directories claim one cell of the design and the pairing
// below would silently pick one of them.
{
  const seen = new Map();
  for (const r of rows) {
    const key = `${r.arm}|${r.scenario}|${r.seed}`;
    if (seen.has(key)) throw new Error(`knobs: duplicate episode for ${key}: ${seen.get(key)} and ${r.dir}`);
    seen.set(key, r.dir);
  }
}

// Planned episodes, when the driver left a manifest. Both a bare array and an
// object wrapping one are accepted; an entry needs an id and its cell fields.
const manifestPath = join(ROOT, 'manifest.json');
let planned = null;
if (existsSync(manifestPath)) {
  const m = readJson(manifestPath);
  const list = Array.isArray(m) ? m : (m.episodes || m.planned || m.entries || []);
  planned = list
    .map((e) => ({ ...e, arm: e.arm ?? e.armId, scenario: e.scenario ?? e.scenarioId }))
    .filter((e) => SCENARIO_RE.test(String(e.scenario)))
    .map((e) => ({ ...e, ...cellOf(e.scenario) }))
    // A manifest entry may omit a fixed field; only a stated, different value excludes it.
    .filter((e) => Object.keys(FIXED).every((k) => !(k in e) || e[k] === FIXED[k]));
}

const say = (s = '') => { lines.push(s); console.log(s); };
const lines = [];

say(`# knobs — ${runId}`);
say(`episodes=${rows.length} (summary.json present, on protocol); excluded (off-protocol settings)=${excluded.length}; CRASHED directories=${crashedDirs.length}${planned ? `; planned (manifest)=${planned.length}` : '; no manifest.json'}`);
if (excluded.length) {
  const byWhy = new Map();
  for (const x of excluded) { const k = x.why.join(','); byWhy.set(k, (byWhy.get(k) || 0) + 1); }
  say(`excluded rows by setting: ${[...byWhy].map(([k, n]) => `${k} ×${n}`).join('; ')}`);
}
if (crashedDirs.length) say(`CRASHED: ${crashedDirs.slice(0, 20).join(', ')}${crashedDirs.length > 20 ? ', …' : ''}`);
say();
if (!rows.length) {
  say('no <conf|lab|trip>-D<d>-I<i> episodes found (incomplete)');
  writeFileSync(join(ROOT, 'knobs.md'), lines.join('\n'));
  process.exit(0);
}

// ── events per T1 beat ──────────────────────────────────────────────────
// The beat record carries every count this analysis uses except tokens by
// role and the crash flag; those come from events.jsonl. Events are
// attributed to a beat by their own `beat` field when they have one (tool
// events) and otherwise by the enclosing beat.start/beat.done pair (llm
// events carry only a tag).
const ROLE_OF_TAG = { req: 'requester', ask: 'responder', build: 'builder', consult: 'consult' };
function readEvents(dir) {
  const p = join(ROOT, dir, 'events.jsonl');
  if (!existsSync(p)) return null;
  const out = [];
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* a torn last line from a killed run */ }
  }
  return out;
}
function beatEvents(events, beat) {
  let cur = null;
  const out = [];
  for (const e of events) {
    if (e.evt === 'beat.start') cur = e.beat;
    const b = e.beat ?? cur;
    if (b === beat) out.push(e);
    if (e.evt === 'beat.done') cur = null;
  }
  return out;
}
function fromEvents(events) {
  if (!events) return null;
  const byRole = { requester: 0, responder: 0, builder: 0, consult: 0, other: 0 };
  let crash = false, technical = false;
  for (const e of beatEvents(events, 'T1')) {
    if (e.evt === 'llm') byRole[ROLE_OF_TAG[String(e.tag || '').split('.')[0]] || 'other'] += (e.ti || 0) + (e.to || 0);
    else if (e.evt === 'beat.crash') { crash = true; technical = true; }
    else if (e.evt === 'llm.fail' || e.evt === 'req.llm' || e.evt === 'contact.llm') technical = true;
  }
  return { byRole, crash, technical };
}

// ── per-episode metrics (T1 beat) ───────────────────────────────────────
let inferredKind = 0;
let noEvents = 0;

/**
 * Why a beat has no artifact. The harness records `failureKind`; older beat
 * records carry only the scorer's first error, which separates the same two
 * cases (no-artifact / parse: the model; scorer: the harness).
 */
function failureKind(t1, delivered, ev) {
  if (t1.failureKind === 'none' || t1.failureKind === 'model' || t1.failureKind === 'technical') return t1.failureKind;
  if (delivered) return 'none';
  inferredKind++;
  const e = String((t1.errors || [])[0] || '');
  if (e === 'no-artifact' || e.startsWith('parse')) return ev?.technical ? 'technical' : 'model';
  if (e.startsWith('scorer')) return 'technical';
  return ev?.technical ? 'technical' : 'model';
}

function measure(r) {
  const t1 = (r.beats || []).find((b) => b.beat === 'T1');
  if (!t1) return { present: false };
  const ev = fromEvents(readEvents(r.dir));
  if (!ev) noEvents++;
  const delivered = Boolean(t1.parsed) && (t1.artifactLen || 0) > 0;
  const kind = failureKind(t1, delivered, ev);
  // Tokens are missing when the stats were lost in a crash: the cost was
  // spent but is unknown, and an unknown must not enter a mean as 0.
  const tokensLost = Boolean(t1.tokensUnknown) || Boolean(ev?.crash);
  return {
    present: true, delivered, kind,
    // Quality is conditioned on delivery: an undelivered beat is a missing
    // score, not a zero. The delivery section says how many there were.
    f1: delivered ? t1.f1 : undefined,
    pass: delivered ? t1.pass : undefined,
    total: delivered ? t1.total : undefined,
    tokens: tokensLost || t1.tokens == null ? undefined : t1.tokens / 1000,
    tokRequester: tokensLost || !ev ? undefined : ev.byRole.requester / 1000,
    tokResponder: tokensLost || !ev ? undefined : ev.byRole.responder / 1000,
    tokBuilder: tokensLost || !ev ? undefined : ev.byRole.builder / 1000,
    tokConsult: tokensLost || !ev ? undefined : ev.byRole.consult / 1000,
    asks: t1.asks || 0, lists: t1.lists || 0, reads: t1.reads || 0,
    contacted: t1.contacted ?? undefined,
    pollutionSeen: t1.pollutionSeen ?? undefined,
    pollutionAbsorbed: t1.pollutionAbsorbed ?? undefined,
    wrongInvented: t1.wrongInvented ?? undefined,
    storeUse: (t1.reads || 0) > 0 ? 1 : 0,
  };
}
for (const r of rows) r.m = measure(r);

const cellRows = (arm, d, i, base = null) => rows.filter((r) => r.arm === arm && r.d === d && r.i === i && (base == null || r.base === base) && r.m.present);
const vals = (rs, k) => rs.map((r) => r.m[k]).filter((v) => v != null && Number.isFinite(v));
const cellLabel = (d, i) => `d=${d} i=${i}${d === ORIGINAL.d && i === ORIGINAL.i ? ' (original)' : d === HARDEST.d && i === HARDEST.i ? ' (hardest)' : ''}`;

// ── 1. delivery ─────────────────────────────────────────────────────────
// The delivery module counts every beat in a row; this analysis is about T1
// only, so the rows are narrowed before the report.
const rowsT1 = rows.map((r) => ({ ...r, beats: (r.beats || []).filter((b) => b.beat === 'T1') }));
{
  const rep = formatDelivery(deliveryReport(rowsT1, ['arm', 'd', 'i'])).split('\n');
  say(rep[0]);
  say();
  say('> This analysis excludes lost beats from every mean and every paired contrast (it does not');
  say('> count them as 0): a block enters a contrast only when all four of its arms delivered.');
  for (const l of rep.slice(1)) say(l);
}

say('### Planned, summarised, delivered, and failure kinds per cell (T1)');
say();
say(`Planned comes from manifest.json${planned ? '' : ' (absent: planned is shown as --)'}; summarised is a summary.json on`);
say('protocol; delivered is a parsed artifact. model = the requester ended without a submission or the');
say('artifact did not parse; technical = an LLM call failed, the beat crashed, or the scorer threw.');
if (crashedDirs.length) say(`CRASHED directories (${crashedDirs.length}) have no summary and are neither summarised nor delivered.`);
say();
say('| d | i | arm | planned | summarised | delivered | model | technical | crashed |');
say('|---|---|---|---|---|---|---|---|---|');
for (const d of DS) for (const i of IS) for (const arm of ARMS) {
  const rs = cellRows(arm, d, i);
  const pl = planned ? planned.filter((e) => e.arm === arm && e.d === d && e.i === i) : null;
  if (!rs.length && !(pl && pl.length)) continue;
  const crashed = pl ? pl.filter((e) => crashedDirs.includes(e.id)).length : NaN;
  say(`| ${d} | ${i} | ${arm} | ${pl ? pl.length : '--'} | ${rs.length} | ${rs.filter((r) => r.m.delivered).length} | ${rs.filter((r) => r.m.kind === 'model').length} | ${rs.filter((r) => r.m.kind === 'technical').length} | ${Number.isFinite(crashed) ? crashed : '--'} |`);
}
say();
if (inferredKind) {
  say(`> **NOTE.** ${inferredKind} beat(s) carry no \`failureKind\`; the model/technical classification was inferred`);
  say('> from the first scorer error (no-artifact, parse: → model; scorer: → technical) and the beat\'s events.');
  say();
}
if (noEvents) {
  say(`> **NOTE.** ${noEvents} episode(s) have no events.jsonl; tokens by role and crash detection are missing for them.`);
  say();
}

// ── 2. per-cell means ───────────────────────────────────────────────────
say('## Per-cell means (T1)');
say();
say('F1 = requirement F1 from the scorer, the score of the old study; pass/total = assertions passed');
say('over assertions scored (16-20 per base). Both over delivered beats. asks/lists/reads = tool calls;');
say('contacted = distinct cards the requester asked or read (the beat record\'s counter); store use =');
say('share of episodes with at least one read_store call. Tokens are whole-system, in thousands,');
say('missing when lost in a crash.');
say();
function meansRow(prefix, rs) {
  const d = mean(rs.map((r) => (r.m.delivered ? 1 : 0)));
  say(`| ${prefix} | ${rs.length} | ${pct(d)} | ${f2(mean(vals(rs, 'f1')))} | ${f1d(mean(vals(rs, 'pass')))}/${f1d(mean(vals(rs, 'total')))} | ${f1d(mean(vals(rs, 'tokens')))} | ${f1d(mean(vals(rs, 'asks')))} | ${f1d(mean(vals(rs, 'lists')))} | ${f1d(mean(vals(rs, 'reads')))} | ${f1d(mean(vals(rs, 'contacted')))} | ${pct(mean(vals(rs, 'storeUse')))} |`);
}
say('### Pooled over bases');
say();
say('| d | i | arm | n | delivered | F1 | pass/total | tokens (k) | asks | lists | reads | contacted | store use |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const d of DS) for (const i of IS) for (const arm of ARMS) {
  const rs = cellRows(arm, d, i);
  if (rs.length) meansRow(`${d} | ${i} | ${arm}`, rs);
}
say();
say('### Per base');
say();
say('| base | d | i | arm | n | delivered | F1 | pass/total | tokens (k) | asks | lists | reads | contacted | store use |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const base of BASES) for (const d of DS) for (const i of IS) for (const arm of ARMS) {
  const rs = cellRows(arm, d, i, base);
  if (rs.length) meansRow(`${base} | ${d} | ${i} | ${arm}`, rs);
}
say();

// ── paired blocks and bootstrap ─────────────────────────────────────────
/**
 * One block per (base, seed): { A, B, C, D } values of metric `k` in cell
 * (d, i). A block enters only when all four arms delivered and carry a finite
 * value, so every contrast below is a within-block difference and the
 * bootstrap keeps the four arms of a block together.
 */
function blocks(d, i, k) {
  const byKey = new Map();
  for (const r of rows) {
    if (r.d !== d || r.i !== i || !r.m.present || !r.m.delivered) continue;
    const v = r.m[k];
    if (v == null || !Number.isFinite(v)) continue;
    const key = `${r.base}|${r.seed}`;
    const b = byKey.get(key) || {};
    b[r.arm] = v; // a repeated (arm, scenario, seed) cannot happen: checked at load
    byKey.set(key, b);
  }
  const out = new Map();
  for (const [key, b] of byKey) if (ARMS.every((a) => b[a] != null)) out.set(key, b);
  return out;
}

/**
 * mulberry32: a 32-bit generator whose arithmetic stays inside Math.imul, so
 * it never leaves the exact-integer range of a double (the LCG the older
 * analyzers used lost low bits past 2^53 and collapsed into a short cycle).
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Percentile bootstrap of the mean over blocks (resample the per-block values). */
function bootMean(values, n = N_BOOT, seed = 7) {
  if (!values.length) return [NaN, NaN];
  const rnd = mulberry32(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let j = 0; j < values.length; j++) acc += values[Math.floor(rnd() * values.length)];
    out.push(acc / values.length);
  }
  out.sort((a, b) => a - b);
  return [out[Math.floor(out.length * 0.025)], out[Math.floor(out.length * 0.975)]];
}

const CONTRASTS = {
  'D-A': (b) => b.D - b.A,
  S: (b) => ((b.B - b.A) + (b.D - b.C)) / 2,
  F: (b) => ((b.A - b.C) + (b.B - b.D)) / 2,
  'B-A': (b) => b.B - b.A,
  'D-C': (b) => b.D - b.C,
  '(B-A)-(D-C)': (b) => (b.B - b.A) - (b.D - b.C),
};

/** Estimate + CI of a per-block statistic averaged over blocks. */
function est(perBlockMap) {
  const v = [...perBlockMap.values()];
  const [lo, hi] = v.length >= MIN_N_CI ? bootMean(v) : [NaN, NaN];
  return { est: mean(v), lo, hi, n: v.length };
}
const ci = (e, f = f2) => (e.n >= MIN_N_CI ? `[${f(e.lo)}, ${f(e.hi)}]` : 'n too small for an interval');
const line = (label, e, extra = '') => {
  if (!e.n) return `  ${label.padEnd(22)} incomplete (no complete blocks)${extra}`;
  if (e.n < MIN_N_CI) return `  ${label.padEnd(22)} = ${f2(e.est)}   n too small for an interval   n=${e.n}${extra}`;
  const excl = e.lo * e.hi > 0 ? 'excludes 0' : 'spans 0';
  return `  ${label.padEnd(22)} = ${f2(e.est)}   95% CI ${ci(e)}   ${excl}   n=${e.n}${extra}`;
};

/** Per-block map of contrast `fn` applied to blocks of metric `k` in cell (d, i). */
function perBlock(d, i, k, fn) {
  const out = new Map();
  for (const [key, b] of blocks(d, i, k)) out.set(key, fn(b));
  return out;
}
/** Blocks present in both maps, differenced. */
function diffBlocks(a, b) {
  const out = new Map();
  for (const [key, va] of a) if (b.has(key)) out.set(key, va - b.get(key));
  return out;
}
/** Entries of `a` whose block is in `keep`. */
function restrict(a, keep) {
  const out = new Map();
  for (const [key, v] of a) if (keep.has(key)) out.set(key, v);
  return out;
}
/** Blocks of a cell by base, for the n-per-base annotation. */
function blocksByBase(bl) {
  const n = Object.fromEntries(BASES.map((b) => [b, 0]));
  for (const key of bl.keys()) n[key.split('|')[0]]++;
  return BASES.map((b) => `${b}=${n[b]}`).join(' ');
}

// ── 3. contrasts per (d, i) on F1 ───────────────────────────────────────
say('## Contrasts per (d, i) — requirement F1, paired by block');
say();
say('D−A is the canonical private-minus-public difference (bounded+store minus open+sandbox), the');
say('number the old study reported. S = ½[(B−A)+(D−C)] is the store effect, F = ½[(A−C)+(B−D)] the');
say('formation effect. If B−A and D−C disagree, S averages over a real interaction; read the');
say('interaction line, not just S. A block is one (base, seed) with all four arms delivered.');
say();
for (const i of IS) for (const d of DS) {
  const bl = blocks(d, i, 'f1');
  say(`### ${cellLabel(d, i)}`);
  if (!bl.size) { say('  incomplete (no block has all four arms delivered)'); say(); continue; }
  const cm = Object.fromEntries(ARMS.map((a) => [a, mean([...bl.values()].map((b) => b[a]))]));
  say('```');
  say('                sandbox     store');
  say(`  open        ${f2(cm.A)}     ${f2(cm.B)}     A,B`);
  say(`  bounded     ${f2(cm.C)}     ${f2(cm.D)}     C,D`);
  say('```');
  for (const [label, fn] of Object.entries(CONTRASTS)) say(line(label, est(perBlock(d, i, 'f1', fn))));
  say(`  blocks by base: ${blocksByBase(bl)}`);
  say();
}

// ── 4. primary slopes ───────────────────────────────────────────────────
say('## Primary slopes');
say();
say(`Δ(D−A) = D−A at (d=${HARDEST.d}, i=${HARDEST.i}) minus D−A at (d=${ORIGINAL.d}, i=${ORIGINAL.i}): the hardest cell minus the original`);
say('allocation, computed per block (a block must have all four arms delivered in both cells) and then');
say('averaged. ΔS is the same for the store effect. A positive slope says the contrast grew as the facts');
say('were dispersed and the distractors doubled; it says nothing about the sign of the contrast itself,');
say('so both ends are printed on the same blocks.');
say();
for (const [label, fn] of [['D-A', CONTRASTS['D-A']], ['S', CONTRASTS.S]]) {
  const hard = perBlock(HARDEST.d, HARDEST.i, 'f1', fn);
  const orig = perBlock(ORIGINAL.d, ORIGINAL.i, 'f1', fn);
  const slope = diffBlocks(hard, orig);
  const keep = new Set(slope.keys());
  say(`### ${label}`);
  say(line(`Δ${label}`, est(slope), '   [blocks complete in both cells]'));
  say(line(`${label} (${HARDEST.d},${HARDEST.i}) | slope blocks`, est(restrict(hard, keep)), '   [same blocks as the slope]'));
  say(line(`${label} (${ORIGINAL.d},${ORIGINAL.i}) | slope blocks`, est(restrict(orig, keep)), '   [same blocks as the slope]'));
  say(line(`${label} (${HARDEST.d},${HARDEST.i}) all`, est(hard), `   [blocks complete at (${HARDEST.d},${HARDEST.i})]`));
  say(line(`${label} (${ORIGINAL.d},${ORIGINAL.i}) all`, est(orig), `   [blocks complete at (${ORIGINAL.d},${ORIGINAL.i})]`));
  say();
}

say('### One knob at a time');
say();
say(`D−A and S along dispersion at i=${ORIGINAL.i} and along interference at d=${ORIGINAL.d}. Each point is the`);
say('contrast over every block complete in that cell (n in parentheses); end − start is the last point');
say('minus the first, per block over the blocks complete at both ends, with its interval.');
say();
say('| contrast | axis | point 1 | point 2 | point 3 | end − start | 95% CI | n |');
say('|---|---|---|---|---|---|---|---|');
const AXES = [
  ['d at i=' + ORIGINAL.i, DS.map((d) => [d, ORIGINAL.i]), (d) => `d=${d}`],
  ['i at d=' + ORIGINAL.d, IS.map((i) => [ORIGINAL.d, i]), (_, i) => `i=${i}`],
];
for (const [label, fn] of [['D-A', CONTRASTS['D-A']], ['S', CONTRASTS.S]]) {
  for (const [axis, cells, name] of AXES) {
    const pts = cells.map(([d, i]) => ({ name: name(d, i), map: perBlock(d, i, 'f1', fn) }));
    const point = (p) => (p.map.size ? `${p.name}: ${f2(est(p.map).est)} (${p.map.size})` : `${p.name}: incomplete`);
    const slope = est(diffBlocks(pts[pts.length - 1].map, pts[0].map));
    say(`| ${label} | ${axis} | ${point(pts[0])} | ${point(pts[1])} | ${point(pts[2])} | ${slope.n ? f2(slope.est) : 'incomplete'} | ${slope.n ? ci(slope) : '--'} | ${slope.n} |`);
  }
}
say();

// ── 5. tokens ───────────────────────────────────────────────────────────
say('## Tokens (T1, k) and the token cost of store');
say();
say('Whole-system tokens for the beat, all roles summed, over the same delivered blocks as the F1');
say('contrasts (a beat whose stats were lost in a crash is missing, not 0). The per-role table below');
say('says where a difference sits: listing and reading a holder\'s store against asking it.');
say();
say('| d | i | A | B | C | D | B−A | 95% CI | D−C | 95% CI | n |');
say('|---|---|---|---|---|---|---|---|---|---|---|');
function tokenRow(d, i, k, prefix) {
  const bl = blocks(d, i, k);
  if (!bl.size) { say(`| ${prefix} | incomplete | | | | | | | | 0 |`); return; }
  const cm = Object.fromEntries(ARMS.map((a) => [a, mean([...bl.values()].map((b) => b[a]))]));
  const ba = est(perBlock(d, i, k, CONTRASTS['B-A']));
  const dc = est(perBlock(d, i, k, CONTRASTS['D-C']));
  say(`| ${prefix} | ${f1d(cm.A)} | ${f1d(cm.B)} | ${f1d(cm.C)} | ${f1d(cm.D)} | ${f1d(ba.est)} | ${ci(ba, f1d)} | ${f1d(dc.est)} | ${ci(dc, f1d)} | ${bl.size} |`);
}
for (const i of IS) for (const d of DS) {
  if (!rows.some((r) => r.d === d && r.i === i)) continue;
  tokenRow(d, i, 'tokens', `${d} | ${i}`);
}
say();

say('### Tokens by role (T1, k)');
say();
say('Summed from the llm events of the beat by tag: req.* = requester, ask.* = responder, build.* =');
say('builder, consult.* = builder consults (shown when non-zero). Same per-block contrasts as above.');
say();
say('| d | i | role | A | B | C | D | B−A | 95% CI | D−C | 95% CI | n |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|');
const ROLES = [['tokRequester', 'requester'], ['tokResponder', 'responder'], ['tokBuilder', 'builder'], ['tokConsult', 'consult']];
for (const i of IS) for (const d of DS) {
  if (!rows.some((r) => r.d === d && r.i === i)) continue;
  for (const [k, label] of ROLES) {
    if (k === 'tokConsult' && !rows.some((r) => r.d === d && r.i === i && r.m.tokConsult > 0)) continue;
    tokenRow(d, i, k, `${d} | ${i} | ${label}`);
  }
}
say();

// ── 6. pollution ────────────────────────────────────────────────────────
say('## Pollution (diagnostics, per cell)');
say();
say('seen = planted distractors the requester was exposed to; absorbed = of those, how many wrong values');
say('the page carries; invented = wrong values on the page that no distractor supplied. Over delivered');
say('beats. At i=0 there is nothing to see or absorb by construction.');
say();
say('> **Exposure accounting differs between the ask and read routes.** An ask_agent call (and a builder');
say('> consult) marks every distractor planted on that card as seen, whether or not the answer mentioned');
say('> it; a read_store call marks only the planted items actually returned (all of them on a full read,');
say('> one on an indexed read). A list_store call marks nothing. "seen" is therefore an upper bound in');
say('> the sandbox arms and an exact count in the store arms, and absorbed/seen is not comparable across');
say('> the store axis. Absorbed and invented are counted on the page and are comparable.');
say();
say('| d | i | arm | n | seen | absorbed | invented | absorbed/seen |');
say('|---|---|---|---|---|---|---|---|');
for (const d of DS) for (const i of IS) for (const arm of ARMS) {
  const rs = cellRows(arm, d, i).filter((r) => r.m.delivered);
  if (!rs.length) continue;
  const seen = vals(rs, 'pollutionSeen'), abs = vals(rs, 'pollutionAbsorbed');
  const sumSeen = seen.reduce((a, b) => a + b, 0);
  const ratio = sumSeen ? abs.reduce((a, b) => a + b, 0) / sumSeen : NaN;
  say(`| ${d} | ${i} | ${arm} | ${rs.length} | ${f2(mean(seen))} | ${f2(mean(abs))} | ${f2(mean(vals(rs, 'wrongInvented')))} | ${i === 0 ? 'n/a' : f2(ratio)} |`);
}
say();

// ── 7. footer ───────────────────────────────────────────────────────────
say('## Notes');
say();
const nCell = [];
for (const d of DS) for (const i of IS) for (const arm of ARMS) {
  const n = cellRows(arm, d, i).length;
  if (n) nCell.push(`D${d}I${i}${arm}=${n}`);
}
say(`- n per cell (summarised, on protocol, pooled over bases): ${nCell.join(', ') || 'none'}.`);
const nBase = BASES.map((b) => `${BASE_NAME[b]}=${rows.filter((r) => r.base === b).length}`).join(', ');
say(`- episodes per base: ${nBase}. Scenario ids are <base>-D<d>-I<i> with base in conf, lab, trip.`);
say(`- Rows are restricted to the protocol settings (${Object.entries(FIXED).map(([k, v]) => `${k}=${v}`).join(', ')});`);
say(`  ${excluded.length} row(s) were excluded for other settings, and ${crashedDirs.length} CRASHED director${crashedDirs.length === 1 ? 'y' : 'ies'} never wrote a summary.`);
say('- The metric is requirement F1 at T1 from the beat record (`f1`), the score the old study reported.');
say('  pass/total, asks, lists, reads, contacted, pollutionSeen, pollutionAbsorbed and wrongInvented are');
say('  read from the same record; tokens by role come from the llm events of the beat.');
say('- delivered = parsed && artifactLen > 0. Beats that produced no artifact are excluded from every');
say('  mean and from every paired contrast; a block (one base and seed) needs all four arms delivered to');
say('  enter. Nothing counts a lost beat as F1 = 0; the delivery table above is the place to look before');
say('  reading any contrast. (The delivery module\'s "counts a lost beat as F1 = 0" note describes the');
say('  older analyzers, not this one.) Token contrasts use the same delivered blocks, so an undelivered');
say('  beat\'s cost is in the per-cell token means only when its stats survived.');
say(`- All intervals are descriptive 95% percentile bootstraps over blocks, keeping the four arms of a`);
say(`  block together, printed only when n ≥ ${MIN_N_CI}. Blocks pool the three bases: a base contributes`);
say('  one block per seed. They are not corrected for multiple comparisons.');
say(`- failureKind was read from the beat record${inferredKind ? ` for all but ${inferredKind} beat(s), where it was inferred from the scorer error` : ''}.`);

writeFileSync(join(ROOT, 'knobs.md'), lines.join('\n'));
console.log(`\nwritten: ${join(ROOT, 'knobs.md')}`);

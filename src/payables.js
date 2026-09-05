#!/usr/bin/env node
// Payables analysis. The question the experiment asks is narrow: once every
// needed document is reachable (E=0), does the value of reading documents
// directly (store) relative to asking their keeper (sandbox) change with the
// cross-source integration burden L, and with version conflicts M?
//
//   A open+sandbox   B open+store
//   C bounded+sandbox D bounded+store
//
//   S(L,M) = 1/2 [ (B-A) + (D-C) ]     semantics (store) effect
//   F(L,M) = 1/2 [ (A-C) + (B-D) ]     formation effect
//   K      = S(L=4) - S(L=1) at M0     the pre-registered primary contrast
//
// Every contrast is computed PER SEED first (a seed is one base case whose
// four arms share the same order world), then averaged, and the bootstrap
// resamples seeds, never episodes. Resampling episodes within a cell would
// throw away the pairing that the shared world was built to provide.
//
// Two denominators are carried side by side, because they answer different
// questions and the proposal asks for both:
//   delivered-only  Q over beats that produced a parseable artifact
//   planned         a beat the model failed (no submission, unparseable
//                   artifact) counts as Q = 0; a beat lost to the harness
//                   (transport, scorer crash) stays missing
// A technical loss is not a score, so it is never averaged in as 0; instead
// the primary contrast is bracketed by setting every missing Q to 0 and to 1.
//
// Reads runs/<run>/*/summary.json, never all.json: all.json is rewritten by
// every driver invocation and a resumed or partial sweep can leave it stale.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { deliveryReport, formatDelivery } from './lib/delivery.js';
import { makeInstance } from './scenarios/payables.js';

const runId = process.argv[2];
if (!runId) { console.error('usage: node src/payables.js <runId>'); process.exit(1); }
const ROOT = join('runs', runId);
if (!existsSync(ROOT)) { console.error(`no such run: ${ROOT}`); process.exit(1); }

const ARMS = ['A', 'B', 'C', 'D'];
const LS = [1, 2, 4];
const MS = [0, 1];
const ORDERS = 6;
const N_BOOT = 4000;
// Below this many seeds a percentile bootstrap of the mean has too few
// distinct resamples to be an interval of anything; the estimate is printed
// alone.
const MIN_N_CI = 5;

// The protocol fixes every other knob of the harness (docs/PAYABLES.md, "What
// is held fixed"). A row from a different setting is not part of the design
// and must not enter a paired block, however it got into the run directory.
const FIXED = { E: 0, k: 1, seedProfile: 'control', edgeCost: 0, relayDepth: 0, dirSize: 100, reputation: 'off', searchCap: 40 };

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f2 = (x) => (Number.isFinite(x) ? (x >= 0 ? ' ' : '') + x.toFixed(3) : '   -- ');
const f1d = (x) => (Number.isFinite(x) ? x.toFixed(1) : '--');
const pct = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : '--');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ── load ────────────────────────────────────────────────────────────────
const dirs = readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const crashedDirs = dirs.filter((d) => existsSync(join(ROOT, d, 'CRASHED')));
const allRows = dirs
  .filter((d) => existsSync(join(ROOT, d, 'summary.json')))
  .map((d) => ({ ...readJson(join(ROOT, d, 'summary.json')), dir: d }))
  .filter((r) => typeof r.scenario === 'string' && r.scenario.startsWith('pay-'));

const cellOf = (scenario) => {
  const m = /^pay-L(\d)-M(\d)$/.exec(String(scenario));
  return { L: m ? Number(m[1]) : NaN, M: m ? Number(m[2]) : NaN };
};
for (const r of allRows) Object.assign(r, cellOf(r.scenario));

// Rows outside the fixed settings are dropped and counted, never silently
// merged. A row missing one of the fields is treated as outside: the driver
// has written every one of them for as long as the payables scenarios exist.
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
    if (seen.has(key)) throw new Error(`payables: duplicate episode for ${key}: ${seen.get(key)} and ${r.dir}`);
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
    .filter((e) => typeof e.scenario === 'string' && e.scenario.startsWith('pay-'))
    .map((e) => ({ ...e, ...cellOf(e.scenario) }))
    // A manifest entry may omit a fixed field; only a stated, different value excludes it.
    .filter((e) => Object.keys(FIXED).every((k) => !(k in e) || e[k] === FIXED[k]));
}

const say = (s = '') => { lines.push(s); console.log(s); };
const lines = [];

say(`# payables — ${runId}`);
say(`episodes=${rows.length} (summary.json present, on protocol); excluded (off-protocol settings)=${excluded.length}; CRASHED directories=${crashedDirs.length}${planned ? `; planned (manifest)=${planned.length}` : '; no manifest.json'}`);
if (excluded.length) {
  const byWhy = new Map();
  for (const x of excluded) { const k = x.why.join(','); byWhy.set(k, (byWhy.get(k) || 0) + 1); }
  say(`excluded rows by setting: ${[...byWhy].map(([k, n]) => `${k} ×${n}`).join('; ')}`);
}
if (crashedDirs.length) say(`CRASHED: ${crashedDirs.slice(0, 20).join(', ')}${crashedDirs.length > 20 ? ', …' : ''}`);
say();
if (!rows.length) {
  say('no pay-* episodes found (incomplete)');
  writeFileSync(join(ROOT, 'payables.md'), lines.join('\n'));
  process.exit(0);
}

// ── events per T1 beat ──────────────────────────────────────────────────
// Everything the beat record does not carry comes from events.jsonl: who was
// asked and who was read, whether an answer was cut off, tokens by role, and
// whether the beat crashed. Events are attributed to a beat by their own
// `beat` field when they have one (tool events) and otherwise by the
// enclosing beat.start/beat.done pair (llm events carry only a tag).
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
  const ev = beatEvents(events, 'T1');
  const asked = new Set(), read = new Set();
  const byRole = { requester: 0, responder: 0, builder: 0, consult: 0, other: 0 };
  let asks = 0, truncated = 0, crash = false, technical = false;
  for (const e of ev) {
    if (e.evt === 'llm') byRole[ROLE_OF_TAG[String(e.tag || '').split('.')[0]] || 'other'] += (e.ti || 0) + (e.to || 0);
    else if (e.evt === 'tool.ask') { asks++; if (e.fin === 'length') truncated++; if (e.card) asked.add(e.card); }
    else if (e.evt === 'consult.ok') { if (e.to) asked.add(e.to); }
    else if (e.evt === 'tool.list' || e.evt === 'tool.read') { if (e.card) read.add(e.card); }
    else if (e.evt === 'beat.crash') { crash = true; technical = true; }
    else if (e.evt === 'llm.fail' || e.evt === 'req.llm' || e.evt === 'contact.llm') technical = true;
  }
  return { asked, read, byRole, asks, truncated, crash, technical };
}

// ── T1.html ─────────────────────────────────────────────────────────────
// The artifact is re-read for what the assertions do not record: which value
// a conflicted field carries (adoption), which documents each row cites
// (evidence), and how many items the page left unresolved.
function parseArtifact(dir) {
  const p = join(ROOT, dir, 'T1.html');
  if (!existsSync(p)) return null;
  const html = readFileSync(p, 'utf8');
  const rowsByOrder = new Map();
  for (const m of html.matchAll(/<tr\b([^>]*)>/gi)) {
    const attrs = {};
    for (const a of m[1].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? '';
    if (!/\border\b/.test(attrs.class || '')) continue;
    if (attrs['data-order'] && !rowsByOrder.has(attrs['data-order'])) rowsByOrder.set(attrs['data-order'], attrs);
  }
  const sec = /<section\b[^>]*\bid\s*=\s*["']unresolved["'][^>]*>([\s\S]*?)<\/section>/i.exec(html);
  const unresolved = sec ? (sec[1].match(/<li\b/gi) || []).length : 0;
  return { rowsByOrder, unresolved };
}
const num = (s) => Number(String(s ?? '').replace(/[^\d.-]/g, ''));
const yes = (s) => String(s ?? '').trim().toLowerCase() === 'yes';

const instanceCache = new Map();
function instanceMeta(r) {
  const key = `${r.L}|${r.M}|${r.seed}`;
  if (!instanceCache.has(key)) instanceCache.set(key, makeInstance(r.L, r.M, 'A', r.seed).meta);
  return instanceCache.get(key);
}

/** Adoption of conflicting values (M1) and evidence coverage, from T1.html. */
function artifactMetrics(r, art) {
  const meta = instanceMeta(r);
  const out = {};
  if (r.M === 1 && meta.conflicts.length) {
    let adopted = 0;
    for (const c of meta.conflicts) {
      const row = art.rowsByOrder.get(c.order);
      if (!row) continue;
      const v = row[`data-${c.field}`];
      if (v == null) continue;
      if (c.field === 'accepted') { if (yes(v) === Boolean(c.wrongValue)) adopted++; }
      else if (num(v) === Number(c.wrongValue)) adopted++;
    }
    out.adoption = adopted / meta.conflicts.length;
  }
  const otherIds = new Set(meta.orders.flatMap((o) => Object.values(o.docs).map((d) => d[1])));
  let full = 0, nonCurrent = 0;
  for (const o of meta.orders) {
    const row = art.rowsByOrder.get(o.id);
    const cited = new Set(String(row?.['data-evidence'] ?? '').split(',').map((s) => s.trim()).filter(Boolean));
    const current = Object.values(o.docs).map((d) => d[0]);
    if (current.every((id) => cited.has(id))) full++;
    if ([...cited].some((id) => otherIds.has(id))) nonCurrent++;
  }
  out.evidenceFull = full / meta.orders.length;
  out.evidenceNonCurrent = nonCurrent / meta.orders.length;
  out.unresolved = art.unresolved;
  return out;
}

// ── per-episode metrics (T1 beat) ───────────────────────────────────────
// `failures` in the beat record is capped at 12 ids; with 43 assertions a bad
// episode can fail more than that, and a capped list would make it look
// better than it was. `failedAll` is the uncapped list; fall back with a
// warning so the reader knows Q may be inflated for weak episodes.
let cappedFallback = 0;
let inferredKind = 0;
let noEvents = 0;
const FIELDS_Q = ['balance', 'status', 'payable'];
const FIELDS_ACC = ['invoice', 'discount', 'accepted', 'paid'];

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
  let failed = null;
  if (Array.isArray(t1.failedAll)) failed = new Set(t1.failedAll);
  else { failed = new Set(t1.failures || []); cappedFallback++; }
  let q, acc;
  if (delivered) {
    let okOrders = 0, okFields = 0;
    for (let i = 0; i < ORDERS; i++) {
      if (FIELDS_Q.every((f) => !failed.has(`o${i}_${f}`))) okOrders++;
      for (const f of FIELDS_ACC) if (!failed.has(`o${i}_${f}`)) okFields++;
    }
    q = okOrders / ORDERS;
    acc = okFields / (ORDERS * FIELDS_ACC.length);
  }
  // Planned denominator: a model failure is a task failure and scores 0; a
  // technical loss stays missing (undefined) and is bracketed, not scored.
  const modelFail = !delivered && kind === 'model';
  // Tokens are missing when the stats were lost in a crash: the cost was
  // spent but is unknown, and an unknown must not enter a mean as 0.
  const tokensLost = Boolean(t1.tokensUnknown) || Boolean(ev?.crash);
  const art = delivered ? parseArtifact(r.dir) : null;
  const am = art ? artifactMetrics(r, art) : {};
  return {
    present: true, delivered, kind, q, acc,
    qP: delivered ? q : modelFail ? 0 : undefined,
    accP: delivered ? acc : modelFail ? 0 : undefined,
    complete: delivered ? (q === 1 ? 1 : 0) : undefined,
    // F1 is conditioned on delivery like Q, so the three quality columns share
    // a denominator.
    f1: delivered ? t1.f1 : undefined,
    tokens: tokensLost || t1.tokens == null ? undefined : t1.tokens / 1000,
    tokRequester: tokensLost || !ev ? undefined : ev.byRole.requester / 1000,
    tokResponder: tokensLost || !ev ? undefined : ev.byRole.responder / 1000,
    tokBuilder: tokensLost || !ev ? undefined : ev.byRole.builder / 1000,
    tokConsult: tokensLost || !ev ? undefined : ev.byRole.consult / 1000,
    asks: t1.asks || 0, lists: t1.lists || 0, reads: t1.reads || 0, searches: t1.searches || 0,
    askedHolders: ev ? ev.asked.size : undefined,
    readHolders: ev ? ev.read.size : undefined,
    contacted: ev ? new Set([...ev.asked, ...ev.read]).size : undefined,
    evAsks: ev ? ev.asks : 0, evTruncated: ev ? ev.truncated : 0,
    storeUse: (t1.reads || 0) > 0 ? 1 : 0,
    html: existsSync(join(ROOT, r.dir, 'T1.html')) ? 1 : 0,
    adoption: am.adoption, evidenceFull: am.evidenceFull, evidenceNonCurrent: am.evidenceNonCurrent, unresolved: am.unresolved,
  };
}
for (const r of rows) r.m = measure(r);

// ── 1. delivery ─────────────────────────────────────────────────────────
// The delivery module counts every beat in a row; this analysis is about T1
// only, so the rows are narrowed before the report.
const rowsT1 = rows.map((r) => ({ ...r, beats: (r.beats || []).filter((b) => b.beat === 'T1') }));
{
  const rep = formatDelivery(deliveryReport(rowsT1, ['arm', 'L', 'M'])).split('\n');
  say(rep[0]);
  say();
  say('> This analysis excludes lost beats from the delivered-only means (it does not count them as 0)');
  say('> and reports the planned denominator separately: a model failure counts as Q = 0 there, a');
  say('> technical loss stays missing and is bracketed in the primary-contrast bounds.');
  for (const l of rep.slice(1)) say(l);
}

say('### Planned, summarised, delivered, and failure kinds per cell (T1)');
say();
say(`Planned comes from manifest.json${planned ? '' : ' (absent: planned is shown as --)'}; summarised is a summary.json on`);
say('protocol; delivered is a parsed artifact. model = the requester ended without a submission or the');
say('artifact did not parse; technical = an LLM call failed, the beat crashed, or the scorer threw.');
if (crashedDirs.length) say(`CRASHED directories (${crashedDirs.length}) have no summary and are neither summarised nor delivered.`);
say();
say('| L | M | arm | planned | summarised | delivered | model | technical | crashed |');
say('|---|---|---|---|---|---|---|---|---|');
for (const L of LS) for (const M of MS) for (const arm of ARMS) {
  const rs = rows.filter((r) => r.arm === arm && r.L === L && r.M === M && r.m.present);
  const pl = planned ? planned.filter((e) => e.arm === arm && e.L === L && e.M === M) : null;
  if (!rs.length && !(pl && pl.length)) continue;
  const crashed = pl ? pl.filter((e) => crashedDirs.includes(e.id)).length : NaN;
  say(`| ${L} | ${M} | ${arm} | ${pl ? pl.length : '--'} | ${rs.length} | ${rs.filter((r) => r.m.delivered).length} | ${rs.filter((r) => r.m.kind === 'model').length} | ${rs.filter((r) => r.m.kind === 'technical').length} | ${Number.isFinite(crashed) ? crashed : '--'} |`);
}
say();
if (inferredKind) {
  say(`> **NOTE.** ${inferredKind} beat(s) carry no \`failureKind\`; the model/technical classification was inferred`);
  say('> from the first scorer error (no-artifact, parse: → model; scorer: → technical) and the beat\'s events.');
  say();
}
if (noEvents) {
  say(`> **NOTE.** ${noEvents} episode(s) have no events.jsonl; holder counts, truncation, tokens by role and`);
  say('> crash detection are missing for them.');
  say();
}
if (cappedFallback) {
  say(`> **WARNING.** ${cappedFallback} episode(s) have no \`failedAll\` in the T1 beat; Q and field accuracy`);
  say('> were computed from `failures`, which is capped at 12 assertion ids. Episodes that failed');
  say('> more than 12 assertions are scored too generously. Re-run with a harness that records failedAll.');
  say();
}

// ── 2. per-cell means ───────────────────────────────────────────────────
const cellRows = (arm, L, M) => rows.filter((r) => r.arm === arm && r.L === L && r.M === M && r.m.present);
const vals = (rs, k) => rs.map((r) => r.m[k]).filter((v) => v != null && Number.isFinite(v));

say('## Per-cell means (T1)');
say();
say('Q = share of the 6 orders with balance, status and payable all correct; field = share of the 24');
say('invoice/discount/accepted/paid attributes correct. Q and field are over delivered beats; Q(pl) and');
say('field(pl) are over the planned denominator (model failures as 0, technical losses missing). complete');
say('= share of delivered beats with Q = 1. asked = distinct cards asked (ask_agent, builder consults);');
say('read = distinct cards listed or read; contacted = their union. store use = share of episodes with');
say('at least one read_store call. Tokens are whole-system, in thousands, missing when lost in a crash.');
say();
say('| L | M | arm | n | delivered | Q | Q(pl) | field | field(pl) | F1 | complete | tokens (k) | asks | lists | reads | searches | asked | read | contacted | store use |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const L of LS) for (const M of MS) for (const arm of ARMS) {
  const rs = cellRows(arm, L, M);
  if (!rs.length) continue;
  const d = mean(rs.map((r) => (r.m.delivered ? 1 : 0)));
  say(`| ${L} | ${M} | ${arm} | ${rs.length} | ${pct(d)} | ${f2(mean(vals(rs, 'q')))} | ${f2(mean(vals(rs, 'qP')))} | ${f2(mean(vals(rs, 'acc')))} | ${f2(mean(vals(rs, 'accP')))} | ${f2(mean(vals(rs, 'f1')))} | ${pct(mean(vals(rs, 'complete')))} | ${f1d(mean(vals(rs, 'tokens')))} | ${f1d(mean(vals(rs, 'asks')))} | ${f1d(mean(vals(rs, 'lists')))} | ${f1d(mean(vals(rs, 'reads')))} | ${f1d(mean(vals(rs, 'searches')))} | ${f1d(mean(vals(rs, 'askedHolders')))} | ${f1d(mean(vals(rs, 'readHolders')))} | ${f1d(mean(vals(rs, 'contacted')))} | ${pct(mean(vals(rs, 'storeUse')))} |`);
}
say();

say('### Diagnostics from T1.html and events (per cell)');
say();
say('html = share of episodes whose T1.html exists. trunc = share of tool.ask events whose answer hit the');
say('token cap (fin = length), pooled over the cell. unresolved = mean count of <li> items in');
say('<section id="unresolved">. evidence full = mean share of orders whose cited evidence includes all');
say('four current document ids; evidence non-current = mean share of orders citing at least one');
say('background or superseded id. adoption (M1 only) = adopted / 4 conflicts. All over delivered beats');
say('whose T1.html exists.');
say();
say('| L | M | arm | n | html | trunc | unresolved | evidence full | evidence non-current | adoption |');
say('|---|---|---|---|---|---|---|---|---|---|');
for (const L of LS) for (const M of MS) for (const arm of ARMS) {
  const rs = cellRows(arm, L, M);
  if (!rs.length) continue;
  const asks = rs.reduce((n, r) => n + r.m.evAsks, 0);
  const trunc = asks ? rs.reduce((n, r) => n + r.m.evTruncated, 0) / asks : NaN;
  say(`| ${L} | ${M} | ${arm} | ${rs.length} | ${pct(mean(vals(rs, 'html')))} | ${pct(trunc)} | ${f1d(mean(vals(rs, 'unresolved')))} | ${f2(mean(vals(rs, 'evidenceFull')))} | ${f2(mean(vals(rs, 'evidenceNonCurrent')))} | ${M === 1 ? f2(mean(vals(rs, 'adoption'))) : 'n/a'} |`);
}
say();

// ── paired blocks and bootstrap ─────────────────────────────────────────
/**
 * One block per seed: { A, B, C, D } values of metric `k` in cell (L, M).
 * A seed enters only when all four arms have a finite value, so every
 * contrast below is a within-seed difference and the bootstrap keeps the
 * four arms of a seed together. With `fill` given, a missing arm takes that
 * value instead of dropping the seed (the bounds analysis), over `seeds`.
 */
function blocks(L, M, k, { fill, seeds } = {}) {
  const bySeed = new Map();
  for (const r of rows) {
    if (r.L !== L || r.M !== M || !r.m.present) continue;
    const v = r.m[k];
    if (v == null || !Number.isFinite(v)) continue;
    const b = bySeed.get(r.seed) || {};
    b[r.arm] = v; // a repeated (arm, seed) cannot happen: checked at load
    bySeed.set(r.seed, b);
  }
  const out = new Map();
  if (fill == null) {
    for (const [seed, b] of bySeed) if (ARMS.every((a) => b[a] != null)) out.set(seed, b);
    return out;
  }
  let filled = 0;
  for (const seed of seeds) {
    const b = { ...(bySeed.get(seed) || {}) };
    for (const a of ARMS) if (b[a] == null) { b[a] = fill; filled++; }
    out.set(seed, b);
  }
  out.filled = filled;
  return out;
}

/**
 * mulberry32: a 32-bit generator whose arithmetic stays inside Math.imul, so
 * it never leaves the exact-integer range of a double. (The LCG it replaces
 * multiplied a 31-bit state by 1103515245 in doubles, lost low bits past
 * 2^53, and collapsed into a 10,466-draw cycle with uneven seed weights.)
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

/** Percentile bootstrap of the mean over seeds (resample the per-seed values). */
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
  S: (b) => ((b.B - b.A) + (b.D - b.C)) / 2,
  F: (b) => ((b.A - b.C) + (b.B - b.D)) / 2,
  'B-A': (b) => b.B - b.A,
  'D-C': (b) => b.D - b.C,
  '(B-A)-(D-C)': (b) => (b.B - b.A) - (b.D - b.C),
};

/** Estimate + CI of a per-seed statistic averaged over seeds. */
function est(perSeed) {
  const v = [...perSeed.values()];
  const [lo, hi] = v.length >= MIN_N_CI ? bootMean(v) : [NaN, NaN];
  return { est: mean(v), lo, hi, n: v.length };
}
const ci = (e, f = f2) => (e.n >= MIN_N_CI ? `[${f(e.lo)}, ${f(e.hi)}]` : 'n too small for an interval');
const line = (label, e, extra = '') => {
  if (!e.n) return `  ${label.padEnd(20)} incomplete (no complete seed blocks)${extra}`;
  if (e.n < MIN_N_CI) return `  ${label.padEnd(20)} = ${f2(e.est)}   n too small for an interval   n=${e.n}${extra}`;
  const excl = e.lo * e.hi > 0 ? 'excludes 0' : 'spans 0';
  return `  ${label.padEnd(20)} = ${f2(e.est)}   95% CI ${ci(e)}   ${excl}   n=${e.n}${extra}`;
};

/** Per-seed map of contrast `fn` applied to blocks of metric `k` in cell (L, M). */
function perSeed(L, M, k, fn, opts) {
  const out = new Map();
  for (const [seed, b] of blocks(L, M, k, opts)) out.set(seed, fn(b));
  return out;
}

// The two denominators for Q, and their field-accuracy companions.
const DENOMS = [['delivered-only', 'q', 'acc'], ['planned', 'qP', 'accP']];

// ── 3. contrasts per (L, M) on Q ────────────────────────────────────────
say('## Contrasts per (L, M) — Q, paired by seed');
say();
say('S = ½[(B−A)+(D−C)] is the store effect, F = ½[(A−C)+(B−D)] the formation effect. If B−A and D−C');
say('disagree, S averages over a real interaction; read the interaction line, not just S. Each cell is');
say('given under both denominators: delivered-only (a seed needs all four arms delivered) and planned');
say('(model failures enter as Q = 0; a seed with a technical loss in any arm is dropped).');
say();
for (const M of MS) for (const L of LS) {
  say(`### L=${L} M=${M}`);
  for (const [name, k] of DENOMS) {
    const bl = blocks(L, M, k);
    say(`#### ${name}`);
    if (!bl.size) { say('  incomplete (no seed has all four arms)'); say(); continue; }
    const cm = Object.fromEntries(ARMS.map((a) => [a, mean([...bl.values()].map((b) => b[a]))]));
    say('```');
    say('                sandbox     store');
    say(`  open        ${f2(cm.A)}     ${f2(cm.B)}     A,B`);
    say(`  bounded     ${f2(cm.C)}     ${f2(cm.D)}     C,D`);
    say('```');
    for (const [label, fn] of Object.entries(CONTRASTS)) say(line(label, est(perSeed(L, M, k, fn))));
    say();
  }
}

// Secondary metrics, S only: the shape of the curve should not depend on
// whether the score is business decisions, fields, or the old requirement F1.
say('### S on secondary metrics');
say();
say('| L | M | metric | denominator | S | 95% CI | n |');
say('|---|---|---|---|---|---|---|');
for (const [k, label, denom] of [['acc', 'field accuracy', 'delivered-only'], ['accP', 'field accuracy', 'planned'], ['f1', 'requirement F1', 'delivered-only']]) {
  for (const M of MS) for (const L of LS) {
    const e = est(perSeed(L, M, k, CONTRASTS.S));
    if (!e.n) continue;
    say(`| ${L} | ${M} | ${label} | ${denom} | ${f2(e.est)} | ${ci(e)} | ${e.n} |`);
  }
}
say();

// ── 4./5. primary contrast K and S(L=4), per M, plus M1−M0 ──────────────
/** Seeds present in both maps, differenced. */
function diffSeeds(a, b) {
  const out = new Map();
  for (const [seed, va] of a) if (b.has(seed)) out.set(seed, va - b.get(seed));
  return out;
}
/** Entries of `a` whose seed is in `keep`. */
function restrict(a, keep) {
  const out = new Map();
  for (const [seed, v] of a) if (keep.has(seed)) out.set(seed, v);
  return out;
}
/** The seeds the design planned for cell (L, M): the manifest when there is one, else every seed seen. */
function plannedSeeds(L, M) {
  const src = planned ? planned.filter((e) => e.L === L && e.M === M) : rows.filter((r) => r.L === L && r.M === M);
  return new Set(src.map((e) => e.seed));
}

say('## Primary contrast');
say();
say('K = S(L=4) − S(L=1), computed per seed (a seed must have all four arms at both L) then averaged.');
say('K > 0 alone can mean store went from worse to less bad; a quality gain at high burden needs');
say('S(L=4) > 0 as well. Both are reported, neither is selected. Seed sets: K and "S(L=4) | K seeds" use');
say('the seeds complete at both L=1 and L=4, so the two primaries share n; "S(L=4) all" uses every seed');
say('complete at L=4 and "S(L=1) all" every seed complete at L=1.');
say();
for (const M of MS) {
  say(`### M=${M}${M === 0 ? ' (pre-registered)' : ' (secondary: conflicts)'}`);
  for (const [name, k] of DENOMS) {
    const S1 = perSeed(1, M, k, CONTRASTS.S);
    const S4 = perSeed(4, M, k, CONTRASTS.S);
    const K = diffSeeds(S4, S1);
    say(`#### ${name}`);
    say(line('K', est(K), '   [seeds complete at L=1 and L=4]'));
    say(line('S(L=4) | K seeds', est(restrict(S4, new Set(K.keys()))), '   [same seeds as K]'));
    say(line('S(L=4) all', est(S4), '   [seeds complete at L=4]'));
    say(line('S(L=1) all', est(S1), '   [seeds complete at L=1]'));
    say();
  }
  // Bounds: the planned denominator with every still-missing Q (technical
  // loss, or an episode that never wrote a summary) set to 0 and to 1. The
  // true K over the planned seeds lies between the two if losses were
  // ignorable; a wide gap means the losses, not the arms, decide the sign.
  const seeds = new Set([...plannedSeeds(1, M), ...plannedSeeds(4, M)]);
  say('#### bounds (planned denominator, missing Q filled)');
  for (const fill of [0, 1]) {
    const b1 = blocks(1, M, 'qP', { fill, seeds });
    const b4 = blocks(4, M, 'qP', { fill, seeds });
    const S1 = new Map([...b1].map(([s, b]) => [s, CONTRASTS.S(b)]));
    const S4 = new Map([...b4].map(([s, b]) => [s, CONTRASTS.S(b)]));
    say(line(`K | missing=${fill}`, est(diffSeeds(S4, S1)), `   [${seeds.size} planned seeds, ${b1.filled + b4.filled} of ${seeds.size * 8} beats filled]`));
    say(line(`S(L=4) | missing=${fill}`, est(S4), `   [${seeds.size} planned seeds, ${b4.filled} of ${seeds.size * 4} beats filled]`));
  }
  say();
}

say('### Conflicts: S(M1) − S(M0) per L');
say();
say('Per seed, the same world with the four historical records replaced by conflicting ones.');
say();
for (const [name, k] of DENOMS) {
  say(`#### ${name}`);
  for (const L of LS) {
    const d = diffSeeds(perSeed(L, 1, k, CONTRASTS.S), perSeed(L, 0, k, CONTRASTS.S));
    say(line(`L=${L}`, est(d)));
  }
  const K0 = diffSeeds(perSeed(4, 0, k, CONTRASTS.S), perSeed(1, 0, k, CONTRASTS.S));
  const K1 = diffSeeds(perSeed(4, 1, k, CONTRASTS.S), perSeed(1, 1, k, CONTRASTS.S));
  say(line('K(M1)-K(M0)', est(diffSeeds(K1, K0))));
  say();
}

// ── 5b. wrong adoption under conflicts ─────────────────────────────────
say('## Wrong adoption (M1)');
say();
say('Share of the 4 conflicting values (one per evidence group, on four distinct orders) that the');
say('artifact carries in the conflicted field, over delivered beats whose T1.html exists. A lower');
say('B−A or D−C means reading the folder adopted fewer superseded values than asking its keeper.');
say();
say('| L | A | B | C | D | B−A | 95% CI | D−C | 95% CI | n |');
say('|---|---|---|---|---|---|---|---|---|---|');
for (const L of LS) {
  const bl = blocks(L, 1, 'adoption');
  if (!bl.size) { say(`| ${L} | incomplete | | | | | | | | 0 |`); continue; }
  const cm = Object.fromEntries(ARMS.map((a) => [a, mean([...bl.values()].map((b) => b[a]))]));
  const ba = est(perSeed(L, 1, 'adoption', CONTRASTS['B-A']));
  const dc = est(perSeed(L, 1, 'adoption', CONTRASTS['D-C']));
  say(`| ${L} | ${f2(cm.A)} | ${f2(cm.B)} | ${f2(cm.C)} | ${f2(cm.D)} | ${f2(ba.est)} | ${ci(ba)} | ${f2(dc.est)} | ${ci(dc)} | ${bl.size} |`);
}
say();

// ── 6. tokens ───────────────────────────────────────────────────────────
say('## Tokens (T1, k) and the token cost of store');
say();
say('Whole-system tokens for the beat, all roles summed. The build receipt is the same in every arm, so');
say('most of a difference here should be listing and reading documents versus asking for them; the');
say('per-role table below says where it actually sits. A beat whose stats were lost in a crash is');
say('missing, not 0.');
say();
say('| L | M | A | B | C | D | B−A | 95% CI | D−C | 95% CI | n |');
say('|---|---|---|---|---|---|---|---|---|---|---|');
function tokenRow(L, M, k, prefix) {
  const bl = blocks(L, M, k);
  if (!bl.size) { say(`| ${prefix} | incomplete | | | | | | | | 0 |`); return; }
  const cm = Object.fromEntries(ARMS.map((a) => [a, mean([...bl.values()].map((b) => b[a]))]));
  const ba = est(perSeed(L, M, k, CONTRASTS['B-A']));
  const dc = est(perSeed(L, M, k, CONTRASTS['D-C']));
  say(`| ${prefix} | ${f1d(cm.A)} | ${f1d(cm.B)} | ${f1d(cm.C)} | ${f1d(cm.D)} | ${f1d(ba.est)} | ${ci(ba, f1d)} | ${f1d(dc.est)} | ${ci(dc, f1d)} | ${bl.size} |`);
}
for (const M of MS) for (const L of LS) tokenRow(L, M, 'tokens', `${L} | ${M}`);
say();

say('### Tokens by role (T1, k)');
say();
say('Summed from the llm events of the beat by tag: req.* = requester, ask.* = responder, build.* =');
say('builder, consult.* = builder consults (shown when non-zero). Same per-seed contrasts as above.');
say();
say('| L | M | role | A | B | C | D | B−A | 95% CI | D−C | 95% CI | n |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|');
const ROLES = [['tokRequester', 'requester'], ['tokResponder', 'responder'], ['tokBuilder', 'builder'], ['tokConsult', 'consult']];
for (const M of MS) for (const L of LS) for (const [k, label] of ROLES) {
  if (k === 'tokConsult' && !rows.some((r) => r.L === L && r.M === M && r.m.tokConsult > 0)) continue;
  tokenRow(L, M, k, `${L} | ${M} | ${label}`);
}
say();

// ── 7. footer ───────────────────────────────────────────────────────────
say('## Notes');
say();
const nCell = [];
for (const L of LS) for (const M of MS) for (const arm of ARMS) {
  const n = cellRows(arm, L, M).length;
  if (n) nCell.push(`L${L}M${M}${arm}=${n}`);
}
say(`- n per cell (summarised, on protocol): ${nCell.join(', ') || 'none'}.`);
say(`- Rows are restricted to the protocol settings (${Object.entries(FIXED).map(([k, v]) => `${k}=${v}`).join(', ')});`);
say(`  ${excluded.length} row(s) were excluded for other settings, and ${crashedDirs.length} CRASHED director${crashedDirs.length === 1 ? 'y' : 'ies'} never wrote a summary.`);
say('- Q is the share of the 6 orders whose balance, status and payable are all correct (assertion ids');
say('  o{i}_balance, o{i}_status, o{i}_payable); field accuracy is the share of the 24 invoice/discount/');
say('  accepted/paid attributes correct. Both come from the T1 beat.');
say('- Two denominators. Delivered-only: beats that produced no artifact are excluded from the Q, field');
say('  and F1 means and from every paired contrast (a seed needs all four arms delivered to enter a');
say('  block). Planned: a beat whose failureKind is model (no submission, or an artifact that did not');
say('  parse) counts as Q = 0 and field accuracy 0; a technical loss (LLM call failed, beat crashed,');
say('  scorer threw) stays missing, and the primary contrast is bracketed with missing Q set to 0 and');
say('  to 1 over the planned seeds. Neither denominator counts a lost beat as 0 silently; the delivery');
say('  table above is the place to look before reading any contrast. (The delivery module\'s "counts a');
say('  lost beat as F1 = 0" note describes the older analyzers, not this one.)');
say('- Token means and token contrasts keep beats that produced no artifact when their stats survived:');
say('  the cost was spent. A beat with tokensUnknown, or a beat.crash event, has unknown cost and is');
say('  missing from every token mean and contrast, never 0.');
say('- asked = distinct cards in tool.ask events plus consult.ok targets; read = distinct cards in');
say('  tool.list and tool.read events; contacted = the union of the two. All from events.jsonl for the');
say('  T1 beat. The beat record\'s own `contacted` counter is not used.');
say('- Wrong adoption compares each conflicted order\'s data-invoice/discount/accepted/paid in T1.html');
say('  with the conflicting value the superseded record carries (numbers numerically, accepted as yes/no);');
say('  evidence coverage reads data-evidence on the same rows against the instance\'s document ids.');
say(`- All intervals are descriptive 95% percentile bootstraps over seeds (base cases), keeping the four`);
say(`  arms of a seed together, printed only when n ≥ ${MIN_N_CI}. They are not corrected for multiple`);
say('  comparisons; the pre-registered test is a paired t-test on the per-seed K_i and S_i(L=4) with');
say('  Holm correction, which this script does not perform.');
say(`- Q and field accuracy read \`failedAll\` from the beat record${cappedFallback ? ` (MISSING in ${cappedFallback} episode(s); the capped \`failures\` list was used there)` : ''}.`);
say(`- failureKind was read from the beat record${inferredKind ? ` for all but ${inferredKind} beat(s), where it was inferred from the scorer error` : ''}.`);

writeFileSync(join(ROOT, 'payables.md'), lines.join('\n'));
console.log(`\nwritten: ${join(ROOT, 'payables.md')}`);

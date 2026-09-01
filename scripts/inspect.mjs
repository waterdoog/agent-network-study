#!/usr/bin/env node
// Read-side view over a run's JSONL. Everything the sweep records is already
// structured, so this needs no changes to a run in flight.
//
//   node scripts/inspect.mjs <run>            progress + errors + knob check
//   node scripts/inspect.mjs <run> --errors   every failure, with its episode
//   node scripts/inspect.mjs <run> --ep <id>  one episode's timeline
//   node scripts/inspect.mjs <run> --slow     the slowest calls
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const runId = argv.find((a) => !a.startsWith('--')) || readdirSync('runs').sort().pop();
const ROOT = join('runs', runId);
const has = (f) => argv.includes(`--${f}`);
const val = (f) => { const i = argv.indexOf(`--${f}`); return i >= 0 ? argv[i + 1] : null; };

const eps = readdirSync(ROOT).filter((d) => existsSync(join(ROOT, d, 'events.jsonl'))).sort();
const read = (ep) => readFileSync(join(ROOT, ep, 'events.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);

// ── one episode's timeline ────────────────────────────────────────────────
if (val('ep')) {
  const ep = eps.find((e) => e.includes(val('ep')));
  if (!ep) { console.error(`no episode matching ${val('ep')}`); process.exit(1); }
  console.log(`# ${ep}\n`);
  for (const e of read(ep)) {
    const t = `${String(Math.round(e.ms / 1000)).padStart(5)}s`;
    const rest = Object.entries(e).filter(([k]) => !['s', 'ms', 'evt'].includes(k))
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v.slice(0, 60) : JSON.stringify(v)}`).join(' ');
    const mark = e.evt.includes('fail') || e.err ? '!!' : '  ';
    console.log(`${mark} ${t} ${pad(e.evt, 16)} ${rest.slice(0, 150)}`);
  }
  process.exit(0);
}

// ── every failure across the run, with where to look ──────────────────────
const failures = [];
for (const ep of eps) for (const e of read(ep)) if (e.err || e.evt.endsWith('.crash') || e.evt === 'tool.badargs') failures.push({ ep, ...e });

if (has('errors')) {
  if (!failures.length) console.log('no failures recorded');
  for (const f of failures) {
    console.log(`${pad(f.ep, 30)} ${pad(f.evt, 14)} beat=${f.beat || '-'}  ${String(f.err || '').slice(0, 110)}`);
    if (f.stack) console.log(`${' '.repeat(32)}${f.stack.slice(0, 140)}`);
  }
  process.exit(0);
}

// ── slowest calls ─────────────────────────────────────────────────────────
if (has('slow')) {
  const calls = [];
  for (const ep of eps) { let prev = 0; for (const e of read(ep)) { if (e.evt === 'llm') calls.push({ ep, tag: e.tag, ms: e.ms - prev, to: e.to }); prev = e.ms; } }
  calls.sort((a, b) => b.ms - a.ms);
  for (const c of calls.slice(0, 25)) console.log(`${num(Math.round(c.ms / 1000), 5)}s  ${pad(c.ep, 30)} ${pad(c.tag, 22)} out=${c.to}`);
  process.exit(0);
}

// ── default: progress, knob check, failures ───────────────────────────────
const done = eps.filter((e) => existsSync(join(ROOT, e, 'summary.json')));
const started = statSync(join(ROOT, eps[0] || '.')).birthtimeMs;
const mins = (Date.now() - started) / 60000;

console.log(`# ${runId}`);
console.log(`episodes: ${done.length} complete / ${eps.length} started   elapsed ${mins.toFixed(0)}min`);

const beats = {};
for (const ep of eps) for (const e of read(ep)) if (e.evt === 'beat.done') beats[e.beat] = (beats[e.beat] || 0) + 1;
console.log(`beats done: ${Object.entries(beats).map(([k, v]) => `${k}=${v}`).join(' ') || 'none yet'}`);
console.log(`failures:   ${failures.length}${failures.length ? '   (run with --errors)' : ''}`);

// The manipulation check. If these do not separate, the run is measuring nothing.
console.log('\n## knob check — does the access axis bite?');
console.log('| arm | ask | list | read | store share | ask reply median | denied |');
console.log('|---|---|---|---|---|---|---|');
for (const arm of ['A', 'B', 'C', 'D']) {
  const mine = eps.filter((e) => e.startsWith(`${arm}_`));
  if (!mine.length) continue;
  let ask = 0, list = 0, rd = 0, denied = 0; const lens = [];
  for (const ep of mine) for (const e of read(ep)) {
    if (e.evt === 'tool.ask') { ask++; lens.push(e.len); }
    else if (e.evt === 'tool.list') list++;
    else if (e.evt === 'tool.read') rd++;
    else if (e.evt === 'store.denied' || e.evt === 'store.refused') denied++;
  }
  lens.sort((a, b) => a - b);
  const share = ask + list + rd ? (list + rd) / (ask + list + rd) : 0;
  console.log(`| ${arm} | ${ask} | ${list} | ${rd} | ${share.toFixed(2)} | ${lens.length ? lens[lens.length >> 1] : '-'} | ${denied} |`);
}

for (const f of failures.slice(0, 8)) console.log(`\n!! ${f.ep} ${f.evt}: ${String(f.err).slice(0, 120)}`);

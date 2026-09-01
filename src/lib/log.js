// Structured logging. One JSONL per episode, one compact console line per beat.
// Every LLM call and every kernel decision is an event, so a failed run can be
// located from the log alone without re-running anything.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const LEVELS = { silent: 0, quiet: 1, normal: 2, verbose: 3 };
let level = LEVELS.normal;
export function setLogLevel(name) { level = LEVELS[name] ?? LEVELS.normal; }

export class EpisodeLog {
  /** @param {string} file jsonl path @param {object} meta episode identity */
  constructor(file, meta) {
    this.file = file;
    this.meta = meta;
    this.seq = 0;
    this.t0 = Date.now();
    mkdirSync(dirname(file), { recursive: true });
    this.event('ep.start', meta);
  }

  /** Append one event. `evt` is a short dotted name; keep payloads small. */
  event(evt, data = {}) {
    const rec = { s: ++this.seq, ms: Date.now() - this.t0, evt, ...data };
    appendFileSync(this.file, JSON.stringify(rec) + '\n');
    if (level >= LEVELS.verbose) process.stderr.write(`    · ${evt} ${short(data)}\n`);
    return rec;
  }

  /**
   * An error worth stopping for. Written three times on purpose: into the
   * episode's own jsonl, into one run-wide errors.jsonl so failures across 72
   * episodes are in a single file, and onto the console with a fixed ERR
   * prefix so `grep ERR` finds every one of them.
   */
  fail(evt, err, data = {}) {
    const rec = this.event(evt, { ...data, err: String(err && err.message || err), stack: err?.stack?.split('\n').slice(0, 4).join(' | ') });
    try {
      appendFileSync(join(dirname(dirname(this.file)), 'errors.jsonl'),
        JSON.stringify({ ep: this.meta.ep, at: new Date().toISOString(), ...rec }) + '\n');
    } catch { /* never let logging kill a run */ }
    process.stderr.write(`ERR  ${clock()}  ${this.meta.ep}  ${evt}  ${rec.err}\n`);
    return rec;
  }
}

function short(o) {
  const s = JSON.stringify(o);
  return s.length > 160 ? s.slice(0, 157) + '...' : s;
}

const t0 = Date.now();
const clock = () => new Date().toISOString().slice(11, 19);
let progress = { done: 0, total: 0 };
/** The sweep driver calls this so every line can carry n/total. */
export function setProgress(done, total) { progress = { done, total }; }

/**
 * One line per completed beat. This is the whole console during a sweep, so it
 * carries: wall clock, elapsed, progress, and the episode's directory name
 * verbatim — paste that name into `scripts/inspect.mjs --ep` to drill in.
 */
export function beatLine(r) {
  if (level < LEVELS.quiet) return;
  const ep = `${r.arm}_${r.scenario}_E${r.E}_s${r.seed}`;
  const tag = ep.padEnd(30);
  const sc = r.total ? `${String(r.pass).padStart(2)}/${String(r.total).padEnd(2)}` : ' -- ';
  const reg = r.regression == null ? '    ' : `reg${String(r.regression).padStart(1)}`;
  const st = (r.lists || 0) + (r.reads || 0);
  process.stdout.write(
    `${r.error ? 'ERR ' : 'ok  '}${clock()} +${String(Math.round((Date.now() - t0) / 60000)).padStart(3)}m ` +
    `${String(progress.done).padStart(2)}/${progress.total} ` +
    `${tag} ${r.beat}  ${sc} f1=${fmt(r.f1)} ${reg} ` +
    `ask=${String(r.asks).padStart(2)} str=${String(st).padStart(2)} bld=${r.builds} dep=${r.depth} ` +
    `tok=${kt(r.tokens)} ${String(Math.round(r.ms / 1000)).padStart(3)}s` +
    (r.error ? `  ${r.error}` : '') + '\n'
  );
}

const fmt = (x) => (x == null ? ' -- ' : x.toFixed(2));
const kt = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`).padStart(4);

export function note(msg) { if (level >= LEVELS.quiet) process.stdout.write(msg + '\n'); }

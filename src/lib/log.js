// Structured logging. One JSONL per episode, one compact console line per beat.
// Every LLM call and every kernel decision is an event, so a failed run can be
// located from the log alone without re-running anything.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

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

  /** An error worth stopping for; always written, always printed. */
  fail(evt, err, data = {}) {
    const rec = this.event(evt, { ...data, err: String(err && err.message || err), stack: err?.stack?.split('\n').slice(0, 4).join(' | ') });
    process.stderr.write(`  !! ${this.meta.ep} ${evt}: ${rec.err}\n`);
    return rec;
  }
}

function short(o) {
  const s = JSON.stringify(o);
  return s.length > 160 ? s.slice(0, 157) + '...' : s;
}

/** One line per completed beat. This is the whole console during a sweep. */
export function beatLine(r) {
  if (level < LEVELS.quiet) return;
  const tag = `${r.arm.padEnd(7)} ${r.scenario.padEnd(12)} E${r.E} s${r.seed}`;
  const sc = r.total ? `${String(r.pass).padStart(2)}/${String(r.total).padEnd(2)}` : ' -- ';
  const reg = r.regression == null ? '    ' : `reg${String(r.regression).padStart(1)}`;
  process.stdout.write(
    `[${tag}] ${r.beat}  ${sc} f1=${fmt(r.f1)} ${reg} ` +
    `ask=${String(r.asks).padStart(2)} bld=${r.builds} dep=${r.depth} ` +
    `tok=${kt(r.tokens)} ${String(Math.round(r.ms / 1000)).padStart(3)}s` +
    (r.error ? `  ERR ${r.error}` : '') + '\n'
  );
}

const fmt = (x) => (x == null ? ' -- ' : x.toFixed(2));
const kt = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`).padStart(4);

export function note(msg) { if (level >= LEVELS.quiet) process.stdout.write(msg + '\n'); }

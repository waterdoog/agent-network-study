import { readFileSync, appendFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, relative, join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { HERE, checkAuthorization, sourceManifest } from './manifest.mjs';
import { makeWorld, solveWorld, episodePlan, hash } from './task.mjs';
import { runEpisode, TechnicalFailure } from './engine.mjs';

export function readConfig() { return JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8')); }
export function withinExtension(path) {
  const r = relative(HERE, path);
  if (r.startsWith('..') || isAbsolute(r) || !r) throw new Error('Run output must be a subdirectory of scripts/transfer-study');
  return path;
}
function writeNew(path, value) { writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }

export class AuditLog {
  constructor(file, meta) {
    this.file = file; this.meta = meta; this.sequence = 0; this.started = Date.now();
    this.totalInput = 0; this.totalOutput = 0; this.reasoningTokens = 0; this.reasoningKnownCalls = 0;
    this.calls = 0; this.served = new Set(); this.servingMismatch = false;
    writeFileSync(file, '', { flag: 'wx' });
    this.event('ep.start', meta);
  }
  event(evt, data = {}) {
    if (evt === 'llm') {
      this.calls++; this.totalInput += data.ti; this.totalOutput += data.to; this.served.add(data.served);
      if (data.reasoning_tokens != null) { this.reasoningTokens += data.reasoning_tokens; this.reasoningKnownCalls++; }
    }
    if (evt === 'llm.serving_exclusion') this.servingMismatch = true;
    appendFileSync(this.file, JSON.stringify({ seq: ++this.sequence, elapsed_ms: Date.now() - this.started, evt, ...data }) + '\n');
  }
  fail(evt, err, data = {}) { this.event(evt, { ...data, error: String(err?.message || err) }); }
  usage() {
    return { successful_calls: this.calls, input_tokens: this.totalInput, output_tokens: this.totalOutput,
      reasoning_tokens: this.reasoningTokens, reasoning_known_calls: this.reasoningKnownCalls,
      served: [...this.served], cost_usd: null };
  }
}

export async function collectAttempt({ entry, world, config, directory, chat, attempt }) {
  mkdirSync(directory, { recursive: false });
  const log = new AuditLog(join(directory, 'events.jsonl'), { id: entry.id, arm: entry.arm, seed: entry.seed, attempt });
  let result;
  try {
    result = await runEpisode({ world, arm: entry.arm, config, chat, log });
    if (log.servingMismatch || log.calls === 0 || [...log.served].some(x => x !== config.model)) {
      log.servingMismatch = true;
      throw new TechnicalFailure(new Error('Missing or mismatched upstream serving identity'));
    }
  } catch (err) {
    if (!(err instanceof TechnicalFailure)) {
      log.fail('harness.error', err);
      throw err; // Implementation faults stop collection rather than becoming model failures.
    }
    result = { status: 'technical-failure', selection: null,
      error: String(err.cause?.message || err.message), serving_exclusion: log.servingMismatch };
  }
  const summary = { ...entry, attempt, ...result, usage: log.usage(), world_sha256: hash(world), answer_key_sha256: hash(solveWorld(world)) };
  log.event('ep.end', { status: summary.status, usage: summary.usage });
  writeNew(join(directory, 'summary.json'), summary);
  return summary;
}

export function operationalStatus(out) {
  const planFile = join(out, 'plan.json');
  if (!existsSync(planFile)) return { started: false };
  const { plan } = JSON.parse(readFileSync(planFile, 'utf8'));
  const counts = { planned: plan.length, finished: 0, technical_exhausted: 0,
    completed_attempts: 0, technical_attempts: 0, verified_calls_all_attempts: 0, known_tokens_all_attempts: 0 };
  for (const e of plan) {
    const file = join(out, e.id, 'final.json');
    if (existsSync(file)) {
      const r = JSON.parse(readFileSync(file, 'utf8'));
      counts.finished++; counts.technical_exhausted += r.status === 'technical-exhausted';
    }
    for (const attempt of [1, 2]) {
      const p = join(out, e.id, `attempt-${attempt}`, 'summary.json');
      if (!existsSync(p)) continue;
      const a = JSON.parse(readFileSync(p, 'utf8'));
      counts.completed_attempts++; counts.technical_attempts += a.status === 'technical-failure';
      counts.verified_calls_all_attempts += a.usage.successful_calls;
      counts.known_tokens_all_attempts += a.usage.input_tokens + a.usage.output_tokens;
    }
  }
  return counts;
}

async function parallelLimit(jobs, limit, fn, onFatal) {
  let index = 0, fatal;
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (!fatal && index < jobs.length) {
      const item = jobs[index++];
      try { await fn(item); }
      catch (err) { if (!fatal) { fatal = err; onFatal(err); } }
    }
  }));
  if (fatal) throw fatal;
}

export async function collect({ config, mode, out, authorization, chatFactory, attemptRunner, onFatal = () => {} }) {
  withinExtension(out); mkdirSync(out, { recursive: true });
  const plan = episodePlan(config, mode);
  const worlds = new Map(plan.map(e => [e.seed, makeWorld(e.seed)]));
  const answers = new Map([...worlds].map(([seed, w]) => [seed, solveWorld(w)]));
  const identity = { schema: 1, mode, config, source_manifest: sourceManifest(),
    registration_commit: authorization.registration_commit, protocol_sha256: authorization.protocol_sha256, plan,
    worlds: Object.fromEntries([...worlds].sort((a,b) => a[0]-b[0]).map(([seed, world]) => [seed, {
      world_sha256: hash(world), answer_key_sha256: hash(answers.get(seed)),
    }])) };
  const planFile = join(out, 'plan.json');
  if (existsSync(planFile)) {
    if (JSON.stringify(JSON.parse(readFileSync(planFile, 'utf8'))) !== JSON.stringify(identity)) throw new Error('Existing run identity differs; do not overwrite');
  } else writeNew(planFile, identity);
  // Persist every world and exact reference answer before any call is scheduled.
  for (const entry of plan) {
    const epDir = join(out, entry.id); mkdirSync(epDir, { recursive: true });
    for (const [name, data] of [['world.json', worlds.get(entry.seed)], ['answer-key.json', answers.get(entry.seed)]]) {
      const path = join(epDir, name);
      if (existsSync(path)) {
        if (JSON.stringify(JSON.parse(readFileSync(path, 'utf8'))) !== JSON.stringify(data)) throw new Error('Saved world/reference differs');
      } else writeNew(path, data);
    }
  }
  const reruns = [];
  const finalized = entry => existsSync(join(out, entry.id, 'final.json'));
  const readAttempt = (entry, attempt) => JSON.parse(readFileSync(join(out, entry.id, `attempt-${attempt}`, 'summary.json'), 'utf8'));
  async function attemptOnce(entry, attempt) {
    const directory = join(out, entry.id, `attempt-${attempt}`), summaryFile = join(directory, 'summary.json');
    if (existsSync(directory) && !existsSync(summaryFile)) throw new Error(`Interrupted attempt requires --mark-interrupted-technical before resume: ${entry.id}, attempt ${attempt}`);
    const args = { entry, world: worlds.get(entry.seed), config, directory, attempt };
    const alreadyRecorded = existsSync(summaryFile);
    const result = alreadyRecorded ? readAttempt(entry, attempt) : attemptRunner
      ? await attemptRunner(args) : await collectAttempt({ ...args, chat: await chatFactory(directory) });
    if (result.serving_exclusion) throw new Error('Upstream serving identity exclusion: collection stopped, no technical rerun');
    // A fresh authentication failure pauses scheduling before consuming the
    // episode rerun. Only an explicitly resumed run after normal login recovery
    // may process this saved failure. A saved attempt-2 failure is finalized;
    // the two-attempt limit never resets.
    if (!alreadyRecorded && result.status === 'technical-failure' && /^HTTP 401\b/.test(result.error || ''))
      throw new Error('Subscription HTTP 401: collection paused; restore normal login before manually resuming');
    return result;
  }
  function finalize(entry, selected) {
    const attempts = Array.from({ length: selected.attempt }, (_, i) => readAttempt(entry, i + 1))
      .map(a => ({ attempt: a.attempt, status: a.status, usage: a.usage }));
    writeNew(join(out, entry.id, 'final.json'), { ...selected,
      status: selected.status === 'technical-failure' ? 'technical-exhausted' : selected.status, attempts });
    process.stdout.write(JSON.stringify({ event: 'operational-status', ...operationalStatus(out) }) + '\n');
  }
  const abort = err => {
    const stopFile = join(out, 'halt.json');
    if (!existsSync(stopFile)) writeNew(stopFile, { error: err.message, at: new Date().toISOString() });
    onFatal(err);
  };
  await parallelLimit(plan.filter(e => !finalized(e)), config.initial_concurrency, async entry => {
    const result = await attemptOnce(entry, 1);
    if (result.status === 'technical-failure') reruns.push(entry);
    else finalize(entry, result);
  }, abort);
  // Reruns preserve the original plan order and are only started after initial attempts finish.
  const ids = new Set(reruns.map(e => e.id));
  await parallelLimit(plan.filter(e => ids.has(e.id)), config.rerun_concurrency, async entry => {
    const result = await attemptOnce(entry, 2);
    finalize(entry, result);
  }, abort);
  return operationalStatus(out);
}

export function markInterruptedTechnical(out) {
  const doc = JSON.parse(readFileSync(join(out, 'plan.json'), 'utf8'));
  let marked = 0;
  for (const entry of doc.plan) for (const attempt of [1,2]) {
    const dir = join(out, entry.id, `attempt-${attempt}`);
    if (!existsSync(dir) || existsSync(join(dir, 'summary.json'))) continue;
    const file = join(dir, 'events.jsonl');
    const events = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
    if (events.some(e => e.evt === 'llm.serving_exclusion')) throw new Error('Serving exclusion is not recoverable as ordinary interruption');
    const calls = events.filter(e => e.evt === 'llm');
    if (calls.some(e => e.served !== doc.config.model)) throw new Error('Serving identity exclusion must stop collection');
    const world = JSON.parse(readFileSync(join(out, entry.id, 'world.json'), 'utf8'));
    writeNew(join(dir, 'summary.json'), { ...entry, attempt, status: 'technical-failure', selection: null,
      error: 'Interrupted process; explicitly classified before resume', serving_exclusion: false,
      world_sha256: hash(world), answer_key_sha256: hash(solveWorld(world)), usage: {
        successful_calls: calls.length, input_tokens: calls.reduce((s,e) => s+e.ti,0), output_tokens: calls.reduce((s,e) => s+e.to,0),
        reasoning_tokens: calls.reduce((s,e) => s+(e.reasoning_tokens || 0),0), reasoning_known_calls: calls.filter(e => e.reasoning_tokens != null).length,
        served: [...new Set(calls.map(e => e.served))], cost_usd: null,
      } });
    appendFileSync(join(dir, 'recovery.jsonl'), JSON.stringify({ at: new Date().toISOString(), action: 'mark-interrupted-technical', raw_events_preserved: true }) + '\n');
    marked++;
  }
  return { interrupted_attempts_marked: marked, model_calls: 0 };
}

async function main() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i];
    if (['--execute', '--status', '--mark-interrupted-technical'].includes(key)) args[key] = true;
    else if (['--mode', '--out', '--authorization'].includes(key)) args[key] = process.argv[++i];
    else throw new Error(`Unknown argument: ${key}`);
  }
  const mode = args['--mode'] || 'formal';
  if (!['formal', 'smoke'].includes(mode)) throw new Error('Mode must be formal or smoke');
  const out = withinExtension(resolve(args['--out'] || join(HERE, 'runs', mode)));
  if (args['--status']) { process.stdout.write(JSON.stringify(operationalStatus(out), null, 2) + '\n'); return; }
  if (args['--mark-interrupted-technical']) { process.stdout.write(JSON.stringify(markInterruptedTechnical(out)) + '\n'); return; }
  if (!args['--execute']) throw new Error('No model calls authorized. Supply --execute only after explicit permission and pushed registration.');
  const authorizationPath = resolve(args['--authorization'] || '');
  const authorization = checkAuthorization(args['--authorization']);
  const config = readConfig();
  if (config.model !== 'gpt-6-astra' || config.transport !== 'codex-subscription' || config.reasoning_effort !== 'medium')
    throw new Error('Only the frozen subscription Astra transport is allowed');
  const children = new Set();
  const killChildren = () => { for (const child of children) child.kill('SIGTERM'); };
  process.on('SIGINT', () => { killChildren(); process.exit(130); });
  process.on('SIGTERM', () => { killChildren(); process.exit(143); });
  await collect({ config, mode, out, authorization, onFatal: killChildren,
    attemptRunner: ({ entry, attempt, directory }) => new Promise((resolveAttempt, reject) => {
      const child = spawn(process.execPath, [join(HERE, 'worker.mjs'), '--run', out, '--episode', entry.id,
        '--attempt', String(attempt), '--authorization', authorizationPath], { stdio: ['ignore', 'ignore', 'pipe'] });
      children.add(child); let stderr = '';
      child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-1500); });
      child.on('error', reject);
      child.on('close', code => {
        children.delete(child);
        if (code !== 0) return reject(new Error(`Attempt worker stopped for ${entry.id}; raw records preserved. ${stderr}`));
        try { resolveAttempt(JSON.parse(readFileSync(join(directory, 'summary.json'), 'utf8'))); }
        catch (err) { reject(err); }
      });
    }) });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(err => { process.stderr.write(`${err.message}\n`); process.exitCode = 1; });

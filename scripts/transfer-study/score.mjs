import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluate, rng, hash } from './task.mjs';

const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
function quantile(sorted, q) {
  const p = (sorted.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
  return sorted[lo] + (p - lo) * (sorted[hi] - sorted[lo]);
}
export function pairedInference(differences, config) {
  if (!differences.length) return { n: 0, estimate: null, ci95: null, p_two_sided: null };
  const n = differences.length, estimate = mean(differences);
  const bootRandom = rng(config.analysis_seed);
  const draws = Array.from({ length: config.bootstrap_draws }, () => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += differences[Math.floor(bootRandom() * n)];
    return sum / n;
  }).sort((a, b) => a - b);
  const signRandom = rng(config.sign_flip_seed);
  let atLeastObserved = 0;
  for (let b = 0; b < config.sign_flip_draws; b++) {
    let sum = 0;
    for (const d of differences) sum += signRandom() < 0.5 ? d : -d;
    if (Math.abs(sum / n) >= Math.abs(estimate) - 1e-12) atLeastObserved++;
  }
  return { n, estimate, ci95: [quantile(draws, 0.025), quantile(draws, 0.975)],
    p_two_sided: (atLeastObserved + 1) / (config.sign_flip_draws + 1),
    bootstrap_draws: config.bootstrap_draws, sign_flip_draws: config.sign_flip_draws,
    method: 'Paired percentile bootstrap and fixed-seed Monte Carlo sign-flip; two-sided absolute mean statistic, plus-one correction.',
    practical_effect: config.practical_effect,
    estimate_at_least_practical_effect: estimate >= config.practical_effect };
}

export function scoreRun(directory, validateOnly = false) {
  const planDoc = JSON.parse(readFileSync(join(directory, 'plan.json'), 'utf8'));
  const missing = planDoc.plan.filter(e => !existsSync(join(directory, e.id, 'final.json')));
  if (missing.length) throw new Error(`Collection incomplete (${missing.length} episodes outstanding); do not analyze outcomes yet`);
  if (planDoc.mode === 'smoke' && !validateOnly) throw new Error('Smoke is structure/transport validation only; use --validate-only and do not adapt task difficulty to smoke quality');
  const rows = planDoc.plan.map(entry => {
    const world = JSON.parse(readFileSync(join(directory, entry.id, 'world.json'), 'utf8'));
    const final = JSON.parse(readFileSync(join(directory, entry.id, 'final.json'), 'utf8'));
    if (hash(world) !== final.world_sha256) throw new Error('Saved world hash mismatch');
    const technical = final.status === 'technical-exhausted';
    const score = technical ? { normalized_utility: null, exact_optimal: null, feasible: null }
      : evaluate(world, final.status === 'submitted' ? final.selection : null);
    if (!technical && !(score.normalized_utility >= 0 && score.normalized_utility <= 1)) throw new Error('Invalid normalized utility');
    return { ...entry, status: final.status, selected_attempt: final.attempt,
      ...score, usage: final.usage, attempts: final.attempts };
  });
  if (validateOnly) return { mode: planDoc.mode, episodes: rows.length, scorer_executed: rows.filter(r => r.normalized_utility !== null).length,
    technical_exhausted: rows.filter(r => r.normalized_utility === null).length,
    result: 'Structure and scorer execution validated; no quality values or treatment effects reported.' };
  const arms = {};
  for (const arm of ['strict', 'permissive', 'full_information']) {
    const planned = rows.filter(r => r.arm === arm), available = planned.filter(r => r.normalized_utility !== null);
    arms[arm] = { planned: planned.length, nontechnical: available.length,
      technical_exhausted: planned.length - available.length,
      normalized_utility: mean(available.map(r => r.normalized_utility)),
      exact_optimal_rate: mean(available.map(r => Number(r.exact_optimal))),
      feasible_rate: mean(available.map(r => Number(r.feasible))),
      selected_attempt_tokens: mean(available.map(r => r.usage.input_tokens + r.usage.output_tokens)) };
  }
  const bySeed = new Map();
  for (const row of rows.filter(r => r.arm !== 'full_information')) {
    if (!bySeed.has(row.seed)) bySeed.set(row.seed, {});
    bySeed.get(row.seed)[row.arm] = row;
  }
  const pairs = [...bySeed].sort((a, b) => a[0] - b[0]).filter(([, p]) =>
    p.strict?.normalized_utility != null && p.permissive?.normalized_utility != null);
  const differences = pairs.map(([, p]) => p.permissive.normalized_utility - p.strict.normalized_utility);
  const allAttempts = rows.flatMap(r => r.attempts);
  return { schema: 1, study: planDoc.config.study, mode: planDoc.mode,
    primary: { contrast: 'permissive minus strict normalized feasible utility', planned_pairs: bySeed.size,
      technical_incomplete_pairs: bySeed.size - pairs.length,
      ...(pairs.length === planDoc.config.formal_seeds.last - planDoc.config.formal_seeds.first + 1
        ? { status: 'complete', ...pairedInference(differences, planDoc.config) }
        : { status: 'incomplete', n: pairs.length, estimate: null, ci95: null, p_two_sided: null,
            note: 'No confirmatory comparison: all 48 nontechnical pairs are required.' }) },
    arms, full_information_scope: 'Predetermined descriptive diagnostic with equal requester iteration and output limits, all facts supplied and no ask tool; not a cost-matched baseline.',
    resource_accounting: { attempts: allAttempts.length,
      successful_calls_across_all_attempts: allAttempts.reduce((s, a) => s + a.usage.successful_calls, 0),
      known_tokens_across_all_attempts: allAttempts.reduce((s, a) => s + a.usage.input_tokens + a.usage.output_tokens, 0),
      note: 'Transport ledgers retain all attempts, including errors and any reported upstream usage; totals here sum verified successful llm events only.' },
    rows };
}

function main() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i];
    if (key === '--validate-only') args[key] = true;
    else if (['--run', '--out'].includes(key)) args[key] = process.argv[++i];
    else throw new Error(`Unknown argument: ${key}`);
  }
  if (!args['--run']) throw new Error('--run is required');
  const result = scoreRun(resolve(args['--run']), !!args['--validate-only']);
  if (args['--out']) writeFileSync(resolve(args['--out']), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify(args['--validate-only'] ? result : {
    primary: result.primary, arms: result.arms, resource_accounting: result.resource_accounting,
  }, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (err) { process.stderr.write(`${err.message}\n`); process.exitCode = 1; }
}

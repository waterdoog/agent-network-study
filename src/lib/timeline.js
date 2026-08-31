// One episode is four beats on one timeline. T2 and T4 are the only results in
// the study that the task design does not fix in advance, so they are the point.
//
//   T1 cold build   first artifact from scratch
//   T2 rework       a constraint changes; the SAME artifact must be revised
//   T3 warm build   a second instance of the same scenario (new facts, overlapping specialists)
//   T4 warm rework  a change to the T3 artifact
import { execFile } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { buildDirectory, SCENARIOS } from './directory.js';
import { Coordinator } from './kernel.js';
import { runRequester } from './agent.js';
import { beatLine } from './log.js';

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SCORER = join(HERE, '..', 'score.js');

/** Apply a rework's fact overrides to an instance's fact list. */
function reworkedFacts(facts, rw) {
  return facts.map((f) => (rw.factOverrides?.[f.id] ? { ...f, ...rw.factOverrides[f.id] } : f));
}
/** The assertion set in force after a rework, and which of them are untouched. */
function reworkedAssertions(base, rw) {
  const over = rw.assertionOverrides || {};
  const eff = base.map((a) => (over[a.id] ? { ...a, ...over[a.id] } : a));
  return {
    assertions: eff.concat(rw.addedAssertions || []),
    untouched: new Set(base.filter((a) => !over[a.id]).map((a) => a.id)),
  };
}

async function score(html, assertions, fnName, dir, tag) {
  if (!html || html.length < 50) return { parsed: false, fnPresent: false, pass: 0, total: assertions.length, results: [], errors: ['no-artifact'] };
  const hp = join(dir, `${tag}.html`);
  const ap = join(dir, `${tag}.assertions.json`);
  writeFileSync(hp, html);
  writeFileSync(ap, JSON.stringify(assertions));
  try {
    const { stdout } = await execFileAsync(process.execPath, [SCORER, hp, ap, fnName], { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (e) {
    return { parsed: false, fnPresent: false, pass: 0, total: assertions.length, results: [], errors: [`scorer: ${String(e.message).slice(0, 200)}`] };
  }
}


/**
 * Requirement F1. Recall = pass/total. Precision = pass/(pass + wrong-but-asserted).
 * A calc assertion that returns a wrong number is an assertion, so it counts
 * against precision; one that is missing entirely only costs recall.
 */
function requirementF1(res) {
  const total = res.total || 0;
  const asserted = res.results.filter((r) => r.ok || (r.why === 'mismatch' && r.got != null)).length;
  const recall = total ? res.pass / total : 0;
  const precision = asserted ? res.pass / asserted : 0;
  return recall + precision ? (2 * recall * precision) / (recall + precision) : 0;
}

export async function runEpisode(ep) {
  const { arm, scenarioId, E, seed, outDir, log } = ep;
  const sc = SCENARIOS[scenarioId];
  const responders = new Map();
  const coord = new Coordinator({ episodeId: ep.id, arm, log });
  mkdirSync(outDir, { recursive: true });

  let notes = '';
  const beats = [];

  const plan = [
    { beat: 'T1', instance: 'A', mode: 'build' },
    { beat: 'T2', instance: 'A', mode: 'rework' },
    { beat: 'T3', instance: 'B', mode: 'build' },
    { beat: 'T4', instance: 'B', mode: 'rework' },
  ];

  let priorArtifact = null;
  let baseResultsByInstance = {};

  for (const step of plan) {
    const inst = sc.instances[step.instance];
    const isRework = step.mode === 'rework';
    const facts = isRework ? reworkedFacts(inst.facts, inst.rework) : inst.facts;
    const { assertions, untouched } = isRework
      ? reworkedAssertions(inst.assertions, inst.rework)
      : { assertions: inst.assertions, untouched: new Set() };

    // The directory is rebuilt with the current facts so a rework actually
    // changes what the holders say. Roster composition is stable across beats.
    const dir = buildDirectory({ scenario: scenarioId, instance: step.instance, E, seed });
    for (const c of dir.cards) {
      if (c.kind !== 'payload') continue;
      c.knowledge = facts.filter((f) => f.holder === c.holder).map((f) => f.text);
    }

    const goal = isRework
      ? `${inst.rework.brief}\n\nThis is a revision of the page you already produced. Keep everything that is still correct.`
      : `${inst.brief}\n\nProduce the page from scratch.`;

    const t0 = Date.now();
    log.event('beat.start', { beat: step.beat, instance: step.instance, mode: step.mode, E, arm: arm.id });

    let out;
    try {
      out = await runRequester({
        goal, spec: sc.spec, notes, dir, arm, coord, log,
        beat: step.beat, priorArtifact, responders,
      });
    } catch (err) {
      log.fail('beat.crash', err, { beat: step.beat });
      out = { html: null, notes, stats: { asks: 0, builds: 0, searches: 0, denies: 0, tokens: 0, contacted: new Set(), usefulContacts: new Set(), pollutionSeen: new Set(), iters: 0 } };
    }
    notes = out.notes || notes;

    const res = await score(out.html, assertions, sc.fn, outDir, `${step.beat}`);
    const ms = Date.now() - t0;

    // Regression: assertions the rework did not touch that passed on the
    // previous artifact and fail on this one.
    let regression = null;
    if (isRework) {
      const base = baseResultsByInstance[step.instance];
      if (base) {
        const wasOk = new Map(base.results.map((r) => [r.id, r.ok]));
        regression = res.results.filter((r) => untouched.has(r.id) && wasOk.get(r.id) === true && !r.ok).length;
      }
    } else {
      baseResultsByInstance[step.instance] = res;
    }

    const pollutionAbsorbed = countAbsorbed(out.html, inst, isRework);
    const rec = {
      beat: step.beat, mode: step.mode, instance: step.instance,
      pass: res.pass, total: res.total, parsed: res.parsed, fnPresent: res.fnPresent,
      f1: requirementF1(res), recall: res.total ? res.pass / res.total : 0,
      regression,
      asks: out.stats.asks, builds: out.stats.builds, searches: out.stats.searches,
      denies: out.stats.denies, iters: out.stats.iters,
      contacted: out.stats.contacted.size,
      useful: out.stats.usefulContacts.size,
      searchPrecision: out.stats.contacted.size ? out.stats.usefulContacts.size / out.stats.contacted.size : 0,
      pollutionSeen: out.stats.pollutionSeen.size,
      pollutionAbsorbed,
      tokens: out.stats.tokens,
      depth: coord.stats.maxDepthSeen,
      ms,
      artifactLen: out.html ? out.html.length : 0,
      failures: res.results.filter((r) => !r.ok).map((r) => r.id).slice(0, 12),
      errors: res.errors || [],
    };
    beats.push(rec);
    log.event('beat.done', rec);
    beatLine({ arm: arm.id, scenario: scenarioId, E, seed, ...rec, error: rec.errors[0] });

    priorArtifact = out.html || priorArtifact;
  }

  const byBeat = Object.fromEntries(beats.map((b) => [b.beat, b]));
  const summary = {
    ...ep.meta,
    warmSpeedup: ratio(byBeat.T1?.tokens, byBeat.T3?.tokens),
    reworkDecay: ratio(byBeat.T2?.tokens, byBeat.T4?.tokens),
    grants: coord.stats,
    beats,
  };
  log.event('ep.done', { warmSpeedup: summary.warmSpeedup, reworkDecay: summary.reworkDecay, denied: coord.stats.denied });
  return summary;
}

const ratio = (a, b) => (a && b ? 1 - b / a : null);

/** Distractor values that made it into the artifact. Ground truth by design. */
function countAbsorbed(html, inst, isRework) {
  if (!html) return 0;
  const text = html.replace(/\s+/g, ' ');
  let n = 0;
  for (const d of inst.distractors) {
    const nums = [...d.text.matchAll(/\b(\d[\d,.]*)\b/g)].map((m) => m[1]);
    if (nums.some((v) => text.includes(v))) n++;
  }
  return n;
}

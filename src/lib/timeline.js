// One episode is four beats on one timeline. T2 and T4 are the only results in
// the study that the task design does not fix in advance, so they are the point.
//
//   T1 cold build   first artifact from scratch
//   T2 rework       a constraint changes; the SAME artifact must be revised
//   T3 warm build   a second instance of the same scenario (new facts, overlapping specialists)
//   T4 warm rework  a change to the T3 artifact
import { execFile } from 'node:child_process';
import { resolveSeed } from './seeds.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { buildDirectory, SCENARIOS } from './directory.js';
import { ComponentStore } from './store.js';
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
    const { stdout } = await execFileAsync(process.execPath, [SCORER, hp, ap, fnName], { timeout: Number(process.env.STUDY_SCORER_TIMEOUT_MS || 30_000), maxBuffer: 8 * 1024 * 1024 });
    const line = stdout.split('\n').find((l) => l.startsWith('__SCORE__'));
    if (!line) throw new Error(`no result line; stdout began: ${stdout.slice(0, 60)}`);
    return JSON.parse(line.slice('__SCORE__'.length));
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
  const { arm, scenarioId, E, seed, outDir, log, profile = 'bare', k = 1, seedProfile = 'control',
          edgeCost = 0, repeats = 1, relayDepth = 0, dirSize = 100, reputation = 'off', searchCap = 40,
          beats: beatCount = 4 } = ep;
  const relSeed = resolveSeed(seedProfile);
  const sc = SCENARIOS[scenarioId];
  const responders = new Map();

  // Where an instance comes from. The hand-written scenarios ship a static
  // `instances` map; a generated scenario (payables) exposes makeInstance and
  // derives the instance from the episode seed, so the world varies across
  // seeds without a file per seed. Cached per key so T1 and T2 see one object.
  const instanceCache = new Map();
  const instanceFor = (key) => {
    if (!instanceCache.has(key)) {
      instanceCache.set(key, sc.makeInstance ? sc.makeInstance(key, seed) : sc.instances[key]);
    }
    return instanceCache.get(key);
  };
  // One store per episode. Persistent arms carry components across beats; the
  // rest forget between them, so a rework starts from bytes again.
  const store = new ComponentStore({ persistent: arm.namespace === 'persistent' });
  const compPlan = (sc.componentPlans && sc.componentPlans[k]) || null;
  const coord = new Coordinator({ episodeId: ep.id, arm, log });
  mkdirSync(outDir, { recursive: true });

  let notes = '';
  const beats = [];

  // Default is the four-beat timeline. With repeats > 1 the reworks give way to
  // that many warm builds: one warm point yields a difference, three yield a
  // slope, and the compounding claim is about the slope.
  const fullPlan = repeats > 1
    ? [{ beat: 'T1', instance: 'A', mode: 'build' },
       ...Array.from({ length: repeats }, (_, i) => ({
         beat: `W${i + 1}`, instance: String.fromCharCode(66 + i), mode: 'build',
       }))]
    : [
      { beat: 'T1', instance: 'A', mode: 'build' },
      { beat: 'T2', instance: 'A', mode: 'rework' },
      { beat: 'T3', instance: 'B', mode: 'build' },
      { beat: 'T4', instance: 'B', mode: 'rework' },
    ];
  // `beats` truncates the timeline from the front, so a cold-build-only study
  // (the payables experiment asks a T1 question) does not pay for three beats
  // it never analyses. A rework step is dropped when the instance has no rework
  // to apply: the generated scenarios define none, and running the rework
  // branch against an undefined override would crash the whole episode.
  const plan = fullPlan
    .slice(0, Math.max(1, beatCount))
    .filter((s) => s.mode !== 'rework' || instanceFor(s.instance)?.rework);

  let priorArtifact = null;
  let baseResultsByInstance = {};

  for (const step of plan) {
    const inst = instanceFor(step.instance);
    const isRework = step.mode === 'rework';
    const facts = isRework ? reworkedFacts(inst.facts, inst.rework) : inst.facts;
    const { assertions, untouched } = isRework
      ? reworkedAssertions(inst.assertions, inst.rework)
      : { assertions: inst.assertions, untouched: new Set() };

    // The directory is rebuilt with the current facts so a rework actually
    // changes what the holders say. Roster composition is stable across beats.
    const dir = buildDirectory({ scenario: scenarioId, instance: step.instance, E, seed, profile, dirSize, reputation, inst });
    for (const c of dir.cards) {
      if (c.kind !== 'payload') continue;
      c.knowledge = facts.filter((f) => f.holder === c.holder).map((f) => f.text);
    }

    store.endBeat();
    log.event('beat.dir', {
      beat: step.beat,
      roster: dir.roster.size,
      buildersInRoster: [...dir.roster].filter((x) => x.startsWith('build-')).length,
      holdersInRoster: [...dir.roster].filter((x) => x.startsWith('hold-')).length,
      holdersOutside: dir.outside.size,
    });

    const goal = isRework
      ? `${inst.rework.brief}\n\nThis is a revision of the page you already produced. Keep everything that is still correct.`
      : `${inst.brief}\n\nProduce the page from scratch.`;

    const t0 = Date.now();
    log.event('beat.start', { beat: step.beat, instance: step.instance, mode: step.mode, E, arm: arm.id });

    let out;
    let crashed = false;
    try {
      out = await runRequester({
        goal, spec: sc.spec, notes, dir, arm, coord, log, seed: relSeed,
        beat: step.beat, priorArtifact, responders,
        store, plan: compPlan, edgeCost, relayDepth, searchCap,
        // 'documents' switches the responder prompt, the store preview and the
        // build return path; anything else is the original fact-list harness.
        mode: sc.mode,
      });
    } catch (err) {
      crashed = true;
      log.fail('beat.crash', err, { beat: step.beat });
      // The requester attaches what it had counted to the error. Without that
      // the beat would record zero tokens, which is a number, not an absence;
      // tokens: null with tokensUnknown says the stats were lost.
      const empty = { asks: 0, builds: 0, searches: 0, denies: 0, tokens: null, contacted: new Set(), usefulContacts: new Set(), pollutionSeen: new Set(), iters: 0, subConsults: 0, lists: 0, reads: 0 };
      out = { html: null, notes, stats: err?.stats ? { ...empty, ...err.stats } : empty, transcript: err?.transcript };
    }
    notes = out.notes || notes;

    // What the requester asked, read and was told, one JSON per line. The
    // event log says that an ask happened; this is the only place the
    // question and the answer survive.
    if (Array.isArray(out.transcript)) {
      writeFileSync(join(outDir, `${step.beat}.transcript.jsonl`), out.transcript.map((e) => JSON.stringify(e)).join('\n') + (out.transcript.length ? '\n' : ''));
    }

    const res = await score(out.html, assertions, sc.fn, outDir, `${step.beat}`);
    const ms = Date.now() - t0;

    // Why a beat did not score, if it did not. A lost model call or a scorer
    // child that died is our failure; a requester that never submitted, or a
    // page that did not parse, is the model's. Pooling the two would let an
    // outage read as a weak arm.
    const technical = crashed || (out.stats.techFails || 0) > 0
      || (res.errors || []).some((e) => String(e).startsWith('scorer:'));
    const failureKind = technical ? 'technical' : res.parsed ? 'none' : 'model';

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

    const pol = countAbsorbed(out.html, isRework ? { ...inst, facts } : inst, out.stats.pollutionSeen);
    const rec = {
      beat: step.beat, mode: step.mode, instance: step.instance,
      pass: res.pass, total: res.total, parsed: res.parsed, fnPresent: res.fnPresent,
      f1: requirementF1(res), recall: res.total ? res.pass / res.total : 0,
      regression,
      asks: out.stats.asks, builds: out.stats.builds, searches: out.stats.searches,
      lists: out.stats.lists || 0, reads: out.stats.reads || 0,
      denies: out.stats.denies, iters: out.stats.iters, subConsults: out.stats.subConsults || 0,
      // The two knobs added for the scaling question. Both fired correctly but
      // neither reached the beat record, so an analysis reading summaries saw
      // zero and an analysis reading events saw hundreds.
      handshakes: out.stats.handshakes || 0,
      relays: out.stats.relays || 0,
      relayReach: out.stats.relayTargets ? out.stats.relayTargets.size : 0,
      contacted: out.stats.contacted.size,
      useful: out.stats.usefulContacts.size,
      searchPrecision: out.stats.contacted.size ? out.stats.usefulContacts.size / out.stats.contacted.size : 0,
      inlineBytes: out.stats.inlineBytes || 0,
      storeReads: out.stats.storeReads || 0,
      storeWrites: store.stats().writes,
      k,
      pollutionSeen: out.stats.pollutionSeen.size,
      pollutionAbsorbed: pol.absorbed,
      wrongInvented: pol.invented,
      tokens: out.stats.tokens == null ? null : out.stats.tokens,
      tokensUnknown: out.stats.tokens == null,
      failureKind,
      techFails: out.stats.techFails || 0,
      depth: coord.stats.maxDepthSeen,
      ms,
      artifactLen: out.html ? out.html.length : 0,
      failures: res.results.filter((r) => !r.ok).map((r) => r.id).slice(0, 12),
      // `failures` is capped to keep the console line readable. An analysis
      // that scores per order (payables: three assertions per order, six
      // orders) needs every failed id, so the uncapped list rides alongside.
      failedAll: res.results.filter((r) => !r.ok).map((r) => r.id),
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
/**
 * Did the artifact take a distractor's value instead of the true one?
 *
 * The previous version counted a distractor as absorbed if ANY number from its
 * sentence appeared in the page. Distractor sentences carry incidental numbers
 * — dates, counts, years — that a correct page also contains, so it fired on
 * correct pages and could report more absorbed than the agent ever saw. It was
 * a false-positive detector, and it is why absorption sat flat at 2-3 in every
 * cell.
 *
 * A distractor names the fact it contradicts via `flips`. The wrong value is
 * whatever number it carries that the true fact does not. Absorbed means the
 * page shows that wrong value and does not show the true one; a page showing
 * both is ambiguous and is not counted.
 */
export function countAbsorbed(html, inst, seenTexts = null) {
  if (!html) return { absorbed: 0, invented: 0 };
  // Thousands separators are normalised away on both sides so "1,200" on the
  // page matches "1200" in a fact, and vice versa.
  const text = html.replace(/\s+/g, ' ').replace(/(\d),(?=\d{3}\b)/g, '$1');
  const nums = (t) => [...String(t).replace(/(\d),(?=\d{3}\b)/g, '$1').matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((m) => m[1]);
  // Bounded by digits only, not by punctuation: "2027" must not satisfy a
  // distractor whose wrong value is 20, but "seats 850." at the end of a
  // sentence must still count.
  const shows = (v) => new RegExp(`(?<!\\d)${v.replace(/\./g, '\\.')}(?!\\d)`).test(text);
  let absorbed = 0, invented = 0;
  for (const d of inst.distractors) {
    const truth = inst.facts.find((f) => f.id === d.flips);
    if (!truth) continue;                       // nothing to contradict: skip
    const trueNums = new Set(nums(truth.text));
    const wrong = nums(d.text).filter((v) => !trueNums.has(v));
    if (!wrong.length) continue;                // no distinguishing value
    const tookWrong = wrong.some(shows);
    const hasTruth = [...trueNums].some(shows);
    if (!tookWrong || hasTruth) continue;
    // A wrong value in the artifact means one of two different things, and the
    // artifact alone cannot tell them apart: the agent adopted misinformation
    // it was given, or it invented a number that happens to equal a distractor
    // — the distractors were written to sound plausible, so a guess lands on
    // one easily. Only a distractor the episode actually encountered counts as
    // absorbed; the rest is fabrication, and is reported as its own quantity.
    if (seenTexts && !seenTexts.has(d.text)) invented++;
    else absorbed++;
  }
  return { absorbed, invented };
}

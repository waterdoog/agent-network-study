import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeWorld, factsFor, publicTask, solveWorld, scoreSelection, evaluate, episodePlan, hash } from './task.mjs';
import { runEpisode, TechnicalFailure } from './engine.mjs';
import { readConfig, collectAttempt, collect } from './run.mjs';
import { HERE, sourceManifest, checkAuthorization, digest } from './manifest.mjs';
import { pairedInference, scoreRun } from './score.mjs';
const config = readConfig();
const tmp = mkdtempSync(join(HERE, '.offline-test-'));
const tool = (name, args, id = 'call-1') => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
const response = calls => ({ message: { role: 'assistant', content: null, ...(calls ? { tool_calls: calls } : {}) }, finish: calls ? 'tool_calls' : 'stop', tokensIn: 10, tokensOut: 5 });
const events = () => ({ rows: [], event(evt, data) { this.rows.push({ evt, ...structuredClone(data) }); } });
let checks = 0;
try {
  const formal = episodePlan(config, 'formal'), smoke = episodePlan(config, 'smoke');
  assert.equal(formal.length, 108); assert.equal(smoke.length, 6);
  assert.equal(formal.filter(e => e.arm === 'full_information').length, 12);
  assert.deepEqual(formal.filter(e => e.arm === 'full_information').map(e => e.seed).sort((a,b) => a-b), Array.from({ length: 12 }, (_, i) => 1001 + 4*i));
  assert.deepEqual(formal, episodePlan(config, 'formal')); checks++;

  const signatures = new Set();
  for (let seed = 1; seed <= 1100; seed++) {
    const w = makeWorld(seed), s = solveWorld(w);
    assert.deepEqual(w, makeWorld(seed));
    assert.equal(s.enumerated_subsets, 256);
    assert(s.optimum > 0);
    signatures.add(JSON.stringify([w.projects, w.conflict, w.synergy]));
    // Independent recursive subset enumeration using direct arithmetic.
    let independent = 0;
    function visit(i, selected) {
      if (i < w.projects.length) { visit(i+1, selected); visit(i+1, [...selected, w.projects[i]]); return; }
      const ids = selected.map(p => p.id);
      if (selected.length > 3 || selected.reduce((s,p) => s+p.cost,0) > w.budgets.funds
        || selected.reduce((s,p) => s+p.hours,0) > w.budgets.hours || w.conflict.every(id => ids.includes(id))) return;
      independent = Math.max(independent, selected.reduce((s,p) => s+p.benefit,0) + (w.synergy.pair.every(id => ids.includes(id)) ? w.synergy.bonus : 0));
    }
    visit(0, []); assert.equal(s.optimum, independent);
    for (const selected of s.optimal_selections) assert.equal(evaluate(w, selected).normalized_utility, 1);
    assert.equal(evaluate(w, []).normalized_utility, 0);
    assert.equal(evaluate(w, null).normalized_utility, 0);
    assert.equal(evaluate(w, ['unknown']).normalized_utility, 0);
    assert.equal(evaluate(w, ['P1','P1']).normalized_utility, 0);
    assert.equal(evaluate(w, w.conflict).normalized_utility, 0);
    assert.equal(evaluate(w, w.projects.map(p => p.id)).normalized_utility, 0);
    assert.equal(Object.hasOwn(publicTask(w), 'projects'), true);
    assert.deepEqual(publicTask(w).projects.every(x => typeof x === 'string'), true);
    assert.equal(w.holders.length, 3);
    assert.equal(new Set(w.holders.map(h => h.domain)).size, 3);
    for (const h of w.holders) assert(Object.keys(factsFor(w, h.id)).length > 0);
  }
  assert.equal(signatures.size, 1100); checks++;

  const world = makeWorld(1), optimum = solveWorld(world).optimal_selections[0];
  const requests = [];
  let reqs = 0;
  const log = events();
  const success = await runEpisode({ world, arm: 'strict', config, log, chat: async req => {
    requests.push(structuredClone({ messages: req.messages, tools: req.tools, maxTokens: req.maxTokens, tag: req.tag }));
    if (req.tag.startsWith('holder.')) return { ...response(), message: { role: 'assistant', content: 'Saved synthetic answer' } };
    reqs++;
    return response(reqs === 1 ? [tool('ask_agent', { holder_id: world.holders[0].id, question: 'Give all values in your domain' })]
      : [tool('submit_selection', { project_ids: optimum })]);
  } });
  assert.equal(success.status, 'submitted'); assert.equal(success.asks, 1); assert.equal(success.calls, 3);
  assert.equal(requests.find(r => r.tag.startsWith('holder.')).maxTokens, 900);
  assert.equal(requests.find(r => r.tag.startsWith('requester.')).maxTokens, 3000);
  assert(!requests[0].messages[1].content.includes('"cost":'));
  assert(log.rows.some(r => r.evt === 'model.request' && r.caller_request_sha256)); checks++;

  const questionBudgets = [];
  const bounded = await runEpisode({ world, arm: 'permissive', config, log: events(), chat: async req => {
    if (req.tag.startsWith('holder.')) return { ...response(), message: { role: 'assistant', content: 'facts' } };
    questionBudgets.push(req.tools.map(t => t.function.name));
    return response(questionBudgets.length === 1 ? Array.from({ length: 10 }, (_, i) => tool('ask_agent', { holder_id: world.holders[0].id, question: 'Facts?' }, `q${i}`))
      : [tool('submit_selection', { project_ids: [] })]);
  } });
  assert.equal(bounded.asks, 6); assert.deepEqual(questionBudgets[1], ['submit_selection']); checks++;

  const fullRequests = [];
  const full = await runEpisode({ world, arm: 'full_information', config, log: events(), chat: async req => {
    fullRequests.push(structuredClone({ messages: req.messages, tools: req.tools }));
    return fullRequests.length < 8 ? response() : response([tool('submit_selection', { project_ids: optimum })]);
  } });
  assert.equal(full.status, 'submitted'); assert.equal(full.iterations, 8); assert.equal(full.asks, 0);
  assert(fullRequests.every(r => r.tools.length === 1 && r.tools[0].function.name === 'submit_selection'));
  assert(fullRequests[0].messages[1].content.includes('specialist_facts')); checks++;
  const never = await runEpisode({ world, arm: 'strict', config, log: events(), chat: async () => response() });
  assert.equal(never.status, 'model-no-submission'); assert.equal(never.iterations, 8); checks++;
  await assert.rejects(runEpisode({ world, arm: 'strict', config, log: events(), chat: async () => { throw new Error('mock transport failure'); } }), TechnicalFailure); checks++;

  const called = [];
  const out = join(tmp, 'collection');
  const small = { ...config, smoke_seeds: [1] };
  await collect({ config: small, mode: 'smoke', out, authorization: { registration_commit: '0'.repeat(40), protocol_sha256: 'offline-test' },
    chatFactory: async dir => req => {
      called.push(dir);
      if (dir.endsWith('attempt-1') && dir.includes('_strict/')) throw new Error('Mock technical failure');
      req.log.event('llm', { tag: req.tag, served: config.model, ti: 10, to: 5, reasoning_tokens: 2 });
      return Promise.resolve(response([tool('submit_selection', { project_ids: [] })]));
    } });
  const strict = JSON.parse(readFileSync(join(out, 'W1_strict/final.json')));
  assert.equal(strict.attempt, 2); assert.equal(strict.attempts[0].status, 'technical-failure');
  const before = called.length;
  await collect({ config: small, mode: 'smoke', out, authorization: { registration_commit: '0'.repeat(40), protocol_sha256: 'offline-test' }, chatFactory: async () => { throw new Error('Resume must not rerun completed episodes'); } });
  assert.equal(called.length, before);
  assert.equal(scoreRun(out, true).episodes, 3);
  assert.throws(() => scoreRun(out), /Smoke/); checks++;

  // A parseable submission, even infeasible, ends immediately with no repair feedback.
  let submitCalls = 0;
  const invalid = await runEpisode({ world, arm: 'strict', config, log: events(), chat: async () => {
    submitCalls++; return response([tool('submit_selection', { project_ids: ['P1','P1'] }),
      tool('ask_agent', { holder_id: world.holders[0].id, question: 'Do I satisfy constraints?' })]);
  } });
  assert.equal(submitCalls, 1); assert.equal(invalid.asks, 0); assert.equal(invalid.status, 'submitted');
  assert.equal(evaluate(world, invalid.selection).normalized_utility, 0);
  const seenTools = [];
  const truncated = await runEpisode({ world, arm: 'strict', config, log: events(), chat: async req => {
    seenTools.push(req.tools.map(t => t.function.name)); return { ...response(), finish: 'length' };
  } });
  assert.equal(truncated.status, 'model-no-submission'); assert.deepEqual(seenTools[7], ['submit_selection']); checks++;

  let exclusions = 0, stopped = false;
  const excludedDir = join(tmp, 'excluded');
  await assert.rejects(collect({ config: { ...small, initial_concurrency: 1 }, mode: 'smoke', out: excludedDir,
    authorization: { registration_commit: '0'.repeat(40), protocol_sha256: 'offline-test' },
    onFatal: () => { stopped = true; }, chatFactory: async () => req => {
      exclusions++; req.log.event('llm.serving_exclusion', { served: 'wrong-model' });
      throw new Error('Serving model mismatch');
    } }), /serving identity exclusion/);
  assert.equal(exclusions, 1); assert.equal(stopped, true); checks++;

  // A fresh 401 pauses before consuming the one rerun. Saved 401 records do
  // not repeat the pause when an operator explicitly resumes after login recovery.
  const authConfig = { ...small, initial_concurrency: 1, rerun_concurrency: 1 };
  const authPlan = episodePlan(authConfig, 'smoke'), authTarget = authPlan[0];
  const authDir = join(tmp, 'authentication-pause');
  let authCalls = 0;
  const authArgs = { config: authConfig, mode: 'smoke', out: authDir,
    authorization: { registration_commit: '0'.repeat(40), protocol_sha256: 'offline-test' } };
  await assert.rejects(collect({ ...authArgs, chatFactory: async () => async () => {
    authCalls++; throw new Error('HTTP 401: login expired');
  } }), /HTTP 401: collection paused/);
  assert.equal(authCalls, 1);
  assert(existsSync(join(authDir, authTarget.id, 'attempt-1', 'summary.json')));
  assert(!existsSync(join(authDir, authTarget.id, 'attempt-2')));
  await collect({ ...authArgs, chatFactory: async () => async req => {
    authCalls++; req.log.event('llm', { tag: req.tag, served: config.model, ti: 10, to: 5 });
    return response([tool('submit_selection', { project_ids: [] })]);
  } });
  const recovered = JSON.parse(readFileSync(join(authDir, authTarget.id, 'final.json')));
  assert.equal(recovered.attempt, 2); assert.equal(recovered.status, 'submitted');
  assert.equal(recovered.attempts.length, 2); checks++;

  // A new 401 on attempt 2 also pauses; the next explicit resume finalizes
  // technical exhaustion from the saved record without ever making attempt 3.
  const twiceDir = join(tmp, 'authentication-twice');
  const twiceArgs = { ...authArgs, out: twiceDir };
  let targetCalls = 0;
  const failingAuth = async dir => async req => {
    if (dir.includes('/' + authTarget.id + '/')) { targetCalls++; throw new Error('HTTP 401: login expired'); }
    req.log.event('llm', { tag: req.tag, served: config.model, ti: 10, to: 5 });
    return response([tool('submit_selection', { project_ids: [] })]);
  };
  await assert.rejects(collect({ ...twiceArgs, chatFactory: failingAuth }), /HTTP 401: collection paused/);
  await assert.rejects(collect({ ...twiceArgs, chatFactory: failingAuth }), /HTTP 401: collection paused/);
  assert.equal(targetCalls, 2);
  await collect({ ...twiceArgs, chatFactory: async () => { throw new Error('Saved attempt 2 must not call model'); } });
  const exhausted = JSON.parse(readFileSync(join(twiceDir, authTarget.id, 'final.json')));
  assert.equal(exhausted.status, 'technical-exhausted'); assert.equal(exhausted.attempt, 2);
  assert(!existsSync(join(twiceDir, authTarget.id, 'attempt-3'))); checks++;

  // Technical incompleteness must not silently become a complete-case primary analysis.
  const fixture = join(tmp, 'formal-fixture'); mkdirSync(fixture);
  writeFileSync(join(fixture, 'plan.json'), JSON.stringify({ mode: 'formal', config, plan: formal }));
  const fakeUsage = { successful_calls: 1, input_tokens: 10, output_tokens: 5, served: [config.model] };
  for (const e of formal) {
    const d = join(fixture, e.id); mkdirSync(d); const w = makeWorld(e.seed);
    writeFileSync(join(d, 'world.json'), JSON.stringify(w));
    writeFileSync(join(d, 'final.json'), JSON.stringify({ ...e, status: 'submitted', selection: [], attempt: 1,
      usage: fakeUsage, attempts: [{ attempt: 1, status: 'submitted', usage: fakeUsage }], world_sha256: hash(w) }));
  }
  assert.equal(scoreRun(fixture).primary.status, 'complete');
  const missingEntry = formal.find(e => e.arm === 'strict');
  const fp = join(fixture, missingEntry.id, 'final.json'), fr = JSON.parse(readFileSync(fp));
  fr.status = 'technical-exhausted'; writeFileSync(fp, JSON.stringify(fr));
  const incomplete = scoreRun(fixture).primary;
  assert.equal(incomplete.status, 'incomplete'); assert.equal(incomplete.n, 47);
  assert.equal(incomplete.ci95, null); assert.equal(incomplete.p_two_sided, null); checks++;

  const noAuth = spawnSync(process.execPath, [join(HERE, 'run.mjs')], { encoding: 'utf8' });
  assert.notEqual(noAuth.status, 0); assert(noAuth.stderr.includes('No model calls authorized'));
  assert.throws(() => checkAuthorization(), /authorization/);
  const protocol = join(tmp, 'protocol.txt'); writeFileSync(protocol, 'offline test');
  const auth = join(tmp, 'auth.json');
  const manifest = sourceManifest();
  writeFileSync(auth, JSON.stringify({ authorized: true, registration_commit: '0'.repeat(40), protocol_file: protocol,
    protocol_sha256: digest(readFileSync(protocol)), source_manifest: manifest }));
  assert.equal(checkAuthorization(auth).authorized, true);
  writeFileSync(protocol, 'changed'); assert.throws(() => checkAuthorization(auth), /Protocol differs/); checks++;

  const allZero = pairedInference(Array(48).fill(0), config);
  assert.equal(allZero.estimate, 0); assert.deepEqual(allZero.ci95, [0,0]); assert.equal(allZero.p_two_sided, 1);
  const positive = pairedInference(Array(48).fill(.25), config);
  assert.equal(positive.estimate, .25); assert.deepEqual(positive.ci95, [.25,.25]); assert(positive.p_two_sided < .001);
  assert.deepEqual(positive, pairedInference(Array(48).fill(.25), config)); checks++;
  process.stdout.write(JSON.stringify({ offline_test_groups: checks, worlds_checked: 1100, formal_episodes: formal.length,
    live_model_calls: 0, result: 'passed' }, null, 2) + '\n');
} finally { rmSync(tmp, { recursive: true, force: true }); }

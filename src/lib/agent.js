// The harness: one tool loop, used by every agent in every arm. The requester
// runs it with the coordination tools; responders and builders run a single
// turn of it with no tools. Nothing about the arm is decided here — the arm
// only shows up as which tools exist and what the Coordinator allows.
import { chat } from './openrouter.js';
import { requesterSeedLines, responderSeedLines } from './seeds.js';
import { searchCards } from './directory.js';
import { effectiveArm } from './arms.js';
import { buildBrief } from './store.js';
import { createHash } from 'node:crypto';

const BASE_ITERS = Number(process.env.STUDY_MAX_ITERS || 22);
// Documents mode has its own budget: the store route there is search plus a
// list and a read per desk, thirteen turns for six desks, and a must-build gate
// at 60% of 22 fired at turn 13 -- on top of the route, not after it.
const BASE_ITERS_DOCS = Number(process.env.STUDY_MAX_ITERS_DOCS || 30);
const MAX_ARTIFACT_ECHO = 9000;
// Transcript entries keep a tool result to this many characters. Enough to
// hold a full documents answer or a folder read; not the raw 60k the model saw.
const TRANSCRIPT_RESULT_CHARS = 4000;

const TOOLS = ({ phase, arm, plan, mode = 'facts' }) => {
  const docs = mode === 'documents';
  const t = [
    {
      type: 'function',
      function: {
        name: 'search_directory',
        description: 'Find agents by skill. Returns id, name and skills. Search before contacting anyone.',
        parameters: { type: 'object', properties: { query: { type: 'string', description: 'skills or topic, e.g. "registration pricing group discount"' } }, required: ['query'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ask_agent',
        description: 'Ask one agent one question and get its answer. Only that agent\'s own knowledge is available to it.',
        parameters: { type: 'object', properties: { card_id: { type: 'string' }, question: { type: 'string' } }, required: ['card_id', 'question'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'delegate_build',
        // Documents mode never hands the page back: the receipt is the return
        // value in every arm, and the description must not promise otherwise.
        description: docs
          ? 'Hand the build to a builder agent. The finished page is written to the component store and you receive a receipt. Include every fact and number the builder needs; the builder cannot look anything up.'
          : 'Hand the build to a builder agent and receive the finished HTML document. Include every fact and number the builder needs; the builder cannot look anything up.',
        parameters: { type: 'object', properties: {
          card_id: { type: 'string' },
          // An enum, not a free string: the model otherwise invents names like
          // "full page", which match no component, so the dependency lookup
          // silently returns nothing and the mechanism never fires. With a
          // single component in documents mode the same applies to the submit
          // path, which recovers the page from the store by name.
          component: plan && plan.length > 1
            ? { type: 'string', enum: plan.map((c) => c.name), description: 'which component of the deliverable this build produces' }
            : docs
              ? { type: 'string', enum: [plan?.[0]?.name || 'page'], description: 'the single component of this deliverable' }
              : { type: 'string', description: 'name of the component (use "page")' },
          instructions: { type: 'string' },
        }, required: ['card_id', 'component', 'instructions'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'write_notes',
        description: 'Append to your own working notes. They persist across every task you do. Record which agents were useful for what.',
        parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'submit',
        description: 'Submit the deliverable. If the components live in a store you do not need to paste anything: call submit with an empty html and the assembled component is taken from the store.',
        parameters: { type: 'object', properties: { html: { type: 'string', description: 'the full document, or empty when a store holds the components' } }, required: [] },
      },
    },
  ];
  // The access axis. Under 'store' the requester may enumerate and read what a
  // counterpart holds; under 'sandbox' it may only ask, and the counterpart
  // answers the question it was asked.
  if (arm && arm.access === 'store') {
    t.push({
      type: 'function',
      function: {
        name: 'list_store',
        description: 'List the titles of everything an agent holds. Faster than asking when you do not yet know what it has.',
        parameters: { type: 'object', properties: { card_id: { type: 'string' } }, required: ['card_id'] },
      },
    }, {
      type: 'function',
      function: {
        name: 'read_store',
        description: 'Read one item from an agent\'s store verbatim, by the index shown in list_store. Omit index to read everything it holds.',
        parameters: { type: 'object', properties: { card_id: { type: 'string' }, index: { type: 'integer' } }, required: ['card_id'] },
      },
    });
  }
  return t.filter((x) => ALLOWED[phase].has(x.function.name));
};

// Narrowing the offered tool list is not enough: a model that saw a tool earlier
// keeps emitting it, and a dispatcher that executes whatever arrives silently
// undoes the phase. The phase is enforced here, on the call, not on the menu.
const ALLOWED = {
  open: new Set(['search_directory', 'ask_agent', 'delegate_build', 'write_notes', 'submit', 'list_store', 'read_store']),
  'must-build': new Set(['delegate_build', 'submit']),
  'must-submit': new Set(['submit']),
};

/**
 * Run one beat as the requester.
 * @returns {{html:string|null, stats:object}}
 */
export async function runRequester({ goal, spec, notes, dir, arm, coord, log, beat, priorArtifact, responders, store, plan, seed, edgeCost = 0, relayDepth = 0, searchCap = 40, mode = 'facts' }) {
  // 'documents': holders keep whole documents rather than one-line facts, so the
  // responder answers as a records keeper, the store lists document headers,
  // and a build is a receipt in every arm. Anything else is the original harness.
  const docs = mode === 'documents';
  // Five components cannot be delegated inside a budget sized for one.
  const MAX_ITERS = (docs ? BASE_ITERS_DOCS : BASE_ITERS) + 4 * Math.max(0, (plan?.length || 1) - 1);
  // The turn after which only delegate_build and submit are accepted.
  const MUST_BUILD_AT = Math.floor(MAX_ITERS * 0.6);
  const stats = {
    asks: 0, builds: 0, searches: 0, denies: 0, tokens: 0, contacted: new Set(),
    usefulContacts: new Set(), pollutionSeen: new Set(), iters: 0, depth: 0, subConsults: 0,
    formedEdges: new Map(), handshakes: 0, relays: 0, relayTargets: new Set(),
    // Model calls that failed after retries in this beat. A beat that lost a
    // call is a technical failure, not a model one, and the two must not be
    // pooled in the analysis.
    techFails: 0,
  };
  // What the requester saw and did, persisted per beat by the timeline. The
  // event log records that a question was asked; this records the question and
  // the answer, which is what a post-hoc reading of a failed beat needs.
  const transcript = [];
  let html = null;
  let lastBuilt = null;

  // The component the submit path recovers from the store. In documents mode
  // only a copy written in this beat counts -- a persistent store still holds
  // the previous beat's page -- and a miss under the expected name falls back
  // to the most recently written item of this beat, so a name the model chose
  // does not lose the beat. Outside documents mode this is the original lookup.
  const finalName = plan && plan.length > 1
    ? (plan.find((c) => c.assembles)?.name || plan[plan.length - 1].name)
    : (plan?.[0]?.name || 'page');
  const storedFinal = () => {
    if (!store) return null;
    const it = store.read(finalName);
    if (!docs) return it ? { name: finalName, html: it.html } : null;
    if (it && it.beat === beat) return { name: finalName, html: it.html };
    const last = store.list().filter((x) => x.beat === beat).pop();
    return last ? { name: last.name, html: store.read(last.name).html } : null;
  };

  const sys = [
    'You coordinate other agents to produce a deliverable. You have no knowledge of your own about this task.',
    'Every fact you need is held by some other agent in the directory.',
    // The workflow sentence has to name both routes when both exist, or the
    // "does an agent use the store affordance" question is unanswerable: the
    // agent would just be obeying the one route we told it about.
    ...(arm && arm.access === 'store'
      ? ['Two routes are open to you: ask an agent a specific question, or read an agent\'s store directly with list_store and read_store. Both cost you a turn. Use whichever you judge better, then hand a complete brief to a builder.']
      : ['Search, ask a specific question, then hand a complete brief to a builder.']),
    'Agents can be wrong. If two agents contradict each other, prefer the one whose stated role owns that subject.',
    // Naming the field is the fair version of the test. Leaving it unexplained
    // would measure whether a model notices an undocumented key, not whether a
    // reputation signal changes routing.
    ...(dir.cards.some((c) => c.reputation)
      ? ['Search results carry a reputation line per agent, from how often its past answers held up.']
      : []),
    // In documents mode the sandbox baseline is allowed to be good: a holder
    // may be asked about several orders at once and answers from its folder.
    // Saying so is what makes the ask route a fair counterpart to reading.
    // The build receipt line is the same in every arm, which is the point.
    ...(docs ? [
      'Agents hold documents in their own folders. You may ask one agent about several orders or fields in one question; it answers from its documents and cites their ids.',
      'A finished build is kept in a component store, not returned to you: after delegate_build, call submit with an empty html and the stored page is submitted.',
    ] : []),
    'The builder cannot look anything up: every number it needs must be in your instructions.',
    'Work efficiently. Do not ask an agent something you already know.',
    `You get at most ${MAX_ITERS} turns for the whole task. Gather what you need, then delegate the build and submit.`,
    // The gate at 60% is a fact about the harness; a prompt that promises the
    // whole budget for gathering is measuring how a model copes with a
    // surprise. Stated in every arm, in documents mode only, so the hand-written
    // scenarios keep the prompt they were run with.
    ...(docs ? [`You must have delegated the build by turn ${MUST_BUILD_AT}; after that only delegate_build and submit are available.`] : []),
    'Budget your turns: leave at least three for delegate_build and submit.',
    '',
    ...(plan && plan.length > 1 ? [
      '',
      'This deliverable is built as separate components. Delegate each one, naming it in the `component` argument:',
      ...plan.map((c) => `  ${c.name}${c.deps.length ? `  (depends on: ${c.deps.join(', ')})` : ''}`),
      'Build a component only after the ones it depends on. The last one assembles the final document.',
    ] : []),
    ...requesterSeedLines(seed),
    '',
    'DELIVERABLE SPEC (the page must satisfy this exactly):',
    spec,
  ].join('\n');

  const task = [
    `TASK: ${goal}`,
    notes ? `\nYOUR NOTES FROM EARLIER WORK:\n${notes}` : '',
    priorArtifact ? `\nYou previously produced a version of this page. It is ${priorArtifact.length} characters long; the builder you used may still have it.` : '',
  ].filter(Boolean).join('\n');
  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: task },
  ];
  // The system prompt is long and identical across the beats of a cell, so the
  // transcript keeps its hash and length rather than its text.
  transcript.push({ role: 'system', sha256: createHash('sha256').update(sys).digest('hex'), length: sys.length });
  transcript.push({ role: 'user', text: task });

  // Documents mode: the requester holds no HTML of its own, so a nudge that
  // asks for "the finished HTML" asks for something it does not have.
  const submitNudge = docs
    ? 'Call submit with an empty html now; the stored page is submitted.'
    : 'Submit the finished HTML now.';
  const continueNudge = docs
    ? 'Continue. Use a tool, or call submit with an empty html; the stored page is submitted.'
    : 'Continue. Use a tool, or call submit with the finished HTML.';

  let lastPhase = 'open';
  try {
    for (let i = 0; i < MAX_ITERS && html == null; i++) {
      stats.iters = i + 1;
      const phase = stats.builds === 0 && i >= MUST_BUILD_AT ? 'must-build'
        : lastBuilt && i >= Math.floor(MAX_ITERS * 0.85) ? 'must-submit'
        : 'open';
      if (phase !== 'open' && phase !== lastPhase) {
        log.event('req.phase', { phase, iter: i, beat });
        messages.push({ role: 'user', content: phase === 'must-build'
          ? `You have used ${i} of ${MAX_ITERS} turns. Stop gathering: delegate the build now with everything you have, then submit.`
          : submitNudge });
        lastPhase = phase;
      }

      let res;
      try {
        res = await chat({ messages, tools: TOOLS({ phase, arm, plan, mode }), log, tag: `req.i${i}`, maxTokens: 6000 });
      } catch (err) {
        stats.techFails++;
        log.fail('req.llm', err, { beat, iter: i });
        break;
      }
      stats.tokens += res.tokensIn + res.tokensOut;
      const msg = res.message;
      messages.push(msg);
      if (msg.content) transcript.push({ role: 'assistant', text: String(msg.content).slice(0, TRANSCRIPT_RESULT_CHARS) });

      const calls = msg.tool_calls || [];
      if (!calls.length) {
        // No tool call and no submission: nudge once, then give up on this beat.
        if (i >= MAX_ITERS - 2) break;
        messages.push({ role: 'user', content: continueNudge });
        continue;
      }

      for (const call of calls) {
        const name = call.function?.name;
        let args = {};
        try { args = JSON.parse(call.function?.arguments || '{}'); }
        catch (e) { log.event('tool.badargs', { name, raw: String(call.function?.arguments).slice(0, 200) }); }

        let result;
        if (!ALLOWED[phase].has(name)) {
          log.event('tool.blocked', { name, phase, iter: i, beat });
          result = { error: `${name} is not available at this stage. Call delegate_build with everything you have, then submit.` };
        } else if (name === 'search_directory') {
          stats.searches++;
          const hits = searchCards(dir, arm, args.query, searchCap);
          // Record whether relational metadata actually went into the model's
          // context, not just whether the config said it should. A manipulation
          // you cannot see in the log is a manipulation you cannot defend.
          const withRel = hits.filter((h) => h.relationship).length;
          log.event('tool.search', { q: String(args.query).slice(0, 80), n: hits.length, rel: withRel, beat });
          result = { cards: hits };
        } else if (name === 'ask_agent' || name === 'delegate_build') {
          const r = await contact({ name, args, dir, arm, coord, log, beat, stats, responders, priorArtifact, store, plan, seed, edgeCost, relayDepth, mode });
          if (r && r.html) lastBuilt = r.html;
          // Documents mode returns a receipt in every arm, so the built page is
          // tracked from the store copy instead; the must-submit nudge and the
          // built-but-never-submitted fallback then fire the same way in all four.
          if (docs && r && r.ok && r.component && store) lastBuilt = store.read(r.component)?.html || lastBuilt;
          result = r;
        } else if (name === 'list_store' || name === 'read_store') {
          result = await readStore({ name, args, dir, arm, coord, log, beat, stats, mode });
        } else if (name === 'write_notes') {
          notes = `${notes || ''}\n${args.text}`.trim().slice(-4000);
          log.event('tool.notes', { len: notes.length, beat });
          result = { ok: true };
        } else if (name === 'submit') {
          const missing = plan && plan.length > 1
            ? plan.map((c) => c.name).filter((n) => !store?.read(n))
            : [];
          if (missing.length) {
            log.event('submit.blocked', { missing: missing.join(','), beat });
            result = { error: `These components have not been built yet: ${missing.join(', ')}. Delegate each one before submitting.` };
          } else {
            const pasted = String(args.html || '');
            html = pasted;
            const it = docs || !pasted ? storedFinal() : null;
            if (docs && it && pasted) {
              // The requester was told the store holds the page; a pasted copy
              // is a re-typed one, and the receipt route is the one under test.
              html = it.html;
              log.event('submit.pasted', { comp: it.name, pasted: pasted.length, len: html.length, beat });
            } else if (!pasted && it) {
              html = it.html;
              log.event('submit.fromstore', { comp: it.name, len: html.length, beat });
            }
            log.event('tool.submit', { len: html.length, beat });
            result = { ok: true, received: html.length };
          }
        } else {
          result = { error: `unknown tool ${name}` };
        }

        const payload = JSON.stringify(result);
        transcript.push({ role: 'tool', tool: name, args, result: payload.slice(0, TRANSCRIPT_RESULT_CHARS) });
        messages.push({ role: 'tool', tool_call_id: call.id, content: payload.slice(0, 60000) });
      }
    }
  } catch (err) {
    // The timeline records the beat as crashed; what was spent and seen before
    // the crash rides along, so the record does not say "zero tokens".
    if (err && typeof err === 'object') { err.stats = stats; err.transcript = transcript; }
    throw err;
  }

  if (html == null) {
    const it = storedFinal();
    if (it) { html = it.html; log.event('req.fallback', { why: 'from-store', comp: it.name, len: html.length, beat }); }
  }
  if (html == null && lastBuilt) {
    html = lastBuilt;
    log.event('req.fallback', { why: 'built-but-never-submitted', len: html.length, beat });
  }
  return { html, notes, stats, transcript };
}



/** One authorized contact with one card. This is where the arm's knobs bite. */
async function contact({ name, args, dir, arm, coord, log, beat, stats, responders, priorArtifact, store, plan, seed, edgeCost = 0, relayDepth = 0, hops = 0, forceReachable = false, mode = 'facts' }) {
  const docs = mode === 'documents';
  const cardId = String(args.card_id || '');
  const card = dir.byId.get(cardId);
  if (!card) { log.event('contact.nocard', { card: cardId, beat }); return { error: `no such agent: ${cardId}` }; }

  const inRoster = dir.roster.has(cardId);
  const eff = effectiveArm(arm, inRoster);

  // Roster-only arms cannot address a card they cannot see.
  if (eff.directoryScope === 'roster' && !inRoster && !forceReachable) {
    stats.denies++;
    log.event('contact.outofscope', { card: cardId, beat });
    const reachable = dir.cards.filter((c) => dir.roster.has(c.id)).map((c) => c.id).join(', ');
    return { error: `${cardId} is not in your roster and cannot be contacted. Reachable: ${reachable}` };
  }

  const ns = coord.namespaceFor('requester', cardId, beat);
  const grant = coord.mint({ requesterId: 'requester', cardId, namespaceId: ns, beat });
  const decision = await coord.authorize({ actorId: 'requester', cardId, namespaceId: ns, grants: [grant], beat });
  if (!decision.allowed) {
    stats.denies++;
    return { error: `contact refused by the coordination layer: ${decision.reasonCode}` };
  }

  // ---- edge formation cost -------------------------------------------
  // Addressing a stranger is free in the default configuration, which removes
  // the economic reason relationships exist: a hundred addressable holders at
  // zero acquisition cost is closer to an oracle than to a network. With
  // EDGE_COST > 0, the first contact to an edge that does not already exist
  // returns a handshake instead of an answer -- what onboarding actually is --
  // and costs a turn without delivering content.
  //
  // A roster edge is already formed when the episode starts. That is what
  // "pre-existing relationship" means, and it is the asymmetry under test, not
  // a thumb on the scale.
  if (edgeCost > 0 && !inRoster) {
    const formed = stats.formedEdges.get(cardId) || 0;
    if (formed < edgeCost) {
      stats.formedEdges.set(cardId, formed + 1);
      stats.handshakes++;
      log.event('contact.handshake', { card: cardId, beat, step: formed + 1, of: edgeCost });
      return {
        from: cardId,
        answer: `${card.name} here. I work on ${card.tags.slice(0, 3).join(', ')}. `
              + 'Before I can answer anything specific I need to know what you are building '
              + 'and which of those areas you need. Ask again with that context.',
        handshake: true,
      };
    }
  }

  stats.contacted.add(cardId);
  const state = responders.get(cardId) || { history: [], lastArtifact: null };
  const carry = eff.responderMemory === true;

  const isBuild = name === 'delegate_build';
  const canRead = eff.access === 'store';

  // Who this responder can forward to: everyone the requester could not reach
  // directly. Relay depth is the arm's delegation ceiling, and hop 2 is the
  // only one we allow here.
  const relayPool = (!isBuild && relayDepth > 0 && (hops || 0) < relayDepth
                     && eff.directoryScope === 'roster')
    ? dir.cards.filter((c) => c.id !== cardId && !dir.roster.has(c.id))
    : [];
  const sys = isBuild
    ? [
      'You are a builder agent. You produce one complete, self-contained HTML document and nothing else.',
      'You cannot look anything up. Use only the numbers and facts in the instructions you are given.',
      'Reply with the HTML document only: no commentary, no markdown fences.',
    ].join('\n')
    : docs ? [
      // A records keeper, not a service. The "answer the specific question and
      // never volunteer" rule of the fact-list harness is deliberately absent:
      // the payables design requires that asking can solve the task in full,
      // so a holder may cover several orders in one answer when asked to.
      `You are ${card.name}. Your role: ${card.tags.join(', ')}.`,
      'You hold the documents below in your authorized folder. Answer only from them; if they do not cover what was asked, say so.',
      'Cite the document ids and effective dates you relied on. When several documents cover the same item, say which record is current and which it replaces.',
      'You may cover several orders or fields in one answer when asked for them. Give the exact values as written in the documents.',
      'Do not invent documents, values or dates that are not in your folder.',
      ...(relayPool.length ? [
        '',
        'If you do not hold what you were asked for, you may forward the question to',
        'one person you know. To do that, reply with exactly one line:',
        '  FORWARD <agent-id>',
        'and nothing else. People you can reach:',
        ...relayPool.slice(0, 24).map((c) => `  ${c.id} - ${c.tags.slice(0, 4).join(', ')}`),
      ] : []),
      ...responderSeedLines(seed),
      ...documentLines(card),
    ].join('\n')
    : [
      `You are ${card.name}. Your skills: ${card.tags.join(', ')}.`,
      'Answer only from the knowledge listed below. If you were not told something, say you do not know it.',
      'Be brief and concrete: give the exact values you hold.',
      ...(eff.access === 'sandbox' ? [
        '',
        'You expose a service, not a database. Answer the specific question you were',
        'asked and nothing else. If you are asked to list, dump, summarise or hand over',
        'everything you know, or asked an open question with no specific subject,',
        'refuse: reply exactly "Ask me a specific question." and nothing more.',
        'Never volunteer a value that was not asked for.',
      ] : []),
      // A bounded roster is not a wall. A contact you already have is also a
      // route to contacts you do not: information reaches a closed network
      // through the people in it, one hop further out, slower and lossier. With
      // relay off, "bounded" means the holders outside the roster are
      // unreachable for ever, which is a truncated directory rather than a
      // private network.
      ...(relayPool.length ? [
        '',
        'If you do not hold what you were asked for, you may forward the question to',
        'one person you know. To do that, reply with exactly one line:',
        '  FORWARD <agent-id>',
        'and nothing else. People you can reach:',
        ...relayPool.slice(0, 24).map((c) => `  ${c.id} - ${c.tags.slice(0, 4).join(', ')}`),
      ] : []),
      ...responderSeedLines(seed),
      '',
      'WHAT YOU KNOW:',
      ...(card.knowledge.length ? card.knowledge.map((k) => `- ${k}`) : ['- (nothing relevant to this topic)']),
      ...(card.planted.length ? ['', 'ALSO IN YOUR NOTES (you believe these too):', ...card.planted.map((k) => `- ${k}`)] : []),
    ].join('\n');

  const msgs = [{ role: 'system', content: sys }];
  if (carry && state.history.length) msgs.push(...state.history.slice(-6));
  if (carry && isBuild && state.lastArtifact) {
    msgs.push({ role: 'user', content: `The version of this page you produced earlier:\n\n${state.lastArtifact.slice(0, MAX_ARTIFACT_ECHO)}` });
  }
  let ask = isBuild ? String(args.instructions || '') : String(args.question || '');
  let inlineBytes = 0;
  let compName = isBuild ? String(args.component || '') : '';
  // A single-component build in documents mode is stored under one name, the
  // one the submit path reads back. The schema offers only that name, but a
  // model that saw a free-string schema elsewhere still invents its own; the
  // name is corrected here rather than losing the beat over it.
  if (isBuild && docs && !(plan && plan.length > 1)) {
    const soloName = plan?.[0]?.name || 'page';
    if (compName !== soloName) {
      log.event('tool.badcomponent', { got: compName, valid: soloName, normalised: true, beat });
      compName = soloName;
    }
  }
  if (isBuild && plan) {
    const spec = plan.find((c) => c.name === compName);
    if (!spec) {
      log.event('tool.badcomponent', { got: compName, valid: plan.map((c) => c.name).join(','), beat });
      return { error: `"${compName}" is not a component of this deliverable. Use exactly one of: ${plan.map((c) => c.name).join(', ')}.` };
    }
    const deps = spec.deps;
    // The arms diverge here and only here: with a store the dependency travels
    // as a name, without one it travels as bytes -- every time, for every
    // dependent. That is the tax, and it is charged to this prompt.
    const brief = buildBrief({ component: compName, deps, store, canRead: false });
    inlineBytes = brief.inlineBytes;
    ask = `${ask}\n\n${brief.text}`;
    if (spec.sections?.length) ask += `\n\nProduce ONLY these sections: ${spec.sections.join(', ')}.`;
    if (spec.assembles) ask += `\n\nAssemble the final complete HTML document from the components.`;
  }
  msgs.push({ role: 'user', content: ask });

  // A builder that is short a number may consult one more specialist. Whether it
  // is allowed to is decided by deriveGrant, i.e. by this arm's delegationDepth.
  // Not in documents mode: there the bounded arms carry delegation depth and the
  // open arms do not, so the consult would be an evidence channel open to C and
  // D only, and the access axis is the one thing the design keeps equal.
  if (isBuild && !docs) {
    const sub = await builderConsult({ msgs, parentGrant: grant, dir, arm, coord, log, beat, stats, responders, requesterCardId: cardId, seed, mode });
    if (sub) msgs.push(sub);
  }

  // A documents answer that covers several orders with citations does not fit
  // in 700 tokens; a silently truncated reply would then read as an ask-route
  // weakness that the design never intended to test. `fin` is logged so any
  // truncation that still happens is visible.
  const askTokens = docs ? 1500 : 700;
  let res;
  try {
    if (isBuild && canRead && !store) throw new Error('store arm reached a build with no store: wiring is broken');
    res = await chat({ messages: msgs, log, tag: `${isBuild ? 'build' : 'ask'}.${cardId}`, maxTokens: isBuild ? 8000 : askTokens, temperature: isBuild ? 0.2 : 0.1 });
  } catch (err) {
    stats.techFails = (stats.techFails || 0) + 1;
    log.fail('contact.llm', err, { card: cardId, beat });
    return { error: 'agent unavailable' };
  }
  stats.tokens += res.tokensIn + res.tokensOut;

  let reply = String(res.message?.content || '');

  // ---- relay: the second hop --------------------------------------------
  // The answer arrives through a person rather than directly, which is what
  // reach looks like in a bounded network. It costs another model call, and it
  // passes through another paraphrase -- the loss is the mechanism, not noise
  // we inject.
  const fwd = reply.trim().match(/^FORWARD\s+([A-Za-z0-9_-]+)\s*$/m);
  if (!isBuild && fwd && relayPool.length) {
    const via = fwd[1];
    const target = dir.byId.get(via);
    const reachable = target && !dir.roster.has(via) && via !== cardId;
    if (!reachable) {
      log.event('relay.badtarget', { from: cardId, to: via, beat });
      reply = `I do not hold that, and ${via} is not someone I can reach.`;
    } else {
      const d = coord.mintRelay({ fromCardId: cardId, toCardId: via, depth: (hops || 0) + 1, beat });
      if (!d.ok) {
        stats.denies++;
        log.event('relay.refused', { from: cardId, to: via, beat, why: d.reasonCode });
        reply = `I do not hold that and cannot reach anyone who does.`;
      } else {
        stats.relays++;
        stats.relayTargets.add(via);
        const hop = await contact({
          name: 'ask_agent', args: { card_id: via, question: args.question },
          dir, arm, coord, log, beat, stats, responders, priorArtifact, store, plan, seed,
          edgeCost: 0, relayDepth, hops: (hops || 0) + 1, forceReachable: true, mode,
        });
        log.event('tool.relay', { from: cardId, to: via, beat, ok: !hop.error, hop: (hops || 0) + 1 });
        reply = hop.error
          ? `I asked ${via} and got nothing back.`
          : `Relayed from ${via}: ${hop.answer || ''}`;
      }
    }
  }

  if (isBuild) {
    stats.builds++;
    state.lastArtifact = stripFence(reply);
    if (store && compName) store.write(compName, stripFence(reply), { by: cardId, beat });
    stats.inlineBytes = (stats.inlineBytes || 0) + inlineBytes;
  }
  else {
    stats.asks++;
    if (card.knowledge.length) stats.usefulContacts.add(cardId);
    for (const p of card.planted) stats.pollutionSeen.add(p);
  }

  state.history.push({ role: 'user', content: ask.slice(0, 2000) },
    { role: 'assistant', content: reply.slice(0, isBuild ? 400 : 1200) });
  responders.set(cardId, state);

  log.event(isBuild ? 'tool.build' : 'tool.ask', {
    card: cardId, kind: card.kind, roster: inRoster, mem: carry,
    ti: res.tokensIn, to: res.tokensOut, len: reply.length, beat,
    // The question itself, so an analysis can tell an "everything about order
    // 3" ask from a "what is the unit price" one without the transcript.
    ...(isBuild ? { comp: compName, inlineBytes, storeReads: res.storeReads || 0 } : { fin: res.finish, q: String(args.question || '').slice(0, 300) }),
  });

  if (!isBuild) return { answer: reply };
  const built = stripFence(reply);
  // Documents mode: the receipt is the return value in every arm. The access
  // axis under test is who may read the evidence, not who carries the page, so
  // the requester's context cost of a build is made identical across arms.
  if (docs) {
    return { ok: true, component: compName, bytes: built.length, note: 'written to the component store' };
  }
  // The arms diverge here, and this is the mechanism the study is about.
  // Without a store the requester has to hold each component itself, because
  // it is the only thing that can carry it to whoever needs it next: the bytes
  // enter its context and stay there. With a store the component lives in the
  // store, the builder that needs it is handed it directly, and the requester
  // gets a receipt. The tax is paid in the requester's context, not the
  // builder's, which is what the earlier version measured and why it saw
  // nothing.
  if (canRead) {
    return { ok: true, component: compName, bytes: built.length, note: 'written to the component store' };
  }
  return { html: built, component: compName, bytes: built.length };
}

/** Enumerate or read a counterpart's store. Only exists under access:'store'. */
async function readStore({ name, args, dir, arm, coord, log, beat, stats, mode = 'facts' }) {
  const docs = mode === 'documents';
  const cardId = String(args.card_id || '');
  const card = dir.byId.get(cardId);
  if (!card) { log.event('contact.nocard', { card: cardId, beat }); return { error: `no such agent: ${cardId}` }; }

  const inRoster = dir.roster.has(cardId);
  const eff = effectiveArm(arm, inRoster);
  if (eff.access !== 'store') {
    stats.denies++;
    log.event('store.denied', { card: cardId, why: 'sandboxed', beat });
    return { error: `${cardId} exposes an interface, not a store. Use ask_agent with a specific question.` };
  }
  // A store read is never relayed, so there is no forceReachable here: an
  // out-of-roster read is denied, and the denial is a counted, logged turn.
  if (eff.directoryScope === 'roster' && !inRoster) {
    stats.denies++;
    log.event('contact.outofscope', { card: cardId, beat, via: name });
    return { error: `${cardId} is not in your roster and cannot be read.` };
  }

  const ns = coord.namespaceFor('requester', cardId, beat);
  const grant = coord.mint({ requesterId: 'requester', cardId, namespaceId: ns, beat });
  const decision = await coord.authorize({ actorId: 'requester', cardId, namespaceId: ns, grants: [grant], beat });
  if (!decision.allowed) {
    stats.denies++;
    log.event('store.refused', { card: cardId, code: decision.reasonCode, beat });
    return { error: `refused by the coordination layer: ${decision.reasonCode}` };
  }

  stats.contacted.add(cardId);
  // Reading is where a store hands over everything it holds, planted items and
  // all. That asymmetry against ask_agent is the point of the access axis.
  const items = [...card.knowledge, ...card.planted];
  if (card.knowledge.length) stats.usefulContacts.add(cardId);

  if (name === 'list_store') {
    stats.lists = (stats.lists || 0) + 1;
    log.event('tool.list', { card: cardId, kind: card.kind, n: items.length, beat, ...docIds(items) });
    // A document's first line is its header (id, type, order, dates, version,
    // status), which is what a folder listing shows; a fact list has no such
    // line, so it keeps the short slice.
    return { items: items.map((k, i) => ({ index: i, title: docs ? k.split('\n')[0].slice(0, 200) : k.slice(0, 60) })) };
  }

  stats.reads = (stats.reads || 0) + 1;
  const idx = Number.isInteger(args.index) ? args.index : null;
  const out = idx == null ? items : (items[idx] == null ? [] : [items[idx]]);
  for (const o of out) if (card.planted.includes(o)) stats.pollutionSeen.add(o);
  log.event('tool.read', { card: cardId, kind: card.kind, idx, n: out.length, beat, ...docIds(out) });
  return { items: out };
}

/**
 * The document ids in a list or read result, from each item's header line
 * ("DOCUMENT <id> ..."). A fact list has no header, so the field is omitted
 * rather than written empty.
 */
function docIds(items) {
  const ids = items.map((k) => String(k).split('\n')[0].match(/^DOCUMENT (\S+)/)?.[1]).filter(Boolean);
  return ids.length ? { ids } : {};
}

/**
 * One consult round for a builder. The builder is asked whether anything is
 * missing; if it names a specialist, the kernel decides whether the mandate may
 * be passed on at all. Public arms carry delegationDepth 0, so this is where
 * `parent_not_delegable` shows up in the logs.
 */
async function builderConsult({ msgs, parentGrant, dir, arm, coord, log, beat, stats, responders, requesterCardId, seed, mode = 'facts' }) {
  const docs = mode === 'documents';
  let probe;
  try {
    probe = await chat({
      messages: [
        ...msgs,
        { role: 'user', content: 'Before you build: is any required number or fact missing from these instructions? Reply with exactly one line, either NONE, or CONSULT <agent-id> <one short question>.' },
      ],
      log, tag: `consult.probe.${requesterCardId}`, maxTokens: 120, temperature: 0,
    });
  } catch { stats.techFails = (stats.techFails || 0) + 1; return null; }
  stats.tokens += probe.tokensIn + probe.tokensOut;

  const line = String(probe.message?.content || '').trim();
  const m = line.match(/^CONSULT\s+([A-Za-z0-9_-]+)\s+(.+)$/);
  if (!m) return null;

  const [, targetId, question] = m;
  const target = dir.byId.get(targetId);
  if (!target) { log.event('consult.nocard', { to: targetId, beat }); return null; }

  const d = coord.subDelegate({ parentGrant, toCardId: targetId, depth: 1, beat });
  if (!d.ok) {
    return { role: 'user', content: `You may not consult another agent here (${d.reason}). Build with what you have.` };
  }

  const sys = docs ? [
    `You are ${target.name}. Your role: ${target.tags.join(', ')}.`,
    'You hold the documents below in your authorized folder. Answer only from them; if they do not cover what was asked, say so.',
    'Cite the document ids and effective dates you relied on, and say which record is current when several cover the same item.',
    ...responderSeedLines(seed),
    ...documentLines(target),
  ].join('\n') : [
    `You are ${target.name}. Your skills: ${target.tags.join(', ')}.`,
    'Answer only from the knowledge listed below. If you were not told something, say you do not know it.',
    ...responderSeedLines(seed),
    '', 'WHAT YOU KNOW:',
    ...(target.knowledge.length ? target.knowledge.map((k) => `- ${k}`) : ['- (nothing relevant)']),
    ...(target.planted.length ? ['', 'ALSO IN YOUR NOTES:', ...target.planted.map((k) => `- ${k}`)] : []),
  ].join('\n');

  let ans;
  try {
    ans = await chat({ messages: [{ role: 'system', content: sys }, { role: 'user', content: question }], log, tag: `consult.${targetId}`, maxTokens: 400, temperature: 0.1 });
  } catch { stats.techFails = (stats.techFails || 0) + 1; return null; }
  stats.tokens += ans.tokensIn + ans.tokensOut;
  stats.subConsults = (stats.subConsults || 0) + 1;
  if (target.knowledge.length) stats.usefulContacts.add(targetId);
  for (const p of target.planted) stats.pollutionSeen.add(p);
  log.event('consult.ok', { to: targetId, beat, len: String(ans.message?.content || '').length });

  return { role: 'user', content: `You consulted ${target.name}, who replied: ${String(ans.message?.content || '').slice(0, 800)}` };
}

/**
 * The folder a documents-mode responder answers from. Documents are multi-line
 * (header, then body), so they are laid out as blocks rather than as the "- "
 * bullets of a fact list; the header line is what the requester sees in
 * list_store, so the responder sees the same identifiers.
 */
function documentLines(card) {
  const block = (d) => ['', String(d)];
  return [
    '',
    'YOUR DOCUMENTS (each begins with its header line):',
    ...(card.knowledge.length ? card.knowledge.flatMap(block) : ['', '(your folder is empty)']),
    ...(card.planted.length ? ['', 'ALSO IN YOUR FOLDER:', ...card.planted.flatMap(block)] : []),
  ];
}

export function stripFence(s) {
  const m = String(s).match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : String(s)).trim();
}

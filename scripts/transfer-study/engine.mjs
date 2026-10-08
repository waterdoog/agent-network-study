import { factsFor, publicTask, hash } from './task.mjs';

const policies = {
  strict: {
    requester: 'Ask specialists specific factual questions. Each specialist answers only the specific question asked and does not volunteer other facts.',
    holder: 'Answer only the specific question asked. Do not volunteer additional facts. A question explicitly requesting all values of a named field may be answered with all those values.',
  },
  permissive: {
    requester: 'You may ask specialists specific questions or broadly for everything they hold that is relevant to the task. Specialists may volunteer relevant facts.',
    holder: 'Answer the question and you may volunteer any other facts you hold that are relevant to selecting the best feasible portfolio. Broad requests for relevant facts are allowed.',
  },
};
const submitTool = { type: 'function', function: {
  name: 'submit_selection', description: 'Submit the selected project IDs and finish the task.',
  parameters: { type: 'object', properties: { project_ids: { type: 'array', items: { type: 'string' } } }, required: ['project_ids'] },
} };
const askTool = { type: 'function', function: {
  name: 'ask_agent', description: 'Ask one listed specialist for facts it holds.',
  parameters: { type: 'object', properties: { holder_id: { type: 'string' }, question: { type: 'string' } }, required: ['holder_id', 'question'] },
} };

export class TechnicalFailure extends Error {
  constructor(cause) { super('Model transport or serving validation failed', { cause }); this.name = 'TechnicalFailure'; }
}

export async function runEpisode({ world, arm, config, chat, log }) {
  if (!['strict', 'permissive', 'full_information'].includes(arm)) throw new Error('Unknown arm');
  const full = arm === 'full_information';
  const policy = full ? '' : policies[arm].requester;
  const messages = [
    { role: 'system', content: [
      'You are a project allocation decision agent. Maximize total benefit while satisfying every constraint.',
      'Use only the supplied facts or facts provided by listed specialists. Do not invent missing values.',
      policy,
      full ? `All specialist facts are supplied below. You have at most ${config.requester_iterations} responses. Submit your decision using submit_selection.`
        : `You have at most ${config.requester_iterations} responses and ${config.max_asks} specialist questions. The final response permits submission only.`,
    ].filter(Boolean).join('\n') },
    { role: 'user', content: JSON.stringify({ ...publicTask(world), ...(full ? {
      specialist_facts: world.holders.map(h => ({ holder_id: h.id, facts: factsFor(world, h.id) })),
    } : {}) }) },
  ];
  let asks = 0, calls = 0, iterations = 0;
  async function invoke(req) {
    const record = { model: config.model, messages: req.messages, ...(req.tools ? { tools: req.tools } : {}),
      maxTokens: req.maxTokens, tag: req.tag };
    log.event('model.request', { ...record, caller_request_sha256: hash(record) });
    let res;
    try { res = await chat({ ...req, model: config.model, log }); }
    catch (err) { throw new TechnicalFailure(err); }
    calls++;
    log.event('model.reply', { tag: req.tag, message: res.message, finish: res.finish,
      tokensIn: res.tokensIn, tokensOut: res.tokensOut, reply_sha256: hash(res.message) });
    return res;
  }
  const maxIterations = config.requester_iterations;
  for (let i = 0; i < maxIterations; i++) {
    iterations = i + 1;
    const submitOnly = full || i === maxIterations - 1 || asks >= config.max_asks;
    if (submitOnly && !full) messages.push({ role: 'user', content: 'No further questions are available. Submit the selected project IDs now using submit_selection.' });
    const res = await invoke({ messages, tools: submitOnly ? [submitTool] : [askTool, submitTool],
      maxTokens: config.requester_max_output_tokens, tag: `requester.i${i}` });
    messages.push(res.message);
    const toolCalls = res.message.tool_calls || [];
    if (!toolCalls.length) {
      if (i < maxIterations - 1) messages.push({ role: 'user', content: 'Use an available tool, or finish with submit_selection.' });
      continue;
    }
    for (const call of toolCalls) {
      const name = call.function?.name;
      let args;
      try { args = JSON.parse(call.function?.arguments || '{}'); }
      catch { args = null; }
      let result;
      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        result = { error: 'Tool arguments must be a JSON object.' };
      } else if (name === 'submit_selection') {
        log.event('tool.submit', { project_ids: args.project_ids ?? null });
        return { status: 'submitted', selection: args.project_ids ?? null, asks, calls, iterations };
      } else if (name === 'ask_agent' && !submitOnly && asks < config.max_asks) {
        const holder = world.holders.find(h => h.id === args.holder_id);
        if (!holder || typeof args.question !== 'string' || !args.question.trim()) {
          result = { error: 'Use a listed holder_id and a nonempty question.' };
        } else {
          asks++;
          const answer = await invoke({ messages: [
            { role: 'system', content: [
              `You are specialist ${holder.id}: ${holder.description}.`,
              'You hold only the facts below. All numbers are exact. Do not invent facts or claim knowledge held elsewhere.',
              'The requester is selecting up to three projects subject to funding, labor and incompatibility constraints, maximizing base benefit plus pair synergy.',
              policies[arm].holder,
              `Your facts: ${JSON.stringify(factsFor(world, holder.id))}`,
            ].join('\n') },
            { role: 'user', content: args.question },
          ], maxTokens: config.holder_max_output_tokens, tag: `holder.${holder.id}.q${asks}` });
          result = { holder_id: holder.id, answer: answer.message.content || '' };
          log.event('tool.ask', { holder_id: holder.id, question: args.question, answer: result.answer });
        }
      } else {
        result = { error: 'Tool unavailable or question budget exhausted. Use an available tool or submit_selection.' };
      }
      log.event('tool.result', { name, result });
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return { status: 'model-no-submission', selection: null, asks, calls, iterations };
}

// Codex subscription transport only. No API key, model substitution, agent
// wrapper, or additional tools. Experimental prompts remain in the harness.
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';

const ENDPOINT = 'https://chatgpt.com/backend-api/codex/responses';
const MODEL = 'gpt-6-astra';
const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

export function toResponses(req) {
  const instructions = [];
  const input = [];
  for (const msg of req.messages) {
    if (msg.role === 'system') { instructions.push(msg.content); continue; }
    if (msg.role === 'tool') {
      input.push({ type: 'function_call_output', call_id: msg.tool_call_id, output: msg.content });
      continue;
    }
    if (msg.content) input.push({ role: msg.role, content: [{
      type: msg.role === 'assistant' ? 'output_text' : 'input_text', text: msg.content,
    }] });
    for (const call of msg.tool_calls || []) input.push({
      type: 'function_call', call_id: call.id, name: call.function.name, arguments: call.function.arguments,
    });
  }
  const body = {
    model: MODEL, instructions: instructions.join('\n\n'), input,
    stream: true, store: false, reasoning: { effort: 'medium' },
    max_output_tokens: req.maxTokens ?? 3000,
  };
  if (req.tools?.length) {
    body.tools = req.tools.map(t => ({ type: 'function', ...t.function, strict: false }));
    body.tool_choice = 'auto';
  }
  return body;
}

export async function readResponse(res) {
  const items = new Map();
  let final, buffer = '';
  const decoder = new TextDecoder();
  const accept = (line) => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    const evt = JSON.parse(data);
    if (evt.type === 'response.output_item.done') items.set(evt.output_index, evt.item);
    if (['response.completed', 'response.incomplete', 'response.failed'].includes(evt.type)) final = evt.response;
    if (evt.type === 'error') throw new Error(`Subscription event error: ${evt.code || evt.message || 'unknown'}`);
  };
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) { accept(buffer.slice(0, i).trimEnd()); buffer = buffer.slice(i + 1); }
  }
  buffer += decoder.decode();
  if (buffer.trim()) accept(buffer.trim());
  if (!final) throw new Error('Subscription stream ended without a terminal response');
  const output = items.size ? [...items.entries()].sort((a,b)=>a[0]-b[0]).map(x=>x[1]) : final.output || [];
  return { final, output };
}

export function toChat(output) {
  const content = output.filter(x=>x.type==='message').flatMap(x=>x.content||[])
    .filter(x=>x.type==='output_text' || x.type==='refusal').map(x=>x.text || x.refusal || '').join('');
  const calls = output.filter(x=>x.type==='function_call').map(x=>({
    id:x.call_id, type:'function', function:{name:x.name, arguments:x.arguments},
  }));
  return {role:'assistant',content:content || null,...(calls.length?{tool_calls:calls}:{})};
}

export async function subscriptionChat(req, { model, usage }) {
  if ((req.model || model) !== MODEL) throw new Error('Subscription model must remain gpt-6-astra');
  const body = toResponses(req);
  const requestHash = hash(body);
  const ledgerPath = process.env.STUDY_SUBSCRIPTION_LEDGER;
  if (!ledgerPath) throw new Error('STUDY_SUBSCRIPTION_LEDGER must be set');
  mkdirSync(dirname(ledgerPath), { recursive: true });
  const record = row => appendFileSync(ledgerPath, JSON.stringify(row)+'\n');
  const meta = { tag:req.tag, episode:req.log?.meta?.id ?? null, transport:'codex-subscription', requested_model:MODEL,
    request_sha256:requestHash, reasoning_effort:'medium', requested_max_output_tokens:body.max_output_tokens,
    omitted_temperature:req.temperature ?? 0.3, cost_microusd:null, cost_status:'not_reported_by_subscription' };
  let lastErr;
  for (let attempt=0; attempt<5; attempt++) {
    const attemptId = randomUUID();
    const started = Date.now();
    record({ ...meta, kind:'attempt_started', attempt_id:attemptId, attempt, at:new Date().toISOString() });
    let status, retryAfter=0;
    try {
      // Read the current login for every call so normal Codex token refreshes
      // are picked up. Credentials never enter logs, argv, or the repository.
      const auth = JSON.parse(readFileSync(join(process.env.CODEX_HOME || join(homedir(),'.codex'),'auth.json'),'utf8'));
      if (auth.auth_mode !== 'chatgpt' || !auth.tokens?.access_token || !auth.tokens?.account_id)
        throw new Error('A ChatGPT subscription login is required');
      const res = await fetch(ENDPOINT, {
        method:'POST', headers:{Authorization:`Bearer ${auth.tokens.access_token}`,
          'ChatGPT-Account-Id':auth.tokens.account_id, 'Content-Type':'application/json',
          Accept:'text/event-stream', originator:'codex_cli_rs'},
        body:JSON.stringify(body), signal:AbortSignal.timeout(Number(process.env.STUDY_HTTP_TIMEOUT_MS || 180000)),
      });
      status=res.status;
      const ra=res.headers.get('retry-after');
      if (ra) retryAfter=Math.max(0,Number(ra)*1000 || Date.parse(ra)-Date.now() || 0);
      if (!res.ok) {
        const detail=(await res.text()).slice(0,500);
        throw new Error(`HTTP ${status}: ${detail}`);
      }
      const {final,output}=await readResponse(res);
      const served=final.model;
      const u=final.usage;
      const upstream={response_id:final.id, served, served_source:'upstream_terminal_response.model',
        response_status:final.status, incomplete_details:final.incomplete_details,
        usage:u?{input_tokens:u.input_tokens,output_tokens:u.output_tokens,total_tokens:u.total_tokens,
          input_tokens_details:u.input_tokens_details,output_tokens_details:u.output_tokens_details}:null,
        applied_reasoning:final.reasoning, applied_temperature:final.temperature,
        applied_max_output_tokens:final.max_output_tokens, service_tier:final.service_tier,
        request_id:res.headers.get('x-request-id'), output_sha256:hash(output)};
      record({...meta,...upstream,kind:'response',attempt_id:attemptId,attempt,at:new Date().toISOString(),ms:Date.now()-started});
      if (served !== MODEL) {
        req.log?.event('llm.serving_exclusion',{tag:req.tag,model:MODEL,served,response_id:final.id});
        throw new Error(`Serving model mismatch: ${served || 'missing'}`);
      }
      if (final.status === 'failed') throw new Error(`Subscription response failed: ${final.error?.code || 'unknown'}`);
      if (!u || !Number.isFinite(u.input_tokens) || !Number.isFinite(u.output_tokens)) throw new Error('Subscription response has no verifiable token usage');
      const message=toChat(output);
      usage.calls++; usage.promptTokens+=u.input_tokens; usage.completionTokens+=u.output_tokens;
      const finish=final.status==='incomplete'?'length':message.tool_calls?.length?'tool_calls':'stop';
      req.log?.event('llm',{tag:req.tag,model:MODEL,ti:u.input_tokens,to:u.output_tokens,ms:Date.now()-started,
        fin:finish,tc:message.tool_calls?.length||0,served,cost_microusd:null,
        cost_status:'not_reported_by_subscription',response_id:final.id,request_sha256:requestHash,
        reasoning_tokens:u.output_tokens_details?.reasoning_tokens??null});
      return {message,finish,tokensIn:u.input_tokens,tokensOut:u.output_tokens};
    } catch(err) {
      lastErr=err;
      record({...meta,kind:'attempt_error',attempt_id:attemptId,attempt,at:new Date().toISOString(),status:status??null,
        error:String(err.message).slice(0,700),ms:Date.now()-started});
      const transient=RETRYABLE.has(status)||/timeout|ETIMEDOUT|ECONNRESET|fetch failed|aborted/i.test(String(err.message));
      if (transient && attempt<4) {
        usage.retries++;
        req.log?.event('llm.retry',{tag:req.tag,status,attempt,why:'subscription-transient'});
        await sleep(Math.max(retryAfter,1500*2**attempt));
        continue;
      }
      break;
    }
  }
  usage.failures++;
  req.log?.fail('llm.fail',lastErr,{tag:req.tag,model:MODEL});
  throw lastErr;
}

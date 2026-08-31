// One model, one client, every agent in every arm. Chat Completions over
// OpenRouter. Retries only on transient failures; a 4xx that is not 429 is a
// bug in our request and must surface immediately rather than be retried away.
const BASE = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
const KEY = process.env.OPENAI_API_KEY;
export const MODEL = process.env.STUDY_MODEL || 'deepseek/deepseek-v4-flash';

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const usage = { calls: 0, promptTokens: 0, completionTokens: 0, retries: 0, failures: 0 };

/**
 * @param {{messages:Array, tools?:Array, model?:string, temperature?:number,
 *          maxTokens?:number, log?:object, tag?:string}} req
 */
export async function chat(req) {
  if (!KEY) throw new Error('OPENAI_API_KEY is not set');
  const model = req.model || MODEL;
  const body = {
    model,
    messages: req.messages,
    temperature: req.temperature ?? 0.3,
    max_tokens: req.maxTokens ?? 3000,
  };
  if (req.tools?.length) { body.tools = req.tools; body.tool_choice = 'auto'; }

  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    const started = Date.now();
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/aicoo/agent-network-study',
          'X-Title': 'agent-network-study',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Number(process.env.STUDY_HTTP_TIMEOUT_MS || 90_000)),
      });

      if (!res.ok) {
        const text = (await res.text()).slice(0, 400);
        if (RETRYABLE.has(res.status) && attempt < 4) {
          usage.retries++;
          req.log?.event('llm.retry', { tag: req.tag, status: res.status, attempt });
          await sleep(1500 * 2 ** attempt);
          continue;
        }
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const json = await res.json();
      const choice = json.choices?.[0];
      if (!choice) throw new Error(`no choices: ${JSON.stringify(json).slice(0, 300)}`);

      const u = json.usage || {};
      usage.calls++;
      usage.promptTokens += u.prompt_tokens || 0;
      usage.completionTokens += u.completion_tokens || 0;

      req.log?.event('llm', {
        tag: req.tag, model,
        ti: u.prompt_tokens || 0, to: u.completion_tokens || 0,
        ms: Date.now() - started,
        fin: choice.finish_reason,
        tc: choice.message?.tool_calls?.length || 0,
      });

      return {
        message: choice.message,
        finish: choice.finish_reason,
        tokensIn: u.prompt_tokens || 0,
        tokensOut: u.completion_tokens || 0,
      };
    } catch (err) {
      lastErr = err;
      const transient = /timeout|ETIMEDOUT|ECONNRESET|fetch failed|aborted/i.test(String(err.message));
      if (transient && attempt < 4) {
        usage.retries++;
        req.log?.event('llm.retry', { tag: req.tag, why: 'transient', attempt });
        await sleep(1500 * 2 ** attempt);
        continue;
      }
      break;
    }
  }
  usage.failures++;
  req.log?.fail('llm.fail', lastErr, { tag: req.tag, model });
  throw lastErr;
}

/** OpenRouter prices for the two models we use, USD per token. */
const PRICE = {
  'deepseek/deepseek-v4-flash': { in: 0.084e-6, out: 0.168e-6 },
  'z-ai/glm-4.6': { in: 0.43e-6, out: 1.75e-6 },
};
export function estimateCost(model = MODEL) {
  const p = PRICE[model] || PRICE['deepseek/deepseek-v4-flash'];
  return usage.promptTokens * p.in + usage.completionTokens * p.out;
}

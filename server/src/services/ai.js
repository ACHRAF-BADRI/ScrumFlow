import { config } from '../config.js';
import Project from '../models/Project.js';
import { HttpError } from '../utils/httpError.js';

/*
 * AI suggestions (story breakdown, estimates, sprint summary). One small
 * client for several providers: Groq, Gemini and OpenRouter speak the OpenAI
 * chat format, Anthropic has its own. The answer is always asked as JSON and
 * checked before it reaches the app; nothing is saved without the user
 * choosing it.
 */
export const PROVIDERS = {
  groq: { name: 'Groq', env: 'GROQ_API_KEY', model: 'openai/gpt-oss-120b', url: 'https://api.groq.com/openai/v1/chat/completions' },
  gemini: { name: 'Gemini', env: 'GEMINI_API_KEY', model: 'gemini-2.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' },
  openrouter: { name: 'OpenRouter', env: 'OPENROUTER_API_KEY', model: 'meta-llama/llama-3.3-70b-instruct:free', url: 'https://openrouter.ai/api/v1/chat/completions' },
  anthropic: { name: 'Claude', env: 'ANTHROPIC_API_KEY', model: 'claude-haiku-4-5-20251001', url: 'https://api.anthropic.com/v1/messages' },
};

export const aiEnabled = () => Boolean(config.ai);
export const aiProviderName = () => (config.ai ? PROVIDERS[config.ai.provider].name : null);

/** The first JSON object in a model answer (some models wrap it in text or ``` fences). */
export function extractJson(text) {
  const value = String(text ?? '');
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON in the answer');
  return JSON.parse(value.slice(start, end + 1));
}

async function callProvider(system, user) {
  const { provider, apiKey } = config.ai;
  const spec = PROVIDERS[provider];
  const model = config.ai.model || spec.model;
  const signal = AbortSignal.timeout(45_000);
  let res;
  if (provider === 'anthropic') {
    res = await fetch(spec.url, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 1500, temperature: 0.3, system, messages: [{ role: 'user', content: user }] }),
    });
  } else {
    res = await fetch(spec.url, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        // Room for reasoning models (gpt-oss) to think before answering
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        ...(/gpt-oss/.test(model) && { reasoning_effort: 'low' }),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
  }
  if (res.status === 429) throw new HttpError(429, 'The AI provider is busy', 'errors.aiBusy');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn(`[ai:${provider}] HTTP ${res.status}`, body?.error?.message ?? '');
    throw new HttpError(502, 'The AI provider failed', 'errors.aiFailed');
  }
  return provider === 'anthropic' ? body.content?.map((c) => c.text ?? '').join('') : body.choices?.[0]?.message?.content;
}

/**
 * Asks the model for a JSON answer. Counts one use against the project's
 * daily limit first (atomically), so a team can't drain a free quota.
 */
export async function askJson(project, { system, user }) {
  if (!aiEnabled()) throw new HttpError(503, 'AI is not configured on this server', 'errors.aiDisabled');
  const day = new Date().toISOString().slice(0, 10);
  const limit = config.ai.dailyLimit;
  // New day: reset the counter; otherwise count only while under the limit
  const counted =
    (await Project.findOneAndUpdate({ _id: project._id, 'aiUsage.day': { $ne: day } }, { aiUsage: { day, count: 1 } }, { new: true })) ??
    (await Project.findOneAndUpdate({ _id: project._id, 'aiUsage.day': day, 'aiUsage.count': { $lt: limit } }, { $inc: { 'aiUsage.count': 1 } }, { new: true }));
  if (!counted) throw new HttpError(429, 'Daily AI limit reached for this project', 'errors.aiLimit');

  let text;
  try {
    text = await callProvider(system, user);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.warn('[ai]', err.message);
    throw new HttpError(502, 'The AI provider failed', 'errors.aiFailed');
  }
  try {
    return { data: extractJson(text), usage: { used: counted.aiUsage.count, limit } };
  } catch {
    throw new HttpError(502, 'The AI answer could not be read', 'errors.aiFailed');
  }
}

/** Clean list of short strings from a model answer. */
export const cleanList = (value, max = 12, length = 200) =>
  (Array.isArray(value) ? value : [])
    .map((item) => String(typeof item === 'object' && item !== null ? item.text ?? item.title ?? '' : item ?? '').trim().slice(0, length))
    .filter(Boolean)
    .slice(0, max);

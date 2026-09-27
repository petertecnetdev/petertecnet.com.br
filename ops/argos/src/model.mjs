import OpenAI from 'openai';
import { appendAudit, loadSession, saveSession } from './audit.mjs';
import { buildInstructions } from './instructions.mjs';
import { redact } from './redact.mjs';

function extractText(response) {
  if (typeof response.output_text === 'string' && response.output_text) return response.output_text;
  const parts = [];
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) parts.push(content.text);
      if (content.type === 'refusal' && content.refusal) parts.push(content.refusal);
    }
  }
  return parts.join('\n');
}

function makeClient(config) {
  return new OpenAI({
    apiKey: config.modelCredential,
    baseURL: config.apiBase,
    timeout: Math.max(config.toolTimeoutMs * 3, 15000),
    maxRetries: 1,
  });
}

export async function analyzeEvidence(config, event, evidence) {
  if (!config.modelCredential) throw new Error('model credential missing');
  const client = makeClient(config);
  const scope = event.scope || event.source || 'default';
  const session = await loadSession(config, scope);
  const request = {
    model: config.model,
    instructions: buildInstructions(config),
    input: JSON.stringify(redact({ event, evidence })),
    max_output_tokens: config.maxOutputTokens,
    store: true,
  };
  if (session.previousResponseId) request.previous_response_id = session.previousResponseId;

  let response;
  try {
    response = await client.responses.create(request);
  } catch (error) {
    if (!request.previous_response_id || error?.status !== 400) throw error;
    delete request.previous_response_id;
    await appendAudit(config, 'session_reset', { scope, reason: 'previous response rejected' });
    response = await client.responses.create(request);
  }

  await saveSession(config, scope, response.id);
  const text = extractText(response);
  await appendAudit(config, 'model_response', {
    scope, response_id: response.id, model: response.model, usage: response.usage, text,
  });
  return { response_id: response.id, text, usage: response.usage || null };
}

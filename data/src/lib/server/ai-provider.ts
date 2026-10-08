import { z } from 'zod';
import type { AIEngine } from '../spec';
import { HttpError } from './http';

export type ModelContent = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/webp'; data: string } };
export type ModelReply = { text: string; inputTokens: number; outputTokens: number };
type ConnectionFailure = { name?: string; code?: string; cause?: ConnectionFailure; errors?: ConnectionFailure[] };
function connectionError(error: unknown, provider: string): HttpError {
  const failure = error && typeof error === 'object' ? error as ConnectionFailure : {};
  const causes = [failure, failure.cause, ...(failure.cause?.errors ?? [])].filter((item): item is ConnectionFailure => !!item);
  const codes = causes.map(item => item.code);
  if (failure.name === 'TimeoutError' || failure.name === 'AbortError' || codes.some(code => code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ETIMEDOUT'))
    return new HttpError(`La connexion à ${provider} a dépassé le délai prévu. Réessayez dans un instant.`, 504);
  if (codes.some(code => code === 'ENOTFOUND' || code === 'EAI_AGAIN'))
    return new HttpError(`Le serveur ne parvient pas à trouver l’API ${provider}. Vérifiez la connexion Internet et le DNS.`, 502);
  if (codes.some(code => code === 'EPERM' || code === 'EACCES'))
    return new HttpError(`L’accès Internet du serveur est bloqué. Autorisez sa connexion à l’API ${provider}, puis redémarrez le studio.`, 502);
  if (codes.some(code => code?.includes('CERT') || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || code === 'DEPTH_ZERO_SELF_SIGNED_CERT'))
    return new HttpError(`Le certificat HTTPS de ${provider} n’a pas pu être vérifié. Vérifiez les certificats du système et la configuration du proxy.`, 502);
  return new HttpError(`Impossible de joindre l’API ${provider}. Vérifiez l’accès Internet du serveur et les éventuels réglages de proxy ou de pare-feu, puis réessayez.`, 502);
}
async function providerFetch(url: string, init: RequestInit, provider: string) {
  try { return await fetch(url, init); }
  catch (error) { throw connectionError(error, provider); }
}
async function providerJson<T>(response: Response, provider: string): Promise<T> {
  try { return await response.json() as T; }
  catch (error) {
    if (error instanceof SyntaxError) throw new HttpError(`L’API ${provider} a renvoyé une réponse illisible. Réessayez dans un instant.`, 502);
    throw connectionError(error, provider);
  }
}
export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5-5';
export function aiConfig() {
  const provider = z.enum(['anthropic', 'openai', 'local']).parse(process.env.AI_PROVIDER || 'anthropic');
  const apiKey = provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : provider === 'openai' ? process.env.OPENAI_API_KEY : undefined;
  const engine: AIEngine = provider !== 'local' && apiKey?.trim() ? provider : 'local';
  const model = provider === 'anthropic' ? process.env.ANTHROPIC_MODEL || DEFAULT_CLAUDE_MODEL : provider === 'openai' ? process.env.OPENAI_MODEL || 'gpt-4o-mini' : 'local';
  return { requestedProvider: provider, engine, model, apiKey };
}

const unsupported = new Set(['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'maxItems', 'uniqueItems', '$schema']);
// Anthropic constrains shape; Zod still enforces all numeric/text limits locally.
export function anthropicSchema(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(anthropicSchema);
  if (!input || typeof input !== 'object') return input;
  const source = input as Record<string, unknown>; const result: Record<string, unknown> = {}; const limits: string[] = [];
  for (const [key, value] of Object.entries(source)) {
    if (unsupported.has(key) || key === 'minItems' && typeof value === 'number' && value > 1) { if (key !== '$schema') limits.push(`${key}=${value}`); continue; }
    if (key === 'properties' || key === '$defs' || key === 'definitions') {
      result[key] = Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([name, schema]) => [name, anthropicSchema(schema)]));
    } else result[key] = anthropicSchema(value);
  }
  if (source.type === 'object') result.additionalProperties = false;
  if (limits.length) result.description = [source.description, `Contraintes validées par le serveur : ${limits.join(', ')}.`].filter(Boolean).join(' ');
  return result;
}
export async function modelRequest(schema: z.ZodType, name: string, system: string, context: string, images: ModelContent[] = []): Promise<ModelReply> {
  const config = aiConfig();
  if (config.engine === 'local') throw new HttpError('Ajoutez une clé Anthropic côté serveur pour utiliser Claude.', 503);
  const rawSchema = z.toJSONSchema(schema);
  const anthropic = config.engine === 'anthropic';
  const provider = anthropic ? 'Claude' : 'OpenAI';
  const response = await providerFetch(anthropic ? 'https://api.anthropic.com/v1/messages' : 'https://api.openai.com/v1/responses', {
    method: 'POST', signal: AbortSignal.timeout(90_000),
    headers: anthropic ? { 'x-api-key': config.apiKey!, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } : { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(anthropic ? { model: config.model, max_tokens: 5000, system,
      messages: [{ role: 'user', content: [...images, { type: 'text', text: context }] }],
      output_config: { format: { type: 'json_schema', schema: anthropicSchema(rawSchema) } },
    } : { model: config.model, store: false, max_output_tokens: 5000, instructions: system, input: context,
      text: { format: { type: 'json_schema', name, strict: true, schema: rawSchema } },
    }),
  }, provider);
  if (!response.ok) throw new HttpError(`${anthropic ? 'Claude' : 'OpenAI'} a répondu ${response.status}. Vérifiez la clé, le modèle et le quota du compte API.`, 502);
  if (anthropic) {
    const data = await providerJson<{ stop_reason: string; content: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } }>(response, provider);
    if (data.stop_reason === 'refusal') throw new HttpError('Claude n’a pas proposé de résultat pour cette demande. Reformulez votre brief.', 422);
    if (data.stop_reason !== 'end_turn') throw new HttpError('La réponse de Claude est incomplète. Réessayez avec un brief plus court.', 502);
    const text = data.content.filter(c => c.type === 'text').map(c => c.text || '').join('');
    if (!text) throw new HttpError('Claude n’a pas renvoyé de proposition utilisable.', 502);
    return { text, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
  }
  const data = await providerJson<{ status: string; output: { content?: { type: string; text?: string }[] }[]; usage?: { input_tokens?: number; output_tokens?: number } }>(response, provider);
  if (data.status !== 'completed') throw new HttpError('La réponse IA est incomplète. Réessayez avec un brief plus court.', 502);
  const text = data.output.flatMap(o => o.content ?? []).filter(c => c.type === 'output_text').map(c => c.text || '').join('');
  if (!text) throw new HttpError('L’IA n’a pas renvoyé de proposition utilisable.', 502);
  return { text, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
}

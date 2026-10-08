import { ZodError } from 'zod';
export class HttpError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function assertLocal(request: Request) {
  const requestUrl = new URL(request.url);
  // Next may canonicalize request.url to localhost; use the actual Host header.
  const url = new URL(`${requestUrl.protocol}//${request.headers.get('host') || requestUrl.host}`);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new HttpError('Ce prototype est réservé à un usage local.', 403);
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) throw new HttpError('Origine de la requête non autorisée.', 403);
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError('Requête externe refusée.', 403);
}
export async function jsonBody(request: Request, limit = 200_000) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError('Une requête JSON est attendue.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError('Requête vide.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > limit) { await reader.cancel(); throw new HttpError('Requête trop volumineuse.', 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch (error) { if (error instanceof SyntaxError) throw new HttpError('JSON invalide.'); throw error; }
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return Response.json({ error: error.issues.map(i => i.message).join(' ') }, { status: 400 });
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return Response.json({ error: 'Élément introuvable.' }, { status: 404 });
  if (error instanceof Error && !/ENOENT|EPERM|EACCES/.test(error.message)) return Response.json({ error: error.message.slice(0, 500) }, { status: 400 });
  return Response.json({ error: 'Une erreur locale est survenue. Consultez le terminal.' }, { status: 500 });
}

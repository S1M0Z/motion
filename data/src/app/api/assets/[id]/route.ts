import { readFile } from 'node:fs/promises';
import { dataPath } from '@/lib/server/storage';
import { assertLocal, errorResponse } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { assertLocal(request); const { id } = await context.params; const buffer = await readFile(dataPath('assets', id, 'webp')); return new Response(buffer, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } }); }
  catch (error) { return errorResponse(error); }
}

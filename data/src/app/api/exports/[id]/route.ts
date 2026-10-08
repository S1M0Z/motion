import { readJson } from '@/lib/server/storage';
import { assertLocal, errorResponse } from '@/lib/server/http';
import type { ExportJob } from '@/lib/spec';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { assertLocal(request); return Response.json(await readJson<ExportJob>('exports', (await context.params).id), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return errorResponse(error); }
}

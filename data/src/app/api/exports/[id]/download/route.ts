import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { dataPath, readJson } from '@/lib/server/storage';
import type { ExportJob } from '@/lib/spec';
import { assertLocal, errorResponse, HttpError } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocal(request); const id = (await context.params).id; const job = await readJson<ExportJob>('exports', id);
    if (job.status !== 'done') throw new HttpError('La vidéo n’est pas encore prête.', 409);
    const target = dataPath('exports', id, 'mp4'); const info = await stat(target);
    return new Response(Readable.toWeb(createReadStream(target)) as ReadableStream, { headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(info.size), 'Content-Disposition': `attachment; filename="motion-${id.slice(0, 8)}.mp4"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return errorResponse(error); }
}

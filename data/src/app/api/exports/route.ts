import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { open, readdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { FORMATS, type ExportJob } from '@/lib/spec';
import { readProject, writeJson, dataPath, DATA_DIR, readJson } from '@/lib/server/storage';
import { assertLocal, errorResponse, HttpError, jsonBody } from '@/lib/server/http';
export const runtime = 'nodejs';
const globalState = globalThis as typeof globalThis & { exportStarting?: boolean };
export async function POST(request: Request) {
  let ownsLock = false;
  try {
    assertLocal(request);
    const input = z.object({ projectId: z.uuid(), revision: z.number().int() }).strict().parse(await jsonBody(request));
    if (globalState.exportStarting) throw new HttpError('Un export est déjà en préparation.', 409);
    globalState.exportStarting = true; ownsLock = true;
    const files = await readdir(path.join(DATA_DIR, 'exports')).catch(() => [] as string[]);
    for (const file of files.filter(f => /^[0-9a-f-]{36}\.json$/.test(f))) {
      const existing = await readJson<ExportJob>('exports', file.slice(0, -5));
      if (['queued', 'rendering'].includes(existing.status)) {
        if (Date.now() - new Date(existing.updatedAt).getTime() < 20 * 60_000) throw new HttpError('Un export est déjà en cours. Attendez sa fin.', 409);
        await writeJson('exports', existing.id, { ...existing, status: 'error', error: 'Le processus de rendu a été interrompu.', phase: 'Rendu interrompu' });
      }
    }
    const project = await readProject(input.projectId);
    if (input.revision !== project.revision) throw new HttpError('Sauvegardez les changements avant l’export.', 409);
    const id = randomUUID(); const now = new Date().toISOString();
    const job: ExportJob = { id, projectId: project.id, status: 'queued', progress: 0, phase: 'Préparation du rendu', createdAt: now, updatedAt: now, ...FORMATS[project.spec.format], duration: project.spec.duration, revision: project.revision };
    // Snapshot is immutable: later edits cannot alter an in-progress video.
    await writeJson('snapshots', id, project.spec); await writeJson('exports', id, job);
    const log = await open(dataPath('exports', id, 'log'), 'a');
    const child = spawn(process.execPath, ['--import', 'tsx', path.join(process.cwd(), 'scripts/render.ts'), id, dataPath('snapshots', id)], { cwd: process.cwd(), env: process.env, stdio: ['ignore', log.fd, log.fd], windowsHide: true });
    child.on('error', async () => { await writeJson('exports', id, { ...job, status: 'error', error: 'Impossible de lancer le processus de rendu.', phase: 'Rendu indisponible' }); });
    child.once('exit', async () => {
      const final = await readJson<ExportJob>('exports', id).catch(() => null);
      if (final && ['queued', 'rendering'].includes(final.status)) await writeJson('exports', id, { ...final, status: 'error', error: 'Le processus de rendu a été interrompu. Consultez son journal dans data/exports.', phase: 'Rendu interrompu', updatedAt: new Date().toISOString() });
    });
    child.unref(); await log.close();
    return Response.json(job, { status: 202 });
  } catch (error) { return errorResponse(error); }
  finally { if (ownsLock) globalState.exportStarting = false; }
}

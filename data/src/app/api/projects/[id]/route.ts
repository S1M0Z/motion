import { z } from 'zod';
import { specSchema } from '@/lib/spec';
import { readProject, validateAssets, writeJson } from '@/lib/server/storage';
import { assertLocal, errorResponse, HttpError, jsonBody } from '@/lib/server/http';
import { edit, engine } from '@/lib/server/ai';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
// A process-wide queue keeps revision checks and writes atomic within the local instance.
const globalQueue = globalThis as typeof globalThis & { projectWrites?: Map<string, Promise<unknown>> };
const queue = globalQueue.projectWrites ??= new Map();
async function serial<T>(id: string, work: () => Promise<T>): Promise<T> {
  const previous = queue.get(id) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(work); queue.set(id, task);
  try { return await task; } finally { if (queue.get(id) === task) queue.delete(id); }
}
export async function GET(request: Request, context: Context) {
  try { assertLocal(request); return Response.json(await readProject((await context.params).id)); } catch (error) { return errorResponse(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    assertLocal(request); const id = (await context.params).id;
    const input = z.object({ spec: specSchema, revision: z.number().int() }).strict().parse(await jsonBody(request));
    return await serial(id, async () => {
      const project = await readProject(id);
      if (input.revision !== project.revision) throw new HttpError('Le projet a changé. Rechargez avant de réessayer.', 409);
      await validateAssets(input.spec.assets);
      const next = { ...project, spec: input.spec, revision: project.revision + 1, updatedAt: new Date().toISOString() };
      await writeJson('projects', id, next); return Response.json(next);
    });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    assertLocal(request); const id = (await context.params).id;
    const input = z.object({ instruction: z.string().trim().min(1).max(1000), revision: z.number().int() }).strict().parse(await jsonBody(request));
    return await serial(id, async () => {
      const project = await readProject(id);
      if (input.revision !== project.revision) throw new HttpError('Le projet a changé. Rechargez avant de réessayer.', 409);
      const { spec, patches, explanation } = await edit(project.spec, input.instruction, project.creativePlan); const now = new Date().toISOString();
      const next = { ...project, spec, engine: engine(), revision: project.revision + 1, updatedAt: now, history: [...project.history, { instruction: input.instruction, patches, explanation, at: now }].slice(-30) };
      await writeJson('projects', id, next); return Response.json({ project: next, patches, explanation });
    });
  } catch (error) { return errorResponse(error); }
}

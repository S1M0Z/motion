import { randomUUID } from 'node:crypto';
import { briefSchema, type Project } from '@/lib/spec';
import { generateDetailed, engine } from '@/lib/server/ai';
import { normalizeUrl } from '@/lib/server/brand';
import { validateAssets, writeJson } from '@/lib/server/storage';
import { assertLocal, errorResponse, jsonBody } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertLocal(request); const brief = briefSchema.parse(await jsonBody(request));
    if (brief.url.trim()) brief.url = normalizeUrl(brief.url.trim()).href;
    await validateAssets(brief.assets);
    const now = new Date().toISOString();
    const generated = await generateDetailed(brief);
    const project: Project = { id: randomUUID(), brief, ...generated, revision: 1, engine: engine(), createdAt: now, updatedAt: now, history: [] };
    await writeJson('projects', project.id, project); return Response.json(project, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { DEFAULT_BRAND, type Asset, type ExportJob, type Project } from '../src/lib/spec';

const base = process.env.SMOKE_URL || 'http://127.0.0.1:3000';
async function request<T>(pathname: string, data?: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(base + pathname, data === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const json = await res.json(); assert.ok(res.ok, `${pathname}: ${JSON.stringify(json)}`); return json as T;
}
async function main() {
  const fixture = await sharp({ create: { width: 960, height: 600, channels: 4, background: '#e8eddf' } }).composite([{ input: Buffer.from('<svg width="960" height="600"><rect x="40" y="40" width="880" height="70" rx="16" fill="#20331a"/><text x="70" y="84" fill="#baff5a" font-family="Arial" font-size="30">Orbit / Product workspace</text><rect x="40" y="140" width="250" height="400" rx="20" fill="#baff5a"/><rect x="320" y="140" width="280" height="400" rx="20" fill="#ffffff"/><rect x="630" y="140" width="290" height="400" rx="20" fill="#ffffff"/><text x="65" y="190" fill="#253c1c" font-family="Arial" font-size="23">Vos projets</text><text x="345" y="190" fill="#253c1c" font-family="Arial" font-size="23">En cours</text><text x="655" y="190" fill="#253c1c" font-family="Arial" font-size="23">Prêt à lancer</text></svg>') }]).png().toBuffer();
  await mkdir('test-results', { recursive: true }); await writeFile('test-results/capture-produit.png', fixture);
  const form = new FormData(); form.append('files', new File([new Uint8Array(fixture)], 'capture-produit.png', { type: 'image/png' }));
  const upload = await fetch(base + '/api/assets', { method: 'POST', body: form }); assert.ok(upload.ok, await upload.clone().text());
  const { assets } = await upload.json() as { assets: Asset[] };
  let project = await request<Project>('/api/projects', { url: '', prompt: '"Les grandes idées commencent ici." "Votre équipe. Un seul espace." Un film premium pour Orbit.', format: '16:9', duration: 8, style: 'premium', brand: DEFAULT_BRAND, assets });
  assert.equal(project.spec.scenes[1].assetId, assets[0].id);
  const edited = await request<{ project: Project }>(`/api/projects/${project.id}`, { revision: project.revision, instruction: 'Accentue le zoom, plus rapide, transition en fondu et CTA "Essayer gratuitement"' }, 'PATCH'); project = edited.project;
  assert.equal(project.spec.scenes.at(-1)?.cta, 'Essayer gratuitement');
  assert.equal(project.spec.scenes[1].motion?.zoom, 1.24);
  assert.ok(project.spec.scenes.every(scene => scene.motion?.pace === 'fast'));
  const stale = await fetch(base + `/api/projects/${project.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: 1, spec: project.spec }) }); assert.equal(stale.status, 409);
  const blocked = await fetch(base + '/api/brand', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://127.0.0.1' }) }); assert.equal(blocked.status, 400);
  const restored = await request<Project>(`/api/projects/${project.id}`); assert.deepEqual(restored.spec, project.spec);
  let job = await request<ExportJob>('/api/exports', { projectId: project.id, revision: project.revision });
  const started = Date.now();
  while (['queued', 'rendering'].includes(job.status) && Date.now() - started < 12 * 60_000) {
    await new Promise(resolve => setTimeout(resolve, 2500)); job = await request<ExportJob>(`/api/exports/${job.id}`); console.log(`${job.phase}: ${Math.round(job.progress * 100)}%`);
  }
  assert.equal(job.status, 'done', job.error || 'Rendu trop long');
  const video = await fetch(base + `/api/exports/${job.id}/download`); assert.equal(video.headers.get('content-type'), 'video/mp4');
  const bytes = Buffer.from(await video.arrayBuffer()); assert.ok(bytes.length > 10_000); assert.equal(bytes.subarray(4, 8).toString(), 'ftyp');
  await writeFile('test-results/demo.mp4', bytes); await writeFile('test-results/project.json', JSON.stringify(project, null, 2)); await writeFile('test-results/export.json', JSON.stringify(job, null, 2));
  console.log('PASS: upload → storyboard → patch → sauvegarde → rendu → MP4 téléchargé.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

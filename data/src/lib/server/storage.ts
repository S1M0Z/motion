import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assetSchema, type Asset, type Project, type VideoSpec, specSchema } from '../spec';

export const DATA_DIR = path.join(process.cwd(), 'data');
export const idSchema = z.uuid();
export function dataPath(folder: string, id: string, extension = 'json') {
  return path.join(DATA_DIR, folder, `${idSchema.parse(id)}.${extension}`);
}
export async function writeJson(folder: string, id: string, value: unknown) {
  const target = dataPath(folder, id);
  await mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2), 'utf8');
  await rename(temp, target);
}
export async function readJson<T>(folder: string, id: string): Promise<T> {
  return JSON.parse(await readFile(dataPath(folder, id), 'utf8')) as T;
}
export async function readProject(id: string) {
  const project = await readJson<Project>('projects', id);
  project.spec = specSchema.parse(project.spec);
  return project;
}
export async function validateAssets(assets: Asset[]) {
  for (const asset of assets) {
    const stored = assetSchema.parse(await readJson<Asset>('assets', asset.id));
    if (stored.src !== asset.src || stored.width !== asset.width || stored.height !== asset.height || asset.src !== `/api/assets/${asset.id}`)
      throw new Error('Asset invalide. Réimportez votre image.');
  }
}
export async function inlineAssets(spec: VideoSpec) {
  await validateAssets(spec.assets);
  return { ...spec, assets: await Promise.all(spec.assets.map(async asset => ({
    ...asset, src: `data:image/webp;base64,${(await readFile(dataPath('assets', asset.id, 'webp'))).toString('base64')}`,
  }))) };
}

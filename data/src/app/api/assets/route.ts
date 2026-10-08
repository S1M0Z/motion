import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type Asset } from '@/lib/spec';
import { dataPath, writeJson } from '@/lib/server/storage';
import { assertLocal, errorResponse, HttpError } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertLocal(request);
    const size = Number(request.headers.get('content-length') || 0);
    if (!size || size > 31_000_000) throw new HttpError('Import limité à 30 Mo par requête.', 413);
    const form = await request.formData();
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (!files.length || files.length > 10) throw new HttpError('Importez de 1 à 10 images.');
    const prepared = await Promise.all(files.map(async file => {
      if (file.size > 10_000_000) throw new HttpError(`${file.name} dépasse 10 Mo.`, 413);
      const source = Buffer.from(await file.arrayBuffer());
      const metadata = await sharp(source, { limitInputPixels: 40_000_000 }).metadata();
      if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '')) throw new HttpError('Images PNG, JPEG et WebP uniquement.');
      const { data, info } = await sharp(source, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).webp({ quality: 92 }).toBuffer({ resolveWithObject: true });
      const id = randomUUID();
      const asset: Asset = { id, name: file.name.slice(0, 150), role: /logo/i.test(file.name) ? 'logo' : 'screenshot', src: `/api/assets/${id}`, width: info.width, height: info.height };
      return { asset, data };
    }));
    for (const { asset, data } of prepared) {
      const target = dataPath('assets', asset.id, 'webp'); await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, data); await writeJson('assets', asset.id, asset);
    }
    return Response.json({ assets: prepared.map(p => p.asset) });
  } catch (error) { return errorResponse(error); }
}

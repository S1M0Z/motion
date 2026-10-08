import { readFile, mkdir } from 'node:fs/promises';
import { existsSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { specSchema, type ExportJob } from '../src/lib/spec';
import { dataPath, inlineAssets, readJson, writeJson } from '../src/lib/server/storage';

// Executed in its own Node process, independently of the Next request lifecycle.
async function main() {
  const jobId = process.argv[2];
  const inputPath = process.argv[3];
  if (!jobId || !inputPath) throw new Error('Usage: npm run render -- <job-uuid> <spec.json>');
  let job = await readJson<ExportJob>('exports', jobId);
  let lastProgress = 0;
  const statusPath = dataPath('exports', jobId);
  function progress(value: number, phase: string, force = false) {
    const now = Date.now(); if (!force && now - lastProgress < 1000) return; lastProgress = now;
    job = { ...job, status: 'rendering', progress: value, phase, updatedAt: new Date().toISOString() };
    const temp = `${statusPath}.progress.tmp`; writeFileSync(temp, JSON.stringify(job)); renameSync(temp, statusPath);
  }
  try {
    const spec = specSchema.parse(JSON.parse(await readFile(inputPath, 'utf8')));
    const inputProps = { spec: await inlineAssets(spec) };
    progress(.02, 'Préparation du studio', true);
    const serveUrl = await bundle({ entryPoint: path.join(process.cwd(), 'src/remotion/index.ts'), onProgress: p => progress(.02 + p / 100 * .08, 'Préparation des animations') });
    const candidates = [process.env.REMOTION_BROWSER_EXECUTABLE, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'];
    const browserExecutable = candidates.find(p => p && existsSync(p));
    progress(.1, 'Ouverture du navigateur de rendu', true);
    const composition = await selectComposition({ serveUrl, id: 'ProductFilm', inputProps, browserExecutable });
    const outputLocation = dataPath('exports', jobId, 'mp4');
    await mkdir(path.dirname(outputLocation), { recursive: true });
    await renderMedia({ serveUrl, composition, inputProps, outputLocation, browserExecutable, codec: 'h264', pixelFormat: 'yuv420p', crf: 20, x264Preset: 'veryfast', concurrency: 1, timeoutInMilliseconds: 90_000,
      onProgress: ({ progress: p }) => progress(.12 + p * .87, 'Rendu des images et encodage MP4') });
    await writeJson('exports', jobId, { ...job, status: 'done', progress: 1, phase: 'Vidéo prête', updatedAt: new Date().toISOString() });
    console.log(`Export terminé: ${outputLocation}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur de rendu';
    console.error(message);
    await writeJson('exports', jobId, { ...job, status: 'error', phase: 'Le rendu a échoué', error: 'Le rendu a échoué. Vérifiez le navigateur de rendu (npm run browser:install) et le journal data/exports/' + jobId + '.log.', updatedAt: new Date().toISOString() });
    process.exitCode = 1;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

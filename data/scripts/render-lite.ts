import path from 'node:path';
import { readFileSync } from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { inlineAssets } from '../src/lib/server/storage';
async function main() {
  const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const inputProps = { spec: await inlineAssets(spec) };
  const serveUrl = await bundle({ entryPoint: path.join(process.cwd(), 'src/remotion/index.ts') });
  const composition = await selectComposition({ serveUrl, id: 'ProductFilm', inputProps });
  const out = '/Users/simon/Downloads/shopify-claude-apercu.mp4';
  let last = -1;
  await renderMedia({ serveUrl, composition, inputProps, outputLocation: out, codec: 'h264', pixelFormat: 'yuv420p', crf: 23, x264Preset: 'veryfast', concurrency: 1, scale: 0.5, timeoutInMilliseconds: 90000,
    onProgress: ({ progress }) => { const p = Math.round(progress * 100); if (p >= last + 10) { last = p; process.stdout.write(` ${p}%`); } } });
  console.log('\nFINI -> ' + out);
}
main().catch(e => { console.error('ECHEC', e.message); process.exitCode = 1; });

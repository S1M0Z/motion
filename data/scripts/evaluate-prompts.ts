import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promptCases } from '../prompts/cases';
import { briefSchema, specSchema } from '../src/lib/spec';
import { generateLocal } from '../src/lib/generator';
import { generateDetailed } from '../src/lib/server/ai';
import { aiConfig } from '../src/lib/server/ai-provider';
import { loadPrompt, PROMPT_VERSION } from '../src/lib/server/prompting';

async function main() {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  const live = process.argv.includes('--live');
  const selectedId = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
  const selected = selectedId ? promptCases.filter(c => c.id === selectedId) : promptCases;
  if (!selected.length) throw new Error(`Cas inconnu : ${selectedId}`);
  for (const name of ['director', 'storyboard', 'patcher', 'repair'] as const) if (!(await loadPrompt(name)).trim()) throw new Error(`Prompt ${name} vide.`);
  if (live && aiConfig().engine !== 'anthropic') throw new Error('Le mode --live nécessite AI_PROVIDER=anthropic et ANTHROPIC_API_KEY dans .env.local.');
  const folder = path.join(process.cwd(), 'test-results', 'prompt-eval', `${Date.now()}-${live ? 'claude' : 'offline'}`);
  await mkdir(folder, { recursive: true }); const results = [];
  for (const fixture of selected) {
    const start = Date.now();
    try {
      const brief = briefSchema.parse(fixture.brief);
      const result = live ? await generateDetailed(brief) : { spec: generateLocal(brief) };
      const spec = specSchema.parse(result.spec);
      const checks = { schema: true, exactDuration: spec.scenes.reduce((sum, s) => sum + s.durationInFrames, 0) === brief.duration * 30, requestedFormat: spec.format === brief.format, requestedStyle: spec.style === brief.style, brand: spec.brand.name === brief.brand.name };
      if (Object.values(checks).some(value => !value)) throw new Error('Une contrainte du brief n’est pas respectée.');
      const record = { case: fixture.id, mode: live ? 'claude' : 'offline-local', promptVersion: PROMPT_VERSION, elapsedMs: Date.now() - start, automatedChecks: checks, creativeQuality: 'À examiner par une personne', review: fixture.review, brief, ...result };
      await writeFile(path.join(folder, `${fixture.id}.json`), JSON.stringify(record, null, 2));
      results.push({ case: fixture.id, status: 'valid', elapsedMs: record.elapsedMs });
      process.stdout.write(`${fixture.id} : structure valide${live ? ' · résultat Claude à relire' : ' · moteur local uniquement'}\n`);
    } catch (error) {
      results.push({ case: fixture.id, status: 'error', error: (error as Error).message }); process.stdout.write(`${fixture.id} : échec\n`);
    }
  }
  await writeFile(path.join(folder, 'summary.json'), JSON.stringify({ mode: live ? 'claude' : 'offline-local', promptVersion: PROMPT_VERSION, results }, null, 2));
  process.stdout.write(`Rapport : ${folder}\n`);
  if (results.some(r => r.status === 'error')) process.exitCode = 1;
}
main().catch(error => { process.stderr.write(`${(error as Error).message}\n`); process.exitCode = 1; });

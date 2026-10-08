import { z } from 'zod';
import { brandSchema, creativePlanSchema, motionSchema, sceneSchema, specSchema, type Brief, type CreativePlan, type GenerationAudit, type VideoSpec, type Patch } from '../spec';
import { generateLocal } from '../generator';
import { applyPatches, localPatches, patchSchema } from '../patches';
import { aiConfig, modelRequest, type ModelContent } from './ai-provider';
import { directorContext, loadPrompt, patchContext, PROMPT_VERSION, storyboardContext, xmlContext, type PromptName } from './prompting';
import { visualContext } from './vision';
import { HttpError } from './http';

export const engine = () => aiConfig().engine;
const sceneOutput = z.object({ title: z.string().min(1).max(100), brand: brandSchema, scenes: z.array(sceneSchema.extend({ motion: motionSchema })).min(3).max(5) }).strict();
const patchOutput = z.object({ patches: z.array(patchSchema).max(30), explanation: z.string().min(1).max(300) }).strict();
function audit(): GenerationAudit {
  const config = aiConfig();
  return { provider: config.engine, model: config.engine === 'local' ? 'local' : config.model, promptVersion: PROMPT_VERSION, repairs: 0, inputTokens: 0, outputTokens: 0, visualAssetIds: [] };
}
function validationMessage(error: unknown) {
  return error instanceof z.ZodError ? JSON.stringify(error.issues.map(i => ({ path: i.path, message: i.message }))) : error instanceof Error ? error.message : 'JSON invalide';
}
// One repair per stage, only after a parse or domain validation failure. Provider errors propagate.
async function structured<T>(schema: z.ZodType<T>, name: PromptName, context: string, usage: GenerationAudit, validate: (value: T) => void, images: ModelContent[] = []): Promise<T> {
  const prompt = await loadPrompt(name);
  const request = async (system: string, input: string) => {
    const reply = await modelRequest(schema, name, system, input, images);
    usage.inputTokens += reply.inputTokens; usage.outputTokens += reply.outputTokens;
    return reply.text;
  };
  let text = await request(prompt, context);
  for (let attempt = 0; attempt < 2; attempt++) {
    try { const value = schema.parse(JSON.parse(text)); validate(value); return value; }
    catch (error) {
      if (attempt === 1) throw new HttpError('La proposition IA reste invalide après une correction. Précisez le brief puis réessayez.', 422);
      usage.repairs++;
      text = await request(`${prompt}\n\n${await loadPrompt('repair')}`, `${context}\n${xmlContext('invalidOutput', text.slice(0, 24_000))}\n${xmlContext('validationErrors', validationMessage(error))}`);
    }
  }
  throw new Error('Validation non atteinte.');
}
function validatePlan(plan: CreativePlan, brief: Brief) {
  if (plan.beats.reduce((sum, b) => sum + b.durationInFrames, 0) !== brief.duration * 30) throw new Error('La somme des beats doit égaler duration × 30.');
  if (plan.beats[0].purpose !== 'hook' || plan.beats.at(-1)!.purpose !== 'cta' || !plan.beats.some(b => b.purpose === 'feature')) throw new Error('Commencer par hook, inclure feature et terminer par cta.');
  for (const beat of plan.beats) {
    if (beat.assetId && !brief.assets.some(a => a.id === beat.assetId)) throw new Error('Asset inconnu dans la direction créative.');
    if (beat.assetId && (beat.purpose !== 'feature' || brief.assets.find(a => a.id === beat.assetId)!.role === 'logo')) throw new Error('Les assets de scène sont des images ou captures, uniquement pour feature. Le logo est rendu automatiquement.');
  }
}
function validateStatistics(spec: VideoSpec, suppliedText: string) {
  const normalize = (text: string) => text.toLowerCase().replace(/[\s\u00a0]/g, '').replace(/,/g, '.');
  for (const scene of spec.scenes) if (scene.statistic && !normalize(suppliedText).includes(normalize(scene.statistic))) throw new Error('Un chiffre clé doit être fourni explicitement dans le brief ou la description du produit.');
}
export async function generateDetailed(brief: Brief): Promise<{ spec: VideoSpec; creativePlan?: CreativePlan; generation: GenerationAudit }> {
  const base = generateLocal(brief); const generation = audit();
  if (engine() === 'local') return { spec: base, generation };
  const vision = engine() === 'anthropic' ? await visualContext(brief.assets) : { blocks: [], ids: [] };
  generation.visualAssetIds = vision.ids;
  const creativePlan = await structured(creativePlanSchema, 'director', directorContext(brief, vision.ids), generation, plan => validatePlan(plan, brief), vision.blocks);
  if (!brief.assets.some(a => a.role !== 'logo') && creativePlan.warnings.length < 5 && !creativePlan.warnings.some(w => /démonstration|demo/i.test(w))) creativePlan.warnings.push('Aucune capture produit : l’aperçu utilisera une interface de démonstration.');
  const output = await structured(sceneOutput, 'storyboard', storyboardContext(brief, creativePlan, vision.ids), generation, candidate => {
    if (candidate.brand.name !== brief.brand.name) throw new Error('Conserver exactement le nom du produit fourni.');
    if (candidate.scenes.length !== creativePlan.beats.length) throw new Error('Une scène par beat de la direction créative.');
    candidate.scenes.forEach((scene, index) => {
      const beat = creativePlan.beats[index];
      if (scene.type !== beat.purpose || scene.durationInFrames !== beat.durationInFrames || scene.assetId !== beat.assetId) throw new Error(`La scène ${index + 1} doit conserver le type, la durée et le visuel du beat correspondant.`);
    });
    const spec = specSchema.parse({ ...base, ...candidate });
    validateStatistics(spec, `${brief.prompt}\n${brief.brand.description}`);
  }, vision.blocks);
  return { spec: specSchema.parse({ ...base, ...output }), creativePlan, generation };
}
export async function generate(brief: Brief): Promise<VideoSpec> { return (await generateDetailed(brief)).spec; }
export async function edit(spec: VideoSpec, instruction: string, plan?: CreativePlan): Promise<{ patches: Patch[]; spec: VideoSpec; explanation: string }> {
  if (engine() === 'local') {
    const patches = localPatches(spec, instruction);
    return { patches, spec: applyPatches(spec, patches), explanation: 'Retouche appliquée par les règles du mode local.' };
  }
  const output = await structured(patchOutput, 'patcher', patchContext(spec, instruction, plan), audit(), candidate => {
    if (!candidate.patches.length) return;
    const next = applyPatches(spec, candidate.patches);
    const supplied = `${instruction}\n${spec.brand.description}\n${spec.scenes.map(s => s.statistic).join('\n')}`;
    validateStatistics(next, supplied);
  });
  if (!output.patches.length) throw new HttpError(output.explanation, 422);
  return { ...output, spec: applyPatches(spec, output.patches) };
}

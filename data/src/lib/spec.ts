import { z } from 'zod';

export const FORMATS = { '16:9': { width: 1920, height: 1080 }, '9:16': { width: 1080, height: 1920 }, '1:1': { width: 1080, height: 1080 } } as const;
export const STYLES = ['premium', 'tech', 'minimal', 'dynamic'] as const;
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const assetSchema = z.object({
  id: z.uuid(), name: z.string().min(1).max(150),
  role: z.enum(['logo', 'screenshot', 'image']),
  src: z.string().regex(/^\/api\/assets\/[0-9a-f-]{36}$/),
  width: z.number().int().positive(), height: z.number().int().positive(),
}).strict();
export const brandSchema = z.object({ name: z.string().min(1).max(60), description: z.string().max(500), accent: color, background: color, foreground: color }).strict();
export const motionSchema = z.object({
  entrance: z.enum(['rise', 'reveal', 'typewriter']),
  pace: z.enum(['slow', 'balanced', 'fast']),
  transition: z.enum(['fade', 'slide', 'wipe']),
  zoom: z.number().min(1).max(1.35),
  focusX: z.number().min(0).max(100), focusY: z.number().min(0).max(100),
}).strict();
export const sceneSchema = z.object({
  id: z.string().regex(/^scene-[a-z0-9-]+$/),
  type: z.enum(['hook', 'feature', 'cta']),
  durationInFrames: z.number().int().min(30).max(900),
  eyebrow: z.string().max(60), title: z.string().min(1).max(100),
  body: z.string().max(200), assetId: z.uuid().nullable(),
  statistic: z.string().max(24), cta: z.string().max(40),
  // Optional for compatibility with projects saved before animation controls.
  motion: motionSchema.optional(),
}).strict();
export const specSchema = z.object({
  version: z.literal(1), title: z.string().min(1).max(100),
  format: z.enum(['16:9', '9:16', '1:1']), fps: z.literal(30),
  duration: z.union([z.literal(8), z.literal(15), z.literal(30)]),
  style: z.enum(STYLES), brand: brandSchema,
  assets: z.array(assetSchema).max(10), scenes: z.array(sceneSchema).min(3).max(5),
}).strict().superRefine((spec, ctx) => {
  if (spec.scenes.reduce((sum, s) => sum + s.durationInFrames, 0) !== spec.duration * spec.fps)
    ctx.addIssue({ code: 'custom', message: 'La durée des scènes doit égaler la durée de la vidéo.' });
  if (new Set(spec.scenes.map(s => s.id)).size !== spec.scenes.length)
    ctx.addIssue({ code: 'custom', message: 'Les identifiants des scènes doivent être uniques.' });
  if (new Set(spec.assets.map(a => a.id)).size !== spec.assets.length)
    ctx.addIssue({ code: 'custom', message: 'Les identifiants des assets doivent être uniques.' });
  for (const s of spec.scenes) if (s.assetId && !spec.assets.some(a => a.id === s.assetId))
    ctx.addIssue({ code: 'custom', message: 'Une scène référence un asset inexistant.' });
  if (!['hook', 'feature', 'cta'].every(t => spec.scenes.some(s => s.type === t)))
    ctx.addIssue({ code: 'custom', message: 'Chaque famille de scène doit être présente.' });
});
export const briefSchema = z.object({
  url: z.string().max(2048), prompt: z.string().max(4000),
  format: z.enum(['16:9', '9:16', '1:1']), duration: z.union([z.literal(8), z.literal(15), z.literal(30)]),
  style: z.enum(STYLES), brand: brandSchema, assets: z.array(assetSchema).max(10),
}).strict().refine(b => b.prompt.trim().length > 0 || b.url.trim().length > 0 || b.assets.length > 0, 'Ajoutez une URL, des assets ou une description.');
export type VideoSpec = z.infer<typeof specSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Motion = z.infer<typeof motionSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Brand = z.infer<typeof brandSchema>;
export type Brief = z.infer<typeof briefSchema>;
export type Patch = { op: 'replace'; path: string; value: string | number };
export const creativePlanSchema = z.object({
  objective: z.string().min(1).max(160), audience: z.string().min(1).max(160),
  centralMessage: z.string().min(1).max(160), visualDirection: z.string().min(1).max(500),
  tone: z.string().min(1).max(100), warnings: z.array(z.string().max(200)).max(5),
  beats: z.array(z.object({
    purpose: z.enum(['hook', 'feature', 'cta']), message: z.string().min(1).max(100),
    assetId: z.uuid().nullable(), durationInFrames: z.number().int().min(30).max(900),
    animationIntent: z.string().min(1).max(160),
  }).strict()).min(3).max(5),
}).strict();
export type CreativePlan = z.infer<typeof creativePlanSchema>;
export type AIEngine = 'local' | 'openai' | 'anthropic';
export type GenerationAudit = { provider: AIEngine; model: string; promptVersion: string; repairs: number; inputTokens: number; outputTokens: number; visualAssetIds: string[] };
export type Project = { id: string; brief: Brief; spec: VideoSpec; revision: number; createdAt: string; updatedAt: string; engine: AIEngine; creativePlan?: CreativePlan; generation?: GenerationAudit; history: { instruction: string; patches: Patch[]; at: string; explanation?: string }[] };
export type ExportJob = { id: string; projectId: string; status: 'queued' | 'rendering' | 'done' | 'error'; progress: number; phase: string; createdAt: string; updatedAt: string; error?: string; width: number; height: number; duration: number; revision: number };
export const DEFAULT_BRAND: Brand = { name: 'Orbit', description: 'Un espace pour vos projets, vos équipes et vos idées.', accent: '#baff5a', background: '#10120f', foreground: '#f5f7ef' };
export function redistribute(spec: VideoSpec, duration: VideoSpec['duration']): VideoSpec {
  const total = duration * spec.fps;
  const remaining = total - 30 * spec.scenes.length;
  const weights = spec.scenes.map(s => Math.max(0, s.durationInFrames - 30));
  const weightTotal = weights.reduce((sum, w) => sum + w, 0);
  let used = 0;
  return { ...spec, duration, scenes: spec.scenes.map((s, i) => {
    const frames = i === spec.scenes.length - 1 ? total - used : 30 + Math.floor(remaining * (weightTotal ? weights[i] / weightTotal : 1 / spec.scenes.length));
    used += frames; return { ...s, durationInFrames: frames };
  }) };
}

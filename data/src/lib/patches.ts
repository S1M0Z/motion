import { z } from 'zod';
import { redistribute, specSchema, STYLES, type Patch, type VideoSpec } from './spec';
import { motionForStyle, sceneMotion } from './motion';

export const patchSchema = z.object({ op: z.literal('replace'), path: z.string().max(160), value: z.union([z.string().max(200), z.number()]) }).strict();
export const patchListSchema = z.array(patchSchema).min(1).max(30);
export const EDITABLE_PATH = /^\/(title|style|format|duration|brand\/(name|description|accent|background|foreground)|scenes\/[0-4]\/(eyebrow|title|body|statistic|cta|motion\/(entrance|pace|transition|zoom|focusX|focusY)))$/;

export function applyPatches(spec: VideoSpec, input: unknown): VideoSpec {
  const patches = patchListSchema.parse(input);
  let next = structuredClone(spec);
  next.scenes = next.scenes.map(scene => ({ ...scene, motion: { ...sceneMotion(scene, next.style) } }));
  for (const p of patches) {
    if (!EDITABLE_PATH.test(p.path)) throw new Error('Ce champ ne peut pas être modifié par un patch.');
    if (p.path === '/duration') {
      if (![8, 15, 30].includes(Number(p.value)) || typeof p.value !== 'number') throw new Error('Durée non prise en charge.');
      next = redistribute(next, p.value as VideoSpec['duration']); continue;
    }
    if (p.path === '/style' && STYLES.includes(p.value as VideoSpec['style'])) {
      next.style = p.value as VideoSpec['style'];
      next.scenes = next.scenes.map(scene => ({ ...scene, motion: motionForStyle(next.style, scene.type) }));
      continue;
    }
    const parts = p.path.slice(1).split('/');
    let target: Record<string, unknown> = next as unknown as Record<string, unknown>;
    for (const key of parts.slice(0, -1)) {
      if (target[key] === undefined || target[key] === null) throw new Error('Chemin de patch inexistant.');
      target = target[key] as Record<string, unknown>;
    }
    target[parts.at(-1)!] = p.value;
  }
  return specSchema.parse(next);
}

export function localPatches(spec: VideoSpec, instruction: string): Patch[] {
  const text = instruction.toLowerCase();
  const patches: Patch[] = [];
  const put = (path: string, value: string | number) => patches.push({ op: 'replace', path, value });
  const requestedScene = text.match(/sc[eè]ne\s*(\d)/);
  const sceneIndex = requestedScene ? Number(requestedScene[1]) - 1 : null;
  if (sceneIndex !== null && (sceneIndex < 0 || sceneIndex >= spec.scenes.length)) throw new Error('Cette scène n’existe pas.');
  const animationScenes = sceneIndex !== null ? [sceneIndex] : spec.scenes.map((_s, i) => i);
  function motionPut(field: string, value: string | number, indices = animationScenes) { indices.forEach(i => put(`/scenes/${i}/motion/${field}`, value)); }
  const duration = text.match(/\b(8|15|30)\s*(?:s\b|secondes?)/);
  if (duration) put('/duration', Number(duration[1]));
  const format = text.match(/9:16|16:9|1:1/);
  if (format) put('/format', format[0]);
  else if (/vertical|portrait/.test(text)) put('/format', '9:16');
  else if (/carré/.test(text)) put('/format', '1:1');
  else if (/horizontal|paysage/.test(text)) put('/format', '16:9');
  const styles = { premium: 'premium', tech: 'tech', minimal: 'minimal', dynamique: 'dynamic', dynamic: 'dynamic' };
  for (const [word, value] of Object.entries(styles)) if (text.includes(word)) { put('/style', value); break; }
  if (/plus rapides?|acc[ée]l[eè]r|rythme rapide/.test(text)) motionPut('pace', 'fast');
  if (/plus lent|ralenti|plus calme|rythme lent/.test(text)) motionPut('pace', 'slow');
  if (/rythme (?:normal|[ée]quilibr[ée])/.test(text)) motionPut('pace', 'balanced');
  if (/mot par mot|r[ée]v[ée]lation/.test(text)) motionPut('entrance', 'reveal');
  if (/machine [àa] [ée]crire|typewriter|texte tap[ée]/.test(text)) motionPut('entrance', 'typewriter');
  if (/entr[ée]e montante|apparition depuis le bas/.test(text)) motionPut('entrance', 'rise');
  if (/fondu/.test(text)) motionPut('transition', 'fade');
  else if (/glissement|gliss[ée]e?/.test(text)) motionPut('transition', 'slide');
  else if (/balayage|wipe/.test(text)) motionPut('transition', 'wipe');
  const featureScenes = animationScenes.filter(i => spec.scenes[i].type === 'feature');
  const explicitZoom = text.match(/zoom\s*(?:[àa]|de)?\s*(\d+(?:[.,]\d+)?)\s*(%|x|×)?/);
  if (explicitZoom) {
    const n = Number(explicitZoom[1].replace(',', '.'));
    motionPut('zoom', explicitZoom[2] === '%' ? n >= 100 ? n / 100 : 1 + n / 100 : n, featureScenes);
  } else if (/sans zoom|supprime[rz]? le zoom/.test(text)) motionPut('zoom', 1, featureScenes);
  else if (/zoom (?:plus )?(?:fort|prononc[ée]|important)|accentue.*zoom|renforce.*zoom/.test(text)) featureScenes.forEach(i => put(`/scenes/${i}/motion/zoom`, Math.min(1.35, Number((sceneMotion(spec.scenes[i], spec.style).zoom + .12).toFixed(2)))));
  else if (/zoom (?:plus )?(?:doux|faible|l[ée]ger)|r[ée]duis.*zoom/.test(text)) motionPut('zoom', 1.05, featureScenes);
  if (/cadrage|focus|zoome sur/.test(text)) {
    if (/gauche/.test(text)) motionPut('focusX', 20, featureScenes);
    else if (/droite/.test(text)) motionPut('focusX', 80, featureScenes);
    if (/haut/.test(text)) motionPut('focusY', 20, featureScenes);
    else if (/bas/.test(text)) motionPut('focusY', 80, featureScenes);
    if (/centr[ée]/.test(text)) { motionPut('focusX', 50, featureScenes); motionPut('focusY', 50, featureScenes); }
  }
  const hex = instruction.match(/#[0-9a-fA-F]{6}\b/);
  const colors: Record<string, string> = { bleu: '#6495ff', violet: '#ad8cff', orange: '#ff9d55', rose: '#ff8db5', vert: '#baff5a' };
  if (hex) put(text.includes('fond') ? '/brand/background' : '/brand/accent', hex[0]);
  else for (const [word, value] of Object.entries(colors)) if (text.includes(word)) { put('/brand/accent', value); break; }
  if (/fond (?:noir|sombre)/.test(text)) { put('/brand/background', '#10120f'); put('/brand/foreground', '#f5f7ef'); }
  if (/fond (?:blanc|clair)/.test(text)) { put('/brand/background', '#f5f7ef'); put('/brand/foreground', '#10120f'); }
  const quote = instruction.match(/[«“"]([^»”"]+)[»”"]/);
  if (quote) {
    const index = sceneIndex ?? (/cta|bouton/.test(text) ? spec.scenes.length - 1 : 0);
    if (index < 0 || index >= spec.scenes.length) throw new Error('Cette scène n’existe pas.');
    put(`/scenes/${index}/${/cta|bouton/.test(text) ? 'cta' : /sous.titre|description|texte secondaire/.test(text) ? 'body' : 'title'}`, quote[1]);
  }
  if (!patches.length) throw new Error('En mode local, essayez : « plus rapide », « accentue le zoom », « transition en fondu », « fond noir », « vertical » ou « titre scène 1 : "Votre texte" ». Une clé IA permet des demandes plus libres.');
  return patches;
}

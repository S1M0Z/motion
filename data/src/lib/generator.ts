import { DEFAULT_BRAND, type Brief, type VideoSpec, specSchema } from './spec';
import { motionForStyle } from './motion';

export function generateLocal(brief: Brief): VideoSpec {
  const prompt = brief.prompt.trim();
  const quoted = [...prompt.matchAll(/[«“"]([^»”"]{2,100})[»”"]/g)].map(m => m[1]);
  const feature = brief.assets.find(a => a.role === 'screenshot') ?? brief.assets.find(a => a.role === 'image');
  const count = brief.duration === 30 ? 5 : 3;
  const durations = count === 5 ? [150, 240, 210, 150, 150] : brief.duration === 8 ? [60, 105, 75] : [105, 210, 135];
  const sentences = prompt.split(/[.!?\n]+/).map(s => s.replace(/^je (veux|souhaite)\s+/i, '').trim()).filter(Boolean);
  const tagline = quoted[0] ?? sentences[0]?.slice(0, 100) ?? 'Vos idées. En mouvement.';
  const benefit = brief.brand.description || 'Tout ce dont votre équipe a besoin, au même endroit.';
  const stat = prompt.match(/\b\d+(?:[.,]\d+)?\s?(?:%|x|×)/)?.[0] ?? '';
  const scenes: VideoSpec['scenes'] = [
    { id: 'scene-hook', type: 'hook', durationInFrames: durations[0], eyebrow: 'RENCONTREZ ' + brief.brand.name.toUpperCase().slice(0, 45), title: tagline, body: 'Moins de friction. Plus de possibilités.', assetId: null, statistic: '', cta: '' },
    { id: 'scene-feature', type: 'feature', durationInFrames: durations[1], eyebrow: 'VOTRE PRODUIT, AU PREMIER PLAN', title: quoted[1] ?? 'Passez de l’idée à l’action.', body: benefit.slice(0, 200), assetId: feature?.id ?? null, statistic: '', cta: '' },
  ];
  if (count === 5) scenes.push(
    { id: 'scene-detail', type: 'feature', durationInFrames: durations[2], eyebrow: 'CONÇU POUR VOS ÉQUIPES', title: 'Un workflow qui avance avec vous.', body: sentences[1]?.slice(0, 200) ?? 'Créez, partagez et gardez le cap.', assetId: brief.assets.filter(a => a.role !== 'logo')[1]?.id ?? feature?.id ?? null, statistic: '', cta: '' },
    { id: 'scene-benefit', type: 'cta', durationInFrames: durations[3], eyebrow: 'LE BÉNÉFICE', title: stat ? 'Le résultat parle de lui-même.' : 'Faites de la place à l’essentiel.', body: stat ? 'Chiffre fourni dans votre brief.' : 'Votre prochaine idée mérite de prendre vie.', assetId: null, statistic: stat, cta: '' },
  );
  scenes.push({ id: 'scene-cta', type: 'cta', durationInFrames: durations.at(-1)!, eyebrow: 'À VOUS DE JOUER', title: 'Votre prochain chapitre commence ici.', body: brief.url ? new URL(brief.url).hostname : brief.brand.name, assetId: null, statistic: count === 3 ? stat : '', cta: 'Découvrir ' + brief.brand.name.slice(0, 28) });
  return specSchema.parse({ version: 1, title: `${brief.brand.name} — film produit`, fps: 30, format: brief.format, duration: brief.duration, style: brief.style, brand: brief.brand, assets: brief.assets, scenes: scenes.map(scene => ({ ...scene, motion: motionForStyle(brief.style, scene.type) })) });
}

export const DEMO_SPEC: VideoSpec = generateLocal({ url: '', prompt: '"Les grandes idées commencent ici." "Votre équipe. Un seul espace." Présente un outil de gestion de projets, avec un zoom sur le dashboard et un CTA.', format: '16:9', duration: 15, style: 'premium', brand: DEFAULT_BRAND, assets: [] });

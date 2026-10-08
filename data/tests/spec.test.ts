import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateLocal } from '../src/lib/generator';
import { DEFAULT_BRAND, FORMATS, STYLES, redistribute, specSchema, type Brief } from '../src/lib/spec';
import { applyPatches, localPatches } from '../src/lib/patches';
import { isPublicAddress, normalizeUrl } from '../src/lib/server/brand';

const brief: Brief = { prompt: '"Lancez votre produit" Une capture, puis un CTA.', url: '', format: '16:9', duration: 15, style: 'premium', assets: [], brand: DEFAULT_BRAND };
test('all 36 duration/format/style combinations yield valid complete timelines', () => {
  for (const duration of [8, 15, 30] as const) for (const format of Object.keys(FORMATS) as Brief['format'][]) for (const style of STYLES) {
    const spec = generateLocal({ ...brief, duration, format, style });
    assert.ok(specSchema.safeParse(spec).success);
    assert.equal(spec.scenes.reduce((n, s) => n + s.durationInFrames, 0), duration * 30);
    assert.equal(spec.scenes.length, duration === 30 ? 5 : 3);
  }
});
test('draft text and supplied statistics are used, numerical benefits are never invented', () => {
  const spec = generateLocal(brief); assert.equal(spec.scenes[0].title, 'Lancez votre produit');
  assert.ok(spec.scenes.every(s => s.statistic === ''));
  assert.equal(generateLocal({ ...brief, prompt: 'Gagnez 42% de temps.' }).scenes.at(-1)?.statistic, '42%');
});
test('shortening five scenes keeps at least one second per scene and the exact total', () => {
  const spec = generateLocal({ ...brief, duration: 30 });
  spec.scenes[0].durationInFrames = 30; spec.scenes[1].durationInFrames += 120;
  const result = redistribute(spec, 8);
  assert.equal(result.scenes.reduce((n, s) => n + s.durationInFrames, 0), 240);
  assert.ok(result.scenes.every(s => s.durationInFrames >= 30)); assert.ok(specSchema.safeParse(result).success);
});
test('natural retouches update color, duration, format and CTA without mutating input', () => {
  const spec = generateLocal(brief);
  const patches = localPatches(spec, 'Accent bleu, format vertical, 8 secondes et CTA "Essayer gratuitement"');
  const next = applyPatches(spec, patches);
  assert.equal(next.brand.accent, '#6495ff'); assert.equal(next.duration, 8); assert.equal(next.format, '9:16');
  assert.equal(next.scenes.at(-1)?.cta, 'Essayer gratuitement'); assert.equal(spec.duration, 15);
});
test('patches are allowlisted and atomic; invalid updates do not escape the schema', () => {
  const spec = generateLocal(brief);
  for (const path of ['/__proto__/polluted', '/assets/0/src', '/scenes/0/id', '/scenes/0/durationInFrames', '/fps'])
    assert.throws(() => applyPatches(spec, [{ op: 'replace', path, value: 'bad' }]));
  assert.throws(() => applyPatches(spec, [{ op: 'replace', path: '/brand/accent', value: '#111111' }, { op: 'replace', path: '/duration', value: 9 }]));
  assert.equal(spec.brand.accent, DEFAULT_BRAND.accent);
  assert.throws(() => applyPatches(spec, [{ op: 'replace', path: '/scenes/4/title', value: 'Missing scene' }]));
  assert.throws(() => applyPatches(spec, [{ op: 'replace', path: '/scenes/0/title', value: '' }]));
});
test('invalid timeline, duplicate IDs and external asset references are rejected', () => {
  const spec = generateLocal(brief); const invalid = structuredClone(spec); invalid.scenes[0].durationInFrames++;
  assert.ok(!specSchema.safeParse(invalid).success);
  invalid.scenes[0].durationInFrames--; invalid.scenes[1].id = invalid.scenes[0].id;
  assert.ok(!specSchema.safeParse(invalid).success);
  const missing = structuredClone(spec); missing.scenes[1].assetId = '62e46081-022d-484e-88d7-d11e5873e171'; assert.ok(!specSchema.safeParse(missing).success);
});
test('URL analysis blocks private, loopback, link-local and mapped private addresses', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '192.168.0.1', '169.254.169.254', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '0.0.0.0']) assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress('8.8.8.8'), true); assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
  for (const url of ['http://example.com', 'https://user:password@example.com', 'https://example.com:8443', 'https://localhost']) assert.throws(() => normalizeUrl(url));
  assert.equal(normalizeUrl('example.com').href, 'https://example.com/');
});

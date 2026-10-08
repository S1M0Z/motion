import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLocal } from '../src/lib/generator';
import { DEFAULT_BRAND, specSchema, type Brief } from '../src/lib/spec';
import { applyPatches, localPatches } from '../src/lib/patches';
import { easeOut, motionForStyle, motionTiming, sceneMotion, videoTimeline } from '../src/lib/motion';

const brief: Brief = { url: '', prompt: 'Un film pour Orbit', format: '16:9', duration: 8, style: 'premium', brand: DEFAULT_BRAND, assets: [] };
test('legacy project specs remain readable and their animation controls can be patched', () => {
  const spec = generateLocal(brief); spec.scenes.forEach(scene => { delete scene.motion; });
  assert.ok(specSchema.safeParse(spec).success);
  const next = applyPatches(spec, [{ op: 'replace', path: '/scenes/1/motion/zoom', value: 1.25 }]);
  assert.equal(next.scenes[1].motion?.zoom, 1.25); assert.equal(spec.scenes[1].motion, undefined);
});
test('transitions overlap previous scenes without changing the total video duration', () => {
  for (const duration of [8, 15, 30] as const) {
    const spec = generateLocal({ ...brief, duration }); const timeline = videoTimeline(spec);
    assert.equal(timeline[0].from, 0);
    assert.equal(timeline.at(-1)!.from + timeline.at(-1)!.durationInFrames, duration * 30);
    for (let i = 0; i < timeline.length - 1; i++) {
      assert.equal(timeline[i + 1].from, timeline[i].from + spec.scenes[i].durationInFrames);
      assert.ok(timeline[i].from + timeline[i].durationInFrames > timeline[i + 1].from);
    }
  }
});
test('a targeted zoom and pace retouch changes the requested scene and preserves the timeline', () => {
  const spec = generateLocal(brief);
  const next = applyPatches(spec, localPatches(spec, 'Scène 2, accentue le zoom et rends les animations plus rapides, transition en balayage'));
  assert.equal(next.scenes[1].motion?.zoom, 1.24); assert.equal(next.scenes[1].motion?.pace, 'fast');
  assert.equal(next.scenes[1].motion?.transition, 'wipe');
  assert.deepEqual(next.scenes[0], spec.scenes[0]);
  assert.equal(next.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0), 240);
});
test('focus, typing, reset zoom and artistic direction are controllable', () => {
  const spec = generateLocal(brief);
  let next = applyPatches(spec, localPatches(spec, 'Scène 2, zoom 25%, cadrage en haut à droite et texte tapé'));
  assert.equal(next.scenes[1].motion?.zoom, 1.25); assert.equal(next.scenes[1].motion?.focusX, 80);
  assert.equal(next.scenes[1].motion?.focusY, 20); assert.equal(next.scenes[1].motion?.entrance, 'typewriter');
  next = applyPatches(next, localPatches(next, 'Sans zoom'));
  assert.equal(next.scenes[1].motion?.zoom, 1);
  next = applyPatches(next, [{ op: 'replace', path: '/style', value: 'dynamic' }]);
  assert.deepEqual(next.scenes[1].motion, motionForStyle('dynamic', 'feature'));
});
test('out of range zoom, injected animation keys and unrecognized effects are rejected atomically', () => {
  const spec = generateLocal(brief);
  for (const patch of [
    { op: 'replace', path: '/scenes/1/motion/zoom', value: 2 },
    { op: 'replace', path: '/scenes/1/motion/focusX', value: -1 },
    { op: 'replace', path: '/scenes/1/motion/entrance', value: 'execute-script' },
    { op: 'replace', path: '/scenes/1/motion/__proto__', value: 'bad' },
  ]) assert.throws(() => applyPatches(spec, [patch]));
  assert.equal(spec.scenes[1].motion?.zoom, 1.12);
});
test('pace changes animation timings; easing remains bounded and deterministic', () => {
  const spec = generateLocal(brief); const scene = spec.scenes[1];
  const slow = motionTiming({ ...scene, motion: { ...sceneMotion(scene, spec.style), pace: 'slow' } }, spec.style);
  const fast = motionTiming({ ...scene, motion: { ...sceneMotion(scene, spec.style), pace: 'fast' } }, spec.style);
  assert.ok(slow.entranceFrames > fast.entranceFrames); assert.ok(slow.transitionFrames > fast.transitionFrames);
  assert.equal(easeOut(-10), 0); assert.equal(easeOut(10), 1); assert.ok(easeOut(.5) > .5);
});

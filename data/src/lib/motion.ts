import type { Motion, Scene, VideoSpec } from './spec';

export function motionForStyle(style: VideoSpec['style'], type: Scene['type']): Motion {
  const presets: Record<VideoSpec['style'], Motion> = {
    premium: { entrance: 'reveal', pace: 'balanced', transition: 'fade', zoom: 1.12, focusX: 50, focusY: 50 },
    tech: { entrance: 'typewriter', pace: 'balanced', transition: 'wipe', zoom: 1.18, focusX: 50, focusY: 50 },
    minimal: { entrance: 'rise', pace: 'slow', transition: 'fade', zoom: 1.05, focusX: 50, focusY: 50 },
    dynamic: { entrance: 'reveal', pace: 'fast', transition: 'slide', zoom: 1.25, focusX: 50, focusY: 50 },
  };
  return { ...presets[style], ...(type === 'cta' ? { entrance: 'rise' as const } : {}) };
}
export const sceneMotion = (scene: Scene, style: VideoSpec['style']): Motion => scene.motion ?? motionForStyle(style, scene.type);
export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const easeOut = (value: number) => 1 - (1 - clamp01(value)) ** 3;
export function motionTiming(scene: Scene, style: VideoSpec['style']) {
  const motion = sceneMotion(scene, style);
  const ratio = motion.pace === 'fast' ? .7 : motion.pace === 'slow' ? 1.35 : 1;
  return {
    entranceFrames: Math.min(Math.round(34 * ratio), Math.max(12, scene.durationInFrames - 8)),
    transitionFrames: Math.min(Math.round(14 * ratio), Math.floor(scene.durationInFrames / 3)),
    stagger: motion.pace === 'fast' ? 2 : motion.pace === 'slow' ? 5 : 3,
  };
}
export function videoTimeline(spec: VideoSpec) {
  let cursor = 0;
  return spec.scenes.map((scene, index) => {
    const from = cursor; cursor += scene.durationInFrames;
    const overlap = index < spec.scenes.length - 1 ? motionTiming(spec.scenes[index + 1], spec.style).transitionFrames : 0;
    // Preserve total duration. The previous scene stays behind the incoming one.
    return { from, durationInFrames: scene.durationInFrames + overlap, overlap };
  });
}

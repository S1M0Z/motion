import React from 'react';
import { AbsoluteFill, Img, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FORMATS, type Motion, type Scene, type VideoSpec } from '../lib/spec';
import { clamp01, easeOut, motionTiming, sceneMotion, videoTimeline } from '../lib/motion';

export type MotionProps = { spec: VideoSpec };
function AnimatedTitle({ scene, motion, frame, fps, entranceFrames, stagger }: { scene: Scene; motion: Motion; frame: number; fps: number; entranceFrames: number; stagger: number }) {
  if (motion.entrance === 'typewriter') {
    const count = Math.floor(scene.title.length * clamp01((frame - 3) / Math.min(scene.durationInFrames - 10, entranceFrames * 1.6)));
    return <div style={{ position: 'relative' }}><span style={{ visibility: 'hidden' }}>{scene.title}</span><span style={{ position: 'absolute', inset: 0 }}>{scene.title.slice(0, count)}{count < scene.title.length && <span style={{ display: 'inline-block', width: 3, height: '.85em', marginLeft: 6, background: 'currentColor', opacity: Math.floor(frame / 9) % 2 ? .2 : .85 }}/>}</span></div>;
  }
  if (motion.entrance === 'reveal') {
    const words = scene.title.split(/\s+/);
    const delay = Math.min(stagger, Math.max(1, Math.floor((scene.durationInFrames - entranceFrames - 12) / Math.max(1, words.length))));
    return <>{words.map((word, i) => {
      const progress = spring({ frame: frame - i * delay, fps, durationInFrames: entranceFrames, config: { damping: 24, overshootClamping: true } });
      return <span key={i} style={{ display: 'inline-block', maxWidth: '100%', overflowWrap: 'anywhere', marginRight: i < words.length - 1 ? '.22em' : 0, opacity: progress, transform: `translateY(${(1 - progress) * 30}px)`, filter: `blur(${(1 - progress) * 6}px)` }}>{word}</span>;
    })}</>;
  }
  return <>{scene.title}</>;
}
function ProductMock({ accent }: { accent: string }) {
  return <div style={{ width: '100%', height: '100%', background: '#f1f3ec', color: '#22291f', display: 'flex', borderRadius: 16, overflow: 'hidden', textAlign: 'left' }}>
    <div style={{ width: '23%', borderRight: '1px solid #dce0d5', padding: '5%', fontSize: 20 }}>
      <b style={{ fontSize: 25 }}>◈ Workspace</b>
      {['Vue d’ensemble', 'Projets', 'Équipe', 'Activité'].map((t, i) => <div key={t} style={{ padding: '14px 8px', marginTop: 18, borderRadius: 8, background: i === 0 ? accent : 'transparent', fontSize: 18 }}>{t}</div>)}
    </div>
    <div style={{ flex: 1, padding: '5%' }}><div style={{ fontSize: 18, color: '#74806b' }}>VOTRE ESPACE DE TRAVAIL</div><h2 style={{ fontSize: 36, margin: '16px 0 30px' }}>Tout avance ensemble.</h2>
      <div style={{ display: 'flex', gap: 16 }}>{['À explorer', 'En cours', 'Prêt à lancer'].map((t, i) => <div key={t} style={{ flex: 1, background: '#e6e9e0', padding: 14, borderRadius: 12, fontSize: 17 }}><b>{t}</b>{[0, 1, 2].map(n => <div key={n} style={{ marginTop: 14, background: '#fff', borderRadius: 9, padding: 18, height: 83 }}><div style={{ height: 6, width: `${55 + n * 12}%`, background: i === 1 ? accent : '#b4bdab', borderRadius: 3 }}/><div style={{ marginTop: 14, height: 6, width: '75%', background: '#e5e9df', borderRadius: 3 }}/><div style={{ marginTop: 14, width: 18, height: 18, borderRadius: 20, background: accent }}/></div>)}</div>)}</div>
    </div>
  </div>;
}
function AnimatedScene({ scene, spec, index }: { scene: Scene; spec: VideoSpec; index: number }) {
  const sequenceFrame = useCurrentFrame(); const { fps, width, height } = useVideoConfig();
  const frame = Math.min(sequenceFrame, scene.durationInFrames - 1);
  const motion = sceneMotion(scene, spec.style);
  const { entranceFrames, transitionFrames, stagger } = motionTiming(scene, spec.style);
  const transition = easeOut(sequenceFrame / transitionFrames);
  const portrait = height > width; const square = width === height;
  const minimal = spec.style === 'minimal'; const dynamic = spec.style === 'dynamic';
  const dark = parseInt(spec.brand.background.slice(1, 3), 16) < 150;
  const accent = spec.brand.accent;
  const enter = spring({ frame, fps, config: { damping: dynamic ? 16 : 24, stiffness: dynamic ? 140 : 90 }, durationInFrames: entranceFrames });
  const opacity = motion.entrance === 'rise' ? clamp01(enter) : 1;
  const secondary = easeOut((frame - Math.min(entranceFrames * .45, scene.durationInFrames / 4)) / 14);
  const zoom = 1 + (motion.zoom - 1) * easeOut(frame / Math.max(1, scene.durationInFrames - 1));
  const asset = spec.assets.find(a => a.id === scene.assetId);
  const logo = spec.assets.find(a => a.role === 'logo');
  const wordmark = !!logo && logo.width / logo.height > 2;
  const isFeature = scene.type === 'feature';
  const unit = width / 1920;
  const titleSize = portrait ? 88 : square ? 86 : isFeature ? 82 : 112;
  const longTitle = scene.title.length > 65;
  const gridSize = portrait ? 70 : 85;
  const drift = Math.sin(frame / 80) * 25;
  return <AbsoluteFill style={{ backgroundColor: spec.brand.background, color: spec.brand.foreground, overflow: 'hidden', fontFamily: 'Arial, Helvetica, sans-serif', opacity: index > 0 && motion.transition === 'fade' ? transition : 1, transform: index > 0 && motion.transition === 'slide' ? `translateX(${width * (1 - transition)}px)` : undefined, clipPath: index > 0 && motion.transition === 'wipe' ? `inset(0 ${(1 - transition) * 100}% 0 0)` : undefined }}>
    {!minimal && <>
      <AbsoluteFill style={{ opacity: spec.style === 'tech' ? 0.13 : 0.055, backgroundImage: `linear-gradient(${spec.brand.foreground} 1px, transparent 1px), linear-gradient(90deg, ${spec.brand.foreground} 1px, transparent 1px)`, backgroundSize: `${gridSize}px ${gridSize}px` }}/>
      <div style={{ position: 'absolute', width: width * .7, height: width * .7, borderRadius: '50%', background: accent, opacity: dark ? .13 : .1, filter: `blur(${Math.round(60 * unit)}px)`, right: -width * .25, top: height * .1 + drift }}/>
      <div style={{ position: 'absolute', width: width * .4, height: width * .4, border: `1px solid ${accent}`, opacity: .22, borderRadius: '50%', right: -width * .08, bottom: -width * .12, transform: `scale(${1 + frame / 1800})` }}/>
    </>}
    <div style={{ position: 'absolute', left: portrait ? 70 : 96 * unit, top: portrait ? 80 : 68 * unit, right: 80, display: 'flex', alignItems: 'center', gap: 18 }}>
      {logo ? <Img src={logo.src} style={{ width: wordmark ? portrait ? 230 : 190 * unit : portrait ? 66 : 50 * unit, height: portrait ? 66 : 50 * unit, objectFit: 'contain', objectPosition: 'left center' }}/> : <div style={{ width: portrait ? 52 : 40 * unit, height: portrait ? 52 : 40 * unit, borderRadius: 12, background: accent, color: spec.brand.background, display: 'grid', placeItems: 'center', fontSize: portrait ? 36 : 28 * unit, fontWeight: 900 }}>◈</div>}
      {!wordmark && <span style={{ fontSize: portrait ? 34 : 27 * unit, fontWeight: 700, letterSpacing: -1 }}>{spec.brand.name}</span>}
    </div>
    <div style={{ position: 'absolute', inset: portrait ? '240px 70px 180px' : square ? '160px 65px 110px' : `${200 * unit}px ${96 * unit}px ${130 * unit}px`, opacity, display: 'flex', flexDirection: isFeature && !portrait && !square ? 'row' : 'column', justifyContent: 'center', alignItems: isFeature ? 'stretch' : 'center', gap: portrait ? 72 : 70 * unit, textAlign: isFeature ? 'left' : 'center', transform: motion.entrance === 'rise' ? `translateY(${(1 - enter) * 55}px)` : undefined }}>
      <div style={{ flex: isFeature && !portrait && !square ? .85 : undefined, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ color: accent, fontSize: portrait ? 24 : 22 * unit, fontWeight: 700, letterSpacing: 4, marginBottom: portrait ? 38 : 30 * unit, opacity: clamp01(enter) }}>{scene.eyebrow}</div>
        {scene.statistic && scene.type === 'cta' && <div style={{ fontSize: portrait ? 180 : 165 * unit, color: accent, fontWeight: 900, lineHeight: 1, marginBottom: 30, letterSpacing: -8 }}>{scene.statistic}</div>}
        <div style={{ fontSize: titleSize * (portrait || square ? 1 : unit) * (longTitle ? .78 : 1), fontWeight: 800, lineHeight: 1.07, letterSpacing: portrait ? -4 : -5 * unit, maxWidth: isFeature ? undefined : 1450 * (portrait ? 1 : unit), overflowWrap: 'anywhere', textWrap: 'balance' }}><AnimatedTitle scene={scene} motion={motion} frame={frame} fps={fps} entranceFrames={entranceFrames} stagger={stagger}/></div>
        {scene.body && <div style={{ fontSize: portrait ? 33 : 30 * unit, lineHeight: 1.5, opacity: .62 * secondary, marginTop: portrait ? 34 : 32 * unit, maxWidth: isFeature ? undefined : 1000 * (portrait ? 1 : unit), alignSelf: isFeature ? 'auto' : 'center', transform: `translateY(${(1 - secondary) * 14}px)` }}>{scene.body}</div>}
        {scene.cta && <div style={{ marginTop: portrait ? 58 : 50 * unit, alignSelf: isFeature ? 'flex-start' : 'center', padding: portrait ? '28px 44px' : `${24 * unit}px ${40 * unit}px`, background: accent, color: spec.brand.background, borderRadius: 100, fontSize: portrait ? 30 : 27 * unit, fontWeight: 700, opacity: secondary, transform: `scale(${.94 + secondary * .06})` }}>{scene.cta} <span style={{ marginLeft: 24 }}>↗</span></div>}
      </div>
      {isFeature && <div style={{ flex: !portrait && !square ? 1.3 : undefined, height: portrait ? 570 : square ? 360 : undefined, minHeight: !portrait && !square ? 450 * unit : undefined, display: 'flex', alignItems: 'center', opacity: clamp01(enter), transform: `perspective(1800px) rotateY(${!portrait && !square ? -7 * (1 - enter) : 0}deg) translateY(${(1 - enter) * 35}px) scale(${.94 + clamp01(enter) * .06})` }}>
        <div style={{ width: '100%', aspectRatio: '16 / 10', borderRadius: 22, boxShadow: `0 30px 90px ${dark ? '#0008' : '#0002'}`, border: `2px solid ${spec.brand.foreground}25`, background: '#f1f3ec', overflow: 'hidden' }}>
          <div style={{ height: 34, background: '#e3e7db', display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 18 }}>{['#ff8d89', '#f9ce72', '#a0ce80'].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: 10, background: c }}/>)}</div>
          <div style={{ height: 'calc(100% - 34px)', overflow: 'hidden' }}><div style={{ width: '100%', height: '100%', transform: `scale(${zoom})`, transformOrigin: `${motion.focusX}% ${motion.focusY}%` }}>{asset ? <Img src={asset.src} style={{ width: '100%', height: '100%', objectFit: asset.width / asset.height > 2.5 ? 'cover' : 'contain', objectPosition: `${motion.focusX}% ${motion.focusY}%` }}/> : <ProductMock accent={accent}/>}</div></div>
        </div>
      </div>}
    </div>
    <div style={{ position: 'absolute', left: portrait ? 70 : 96 * unit, right: portrait ? 70 : 96 * unit, bottom: portrait ? 75 : 65 * unit, display: 'flex', justifyContent: 'space-between', fontSize: portrait ? 20 : 17 * unit, opacity: .38, letterSpacing: 3 }}><span>{spec.brand.name.toUpperCase()} / PRODUCT FILM</span><span>{String(index + 1).padStart(2, '0')} — {String(spec.scenes.length).padStart(2, '0')}</span></div>
    <div style={{ position: 'absolute', bottom: 0, height: 4, width: `${Math.min(100, frame / scene.durationInFrames * 100)}%`, background: accent }}/>
  </AbsoluteFill>;
}
export const MotionVideo: React.FC<MotionProps> = ({ spec }) => {
  const timeline = videoTimeline(spec);
  return <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: spec.brand.background }}>{spec.scenes.map((scene, index) => {
    return <Sequence key={scene.id} from={timeline[index].from} durationInFrames={timeline[index].durationInFrames}><AnimatedScene scene={scene} spec={spec} index={index}/></Sequence>;
  })}</AbsoluteFill>;
};
export const videoDimensions = (spec: VideoSpec) => FORMATS[spec.format];

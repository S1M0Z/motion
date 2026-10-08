import React from 'react';
import { Composition } from 'remotion';
import { DEMO_SPEC } from '../lib/generator';
import { MotionVideo, videoDimensions } from './MotionVideo';
export const RemotionRoot: React.FC = () => <Composition
  id="ProductFilm" component={MotionVideo} defaultProps={{ spec: DEMO_SPEC }} fps={30} durationInFrames={450} width={1920} height={1080}
  calculateMetadata={({ props }) => ({ ...videoDimensions(props.spec), durationInFrames: props.spec.duration * props.spec.fps, fps: props.spec.fps })}
/>;

import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';

export const ProductRegister: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const entry = spring({frame, fps, config: {damping: 12, stiffness: 150}});
  const opacity = interpolate(entry, [0, 1], [0, 1]);
  const blur = interpolate(frame, [0, 8], [5, 0], {extrapolateRight: 'clamp'});

  const textSpring = spring({frame: Math.max(0, frame - 20), fps, config: {damping: 12, stiffness: 100}});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', overflow: 'hidden'}}>
      <div style={{
        opacity,
        filter: `blur(${blur}px)`,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 0 80px rgba(59,130,246,0.2)',
      }}>
        <OffthreadVideo volume={0}
          src={staticFile('clips/register.mp4')}
          startFrom={40}
          style={{width: 1600}}
        />
      </div>

      <div style={{
        position: 'absolute',
        top: 60,
        fontFamily: 'Inter, sans-serif',
        fontSize: 48,
        fontWeight: 800,
        color: '#fafafa',
        opacity: textSpring,
        transform: `translateY(${interpolate(textSpring, [0, 1], [30, 0])}px)`,
        textShadow: '0 4px 30px rgba(0,0,0,0.9)',
      }}>
        Register your agent in 4 steps.
      </div>
    </AbsoluteFill>
  );
};

import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';

export const ProductDashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const entry = spring({frame, fps, config: {damping: 12, stiffness: 150}});
  const opacity = interpolate(entry, [0, 1], [0, 1]);
  const blur = interpolate(frame, [0, 8], [5, 0], {extrapolateRight: 'clamp'});

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
          src={staticFile('clips/dashboard.mp4')}
          startFrom={5}
          style={{width: 1600}}
        />
      </div>
    </AbsoluteFill>
  );
};

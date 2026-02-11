import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';

export const ProductDocs: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Fly in from bottom with spring
  const entry = spring({frame, fps, config: {damping: 10, stiffness: 120}});
  const translateY = interpolate(entry, [0, 1], [800, 0]);
  const blur = interpolate(frame, [0, 12], [10, 0], {extrapolateRight: 'clamp'});

  // Slow zoom in
  const zoom = interpolate(frame, [20, 180], [1, 1.15], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // Tilt effect
  const tilt = interpolate(frame, [0, 180], [2, 0], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', overflow: 'hidden'}}>
      <div style={{
        transform: `translateY(${translateY}px) scale(${zoom}) perspective(1000px) rotateX(${tilt}deg)`,
        filter: `blur(${blur}px)`,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 0 80px rgba(59,130,246,0.2)',
      }}>
        <OffthreadVideo volume={0} src={staticFile('clips/docs.mp4')} style={{width: 1500}} />
      </div>

      {/* Overlay */}
      <div style={{
        position: 'absolute',
        bottom: 60,
        fontFamily: 'Inter, sans-serif',
        fontSize: 42,
        fontWeight: 700,
        color: '#3b82f6',
        opacity: interpolate(frame, [30, 50], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
        textShadow: '0 2px 20px rgba(0,0,0,0.8)',
      }}>
        Complete developer documentation.
      </div>
    </AbsoluteFill>
  );
};

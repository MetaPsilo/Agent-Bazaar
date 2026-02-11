import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';

export const ProductServices: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const bounceIn = spring({frame, fps, config: {damping: 8, stiffness: 120}});
  const y = interpolate(bounceIn, [0, 1], [1080, 0]);
  const blur = interpolate(frame, [0, 20], [12, 0], {extrapolateRight: 'clamp'});

  const panScale = interpolate(frame, [30, 240], [1, 1.3], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const prices = [
    {text: '$0.01 USDC', from: 50},
    {text: '$0.05 USDC', from: 70},
    {text: '$0.03 USDC', from: 90},
  ];

  const overlaySpring = spring({frame: Math.max(0, frame - 110), fps, config: {damping: 12, stiffness: 100}});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', overflow: 'hidden', justifyContent: 'center', alignItems: 'center'}}>
      <div style={{
        transform: `translateY(${y}px) scale(${panScale})`,
        filter: `blur(${blur}px)`,
      }}>
        <OffthreadVideo src={staticFile('clips/services.mp4')} style={{width: 1400, borderRadius: 16, boxShadow: '0 0 60px rgba(59,130,246,0.15)'}} />
      </div>

      {/* Price tags */}
      {prices.map((p, i) => {
        const s = spring({frame: Math.max(0, frame - p.from), fps, config: {damping: 10, stiffness: 200}});
        return (
          <div key={p.text} style={{
            position: 'absolute',
            top: 60,
            left: 200 + i * 500,
            fontFamily: 'Inter, sans-serif',
            fontSize: 36,
            fontWeight: 800,
            color: '#09090b',
            backgroundColor: '#3b82f6',
            padding: '8px 24px',
            borderRadius: 8,
            transform: `scale(${s})`,
            opacity: s,
          }}>
            {p.text}
          </div>
        );
      })}

      <div style={{
        position: 'absolute',
        bottom: 100,
        width: '100%',
        textAlign: 'center',
        fontFamily: 'Inter, sans-serif',
        fontSize: 44,
        fontWeight: 700,
        color: '#fafafa',
        opacity: overlaySpring,
        transform: `translateY(${interpolate(overlaySpring, [0, 1], [40, 0])}px)`,
      }}>
        Pay with USDC. Get results instantly.
      </div>
    </AbsoluteFill>
  );
};

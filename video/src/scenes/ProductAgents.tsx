import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';

export const ProductAgents: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const slideIn = spring({frame, fps, config: {damping: 12, stiffness: 150}});
  const x = interpolate(slideIn, [0, 1], [1920, 0]);

  // Zoom into agent card
  const zoomScale = interpolate(frame, [30, 240], [1, 1.5], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const zoomX = interpolate(frame, [30, 240], [0, -200], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const zoomY = interpolate(frame, [30, 240], [0, -100], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // Online pulse
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.2);

  // Overlay text
  const textSpring = spring({frame: Math.max(0, frame - 50), fps, config: {damping: 12, stiffness: 100}});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', overflow: 'hidden'}}>
      <div style={{
        transform: `translateX(${x}px) scale(${zoomScale}) translate(${zoomX}px, ${zoomY}px)`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
      }}>
        <Img src={staticFile('pitch-assets/agents.png')} style={{width: 1400, borderRadius: 16, boxShadow: '0 0 60px rgba(59,130,246,0.15)'}} />
      </div>

      {/* ONLINE status */}
      <div style={{
        position: 'absolute',
        top: 50,
        right: 80,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        opacity: interpolate(frame, [30, 45], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      }}>
        <div style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          backgroundColor: `rgba(34,197,94,${0.6 + pulse * 0.4})`,
          boxShadow: `0 0 ${8 + pulse * 12}px rgba(34,197,94,0.6)`,
        }} />
        <span style={{fontFamily: 'Inter, sans-serif', fontSize: 28, fontWeight: 700, color: '#22c55e', letterSpacing: 3}}>ONLINE</span>
      </div>

      {/* Overlay text */}
      <div style={{
        position: 'absolute',
        bottom: 100,
        width: '100%',
        textAlign: 'center',
        fontFamily: 'Inter, sans-serif',
        fontSize: 44,
        fontWeight: 700,
        color: '#fafafa',
        opacity: textSpring,
        transform: `translateY(${interpolate(textSpring, [0, 1], [40, 0])}px)`,
      }}>
        Real agents. Real services. Real reputation.
      </div>
    </AbsoluteFill>
  );
};

import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img} from 'remotion';

export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const logoScale = spring({frame, fps, config: {damping: 12, stiffness: 100}});
  const logoOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const nameOpacity = interpolate(frame, [20, 35], [0, 1], {extrapolateRight: 'clamp'});
  const urlOpacity = interpolate(frame, [45, 60], [0, 1], {extrapolateRight: 'clamp'});
  const builtOpacity = interpolate(frame, [80, 95], [0, 1], {extrapolateRight: 'clamp'});
  const aiOpacity = interpolate(frame, [110, 125], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, sans-serif'}}>
      <div style={{textAlign: 'center'}}>
        <Img src={staticFile('logo.png')} style={{width: 180, opacity: logoOpacity, transform: `scale(${logoScale})`, marginBottom: 24}} />
        <h1 style={{color: '#fafafa', fontSize: 72, fontWeight: 800, opacity: nameOpacity, margin: '0 0 16px'}}>AgentBazaar</h1>
        <p style={{color: '#3b82f6', fontSize: 32, fontWeight: 500, opacity: urlOpacity, margin: '0 0 50px'}}>agentbazaar.org</p>
        <p style={{color: '#a1a1aa', fontSize: 28, fontWeight: 400, opacity: builtOpacity, margin: '0 0 12px'}}>Built by Meta + Ziggy ⚡</p>
        <p style={{color: '#71717a', fontSize: 24, fontWeight: 400, opacity: aiOpacity, margin: 0}}>100% AI-built in &lt;48 hours</p>
      </div>
    </AbsoluteFill>
  );
};

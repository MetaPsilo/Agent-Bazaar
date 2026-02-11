import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, staticFile, Img} from 'remotion';

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const line1Opacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const line2Opacity = interpolate(frame, [50, 65], [0, 1], {extrapolateRight: 'clamp'});
  const logoOpacity = interpolate(frame, [90, 110], [0, 1], {extrapolateRight: 'clamp'});
  const logoScale = interpolate(frame, [90, 110], [0.9, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, sans-serif'}}>
      <div style={{textAlign: 'center', maxWidth: 1200, padding: 40}}>
        <p style={{color: '#fafafa', fontSize: 48, fontWeight: 300, opacity: line1Opacity, margin: '0 0 30px'}}>
          What if AI agents could buy and sell services from each other?
        </p>
        <p style={{color: '#3b82f6', fontSize: 36, fontWeight: 500, opacity: line2Opacity, margin: '0 0 50px'}}>
          Autonomously. On-chain. Without intermediaries.
        </p>
        <Img src={staticFile('logo.png')} style={{width: 120, opacity: logoOpacity, transform: `scale(${logoScale})`}} />
      </div>
    </AbsoluteFill>
  );
};

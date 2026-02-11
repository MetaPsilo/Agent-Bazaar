import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';

const steps = [
  'Register your agent with a callback URL',
  'Define services and set USDC prices',
  'Receive paid requests via secure webhook',
  'Build reputation through on-chain ratings',
];

export const Providers: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, sans-serif'}}>
      <div style={{maxWidth: 1100}}>
        <h2 style={{color: '#3b82f6', fontSize: 52, fontWeight: 700, opacity: titleOpacity, textAlign: 'center', margin: '0 0 60px'}}>
          For Agents Selling Services
        </h2>
        {steps.map((step, i) => {
          const start = 60 + i * 70;
          const opacity = interpolate(frame, [start, start + 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const x = interpolate(frame, [start, start + 20], [-30, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <div key={i} style={{display: 'flex', alignItems: 'center', opacity, transform: `translateX(${x}px)`, margin: '28px 0'}}>
              <span style={{color: '#3b82f6', fontSize: 48, fontWeight: 700, marginRight: 24, minWidth: 60}}>{i + 1}</span>
              <span style={{color: '#fafafa', fontSize: 36, fontWeight: 400}}>{step}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

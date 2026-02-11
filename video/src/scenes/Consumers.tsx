import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';

const steps = [
  'Discover agents via REST API',
  'Call a service endpoint',
  'Receive 402 → sign USDC payment',
  'Get fulfilled response instantly',
];

export const Consumers: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const bottomOpacity = interpolate(frame, [350, 370], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, sans-serif'}}>
      <div style={{maxWidth: 1100, textAlign: 'center'}}>
        <h2 style={{color: '#3b82f6', fontSize: 52, fontWeight: 700, opacity: titleOpacity, margin: '0 0 60px'}}>
          For Agents Buying Services
        </h2>
        <div style={{textAlign: 'left', display: 'inline-block'}}>
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
        <p style={{color: '#a1a1aa', fontSize: 28, fontWeight: 500, opacity: bottomOpacity, marginTop: 50}}>
          Fully autonomous. No humans in the loop.
        </p>
      </div>
    </AbsoluteFill>
  );
};

import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';

const lines = [
  'AI agents are everywhere.',
  "But they can't transact with each other.",
  'No discovery. No payments. No reputation.',
  'Every platform is a walled garden.',
];

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, sans-serif'}}>
      <div style={{textAlign: 'center', maxWidth: 1100}}>
        {lines.map((line, i) => {
          const start = i * 60;
          const opacity = interpolate(frame, [start, start + 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const y = interpolate(frame, [start, start + 20], [20, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <p key={i} style={{color: i === 3 ? '#3b82f6' : '#fafafa', fontSize: 44, fontWeight: i === 3 ? 600 : 400, opacity, transform: `translateY(${y}px)`, margin: '20px 0'}}>
              {line}
            </p>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

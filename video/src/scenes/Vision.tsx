import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';

const lines = [
  {text: 'The protocol layer for the agent economy', color: '#3b82f6', size: 48, weight: 700},
  {text: 'Billions of AI agents operating autonomously', color: '#fafafa', size: 40, weight: 400},
  {text: 'Negotiating, transacting, building value', color: '#fafafa', size: 40, weight: 400},
  {text: "The question isn't whether agents will transact", color: '#a1a1aa', size: 36, weight: 400},
  {text: "It's who builds the rails.", color: '#fafafa', size: 52, weight: 700},
];

export const Vision: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, sans-serif'}}>
      <div style={{textAlign: 'center', maxWidth: 1100}}>
        {lines.map((line, i) => {
          const start = i * 70;
          const opacity = interpolate(frame, [start, start + 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const y = interpolate(frame, [start, start + 20], [20, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <p key={i} style={{color: line.color, fontSize: line.size, fontWeight: line.weight, opacity, transform: `translateY(${y}px)`, margin: '22px 0'}}>
              {line.text}
            </p>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

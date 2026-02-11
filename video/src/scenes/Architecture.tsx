import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';

const boxes = [
  {title: 'Solana Program', subtitle: 'On-chain registry & reputation'},
  {title: 'REST API', subtitle: 'Discovery & indexing'},
  {title: 'x402 Payments', subtitle: 'USDC micropayments'},
  {title: 'Agent Callbacks', subtitle: 'Secure fulfillment'},
];

export const Architecture: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, sans-serif'}}>
      <h2 style={{color: '#fafafa', fontSize: 52, fontWeight: 700, opacity: titleOpacity, position: 'absolute', top: 120, left: 0, right: 0, textAlign: 'center'}}>
        Architecture
      </h2>
      <div style={{display: 'flex', alignItems: 'center', gap: 0}}>
        {boxes.map((box, i) => {
          const start = 40 + i * 60;
          const opacity = interpolate(frame, [start, start + 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const scale = interpolate(frame, [start, start + 20], [0.9, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const arrowOpacity = i < 3 ? interpolate(frame, [start + 20, start + 35], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
          return (
            <React.Fragment key={i}>
              <div style={{opacity, transform: `scale(${scale})`, textAlign: 'center', background: '#18181b', border: '1px solid #27272a', borderRadius: 16, padding: '36px 32px', minWidth: 240}}>
                <p style={{color: '#3b82f6', fontSize: 28, fontWeight: 600, margin: '0 0 10px'}}>{box.title}</p>
                <p style={{color: '#71717a', fontSize: 18, fontWeight: 400, margin: 0}}>{box.subtitle}</p>
              </div>
              {i < 3 && (
                <span style={{color: '#3b82f6', fontSize: 40, opacity: arrowOpacity, margin: '0 16px'}}>→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

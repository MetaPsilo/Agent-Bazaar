import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';

const items = [
  '✅ Live on Solana mainnet',
  '✅ Production at agentbazaar.org',
  '✅ 9 on-chain instructions',
  '✅ 78+ security findings resolved',
  '✅ Full x402 payment flow',
  '✅ Open protocol',
];

export const Traction: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, sans-serif'}}>
      <div style={{maxWidth: 900}}>
        <h2 style={{color: '#fafafa', fontSize: 52, fontWeight: 700, opacity: titleOpacity, textAlign: 'center', margin: '0 0 50px'}}>
          Traction
        </h2>
        {items.map((item, i) => {
          const start = 30 + i * 35;
          const opacity = interpolate(frame, [start, start + 15], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const x = interpolate(frame, [start, start + 15], [-20, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <p key={i} style={{color: '#fafafa', fontSize: 36, fontWeight: 500, opacity, transform: `translateX(${x}px)`, margin: '20px 0'}}>
              {item}
            </p>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

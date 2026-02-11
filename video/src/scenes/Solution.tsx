import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, staticFile, Img} from 'remotion';

const items = [
  '⛓️ On-chain registry on Solana',
  '⭐ Verifiable reputation',
  '💰 x402 USDC micropayments',
  '🔓 Permissionless — no gatekeepers',
];

export const Solution: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const logoOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const subtitleOpacity = interpolate(frame, [30, 45], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, sans-serif'}}>
      <div style={{textAlign: 'center', maxWidth: 1100}}>
        <Img src={staticFile('logo.png')} style={{width: 80, opacity: logoOpacity, marginBottom: 20}} />
        <h1 style={{color: '#fafafa', fontSize: 64, fontWeight: 700, opacity: titleOpacity, margin: '0 0 10px'}}>AgentBazaar</h1>
        <p style={{color: '#a1a1aa', fontSize: 32, fontWeight: 400, opacity: subtitleOpacity, margin: '0 0 50px'}}>
          The permissionless protocol for AI agent commerce
        </p>
        {items.map((item, i) => {
          const start = 80 + i * 35;
          const opacity = interpolate(frame, [start, start + 15], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const y = interpolate(frame, [start, start + 15], [15, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <p key={i} style={{color: '#fafafa', fontSize: 36, fontWeight: 500, opacity, transform: `translateY(${y}px)`, margin: '18px 0'}}>
              {item}
            </p>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

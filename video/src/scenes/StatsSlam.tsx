import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';

const stats: Array<{text: string; color: string; from: number; fontSize: number}> = [
  {text: 'SOLANA MAINNET', color: '#fafafa', from: 0, fontSize: 110},
  {text: 'x402 PAYMENTS', color: '#3b82f6', from: 50, fontSize: 110},
  {text: 'ON-CHAIN REPUTATION', color: '#fafafa', from: 100, fontSize: 90},
  {text: 'OPEN PROTOCOL', color: '#3b82f6', from: 150, fontSize: 100},
  {text: '78+ SECURITY AUDITS', color: '#fafafa', from: 200, fontSize: 80},
  {text: '2.5% FEE', color: '#3b82f6', from: 250, fontSize: 120},
];

export const StatsSlam: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center'}}>
      {stats.map((stat, i) => {
        const visible = frame >= stat.from && frame < stat.from + 50;
        if (!visible) return null;

        const localFrame = frame - stat.from;
        const s = spring({frame: localFrame, fps, config: {damping: 8, stiffness: 200}});
        const dir = i % 2 === 0 ? -1 : 1;
        const x = interpolate(s, [0, 1], [dir * 1200, 0]);

        // Screen shake on entry
        const shake = localFrame < 12 ? Math.sin(localFrame * 2.5) * interpolate(localFrame, [0, 12], [8, 0], {extrapolateRight: 'clamp'}) : 0;

        const fadeOut = interpolate(localFrame, [35, 50], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

        return (
          <div key={stat.text} style={{
            position: 'absolute',
            fontFamily: 'Inter, sans-serif',
            fontSize: stat.fontSize,
            fontWeight: 900,
            color: stat.color,
            transform: `translateX(${x + shake}px)`,
            opacity: fadeOut,
            letterSpacing: 4,
            textAlign: 'center',
            textShadow: stat.color === '#3b82f6' ? '0 0 40px rgba(59,130,246,0.4)' : '0 0 30px rgba(250,250,250,0.15)',
          }}>
            {stat.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

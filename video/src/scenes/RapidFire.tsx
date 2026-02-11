import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';

export const RapidFire: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const words: Array<{text: string; color: string; from: number; dur: number; anim: 'left' | 'right' | 'scale'}> = [
    {text: 'DISCOVER.', color: '#fafafa', from: 0, dur: 15, anim: 'left'},
    {text: 'TRANSACT.', color: '#fafafa', from: 15, dur: 15, anim: 'right'},
    {text: 'EARN.', color: '#3b82f6', from: 30, dur: 15, anim: 'scale'},
  ];

  const taglineStart = 55;
  const taglineOpacity = interpolate(frame, [taglineStart, taglineStart + 15], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const subStart = 80;
  const subOpacity = interpolate(frame, [subStart, subStart + 15], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center'}}>
      {words.map((w) => {
        if (frame < w.from || frame >= w.from + w.dur + 10) return null;
        const s = spring({frame: frame - w.from, fps, config: {damping: 10, stiffness: 200}});
        const opacity = interpolate(frame, [w.from + w.dur, w.from + w.dur + 10], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        let transform = '';
        if (w.anim === 'left') transform = `translateX(${interpolate(s, [0, 1], [-800, 0])}px)`;
        if (w.anim === 'right') transform = `translateX(${interpolate(s, [0, 1], [800, 0])}px)`;
        if (w.anim === 'scale') transform = `scale(${s * 1.2})`;

        return (
          <div key={w.text} style={{
            position: 'absolute',
            fontFamily: 'Inter, sans-serif',
            fontSize: 120,
            fontWeight: 900,
            color: w.color,
            transform,
            opacity,
            filter: `blur(${interpolate(s, [0, 0.5], [10, 0], {extrapolateRight: 'clamp'})}px)`,
          }}>
            {w.text}
          </div>
        );
      })}

{/* Taglines removed — too quick, goes straight to product */}
    </AbsoluteFill>
  );
};

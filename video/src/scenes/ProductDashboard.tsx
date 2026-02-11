import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';

export const ProductDashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const zoomIn = spring({frame, fps, config: {damping: 15, stiffness: 80}});
  const scale = interpolate(zoomIn, [0, 1], [0.3, 1]);
  const rotation = interpolate(zoomIn, [0, 1], [-5, 0]);
  const blur = interpolate(frame, [0, 20], [15, 0], {extrapolateRight: 'clamp'});

  // Camera pan after initial zoom
  const panScale = interpolate(frame, [60, 300], [1, 1.4], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const panX = interpolate(frame, [60, 300], [0, -150], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const panY = interpolate(frame, [60, 300], [0, -80], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // NETWORK LIVE overlay
  const liveOpacity = interpolate(frame, [30, 45], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const greenPulse = 0.5 + 0.5 * Math.sin(frame * 0.15);

  // Stats flying in
  const stats = [
    {text: '1 Agent', from: 80, dir: -1},
    {text: '$0.02 Volume', from: 100, dir: 1},
    {text: '2 Transactions', from: 120, dir: -1},
  ];

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', overflow: 'hidden'}}>
      <div style={{
        transform: `scale(${scale * panScale}) rotate(${rotation}deg) translate(${panX}px, ${panY}px)`,
        filter: `blur(${blur}px)`,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 0 80px rgba(59,130,246,0.2)',
      }}>
        <OffthreadVideo src={staticFile('clips/dashboard.mp4')} style={{width: 1400}} />
      </div>

      {/* NETWORK LIVE */}
      <div style={{
        position: 'absolute',
        top: 60,
        left: 80,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity: liveOpacity,
      }}>
        <div style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: `rgba(34, 197, 94, ${0.6 + greenPulse * 0.4})`,
          boxShadow: `0 0 ${10 + greenPulse * 15}px rgba(34, 197, 94, 0.6)`,
        }} />
        <span style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 36,
          fontWeight: 800,
          color: '#fafafa',
          letterSpacing: 4,
        }}>NETWORK LIVE</span>
      </div>

      {/* Stats */}
      {stats.map((stat) => {
        const s = spring({frame: Math.max(0, frame - stat.from), fps, config: {damping: 10, stiffness: 150}});
        return (
          <div key={stat.text} style={{
            position: 'absolute',
            bottom: 80 + stats.indexOf(stat) * 70,
            fontFamily: 'Inter, sans-serif',
            fontSize: 40,
            fontWeight: 700,
            color: '#3b82f6',
            transform: `translateX(${interpolate(s, [0, 1], [stat.dir * 600, 0])}px)`,
            opacity: s,
          }}>
            {stat.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

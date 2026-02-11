import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, staticFile, Img} from 'remotion';

const screenshots = [
  {file: 'pitch-assets/dashboard.png', label: 'Real-time protocol dashboard'},
  {file: 'pitch-assets/agents.png', label: 'Discover registered agents'},
  {file: 'pitch-assets/services.png', label: 'Browse and purchase services'},
  {file: 'pitch-assets/docs.png', label: 'Complete developer documentation'},
  {file: 'pitch-assets/register.png', label: '4-step wallet-verified onboarding'},
];

const EACH = 195; // ~6.5s per screenshot

export const Showcase: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const urlOpacity = interpolate(frame, [15, 30], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, sans-serif'}}>
      <h2 style={{color: '#fafafa', fontSize: 48, fontWeight: 700, opacity: titleOpacity, position: 'absolute', top: 60, left: 0, right: 0, textAlign: 'center'}}>
        Live Product
      </h2>
      <p style={{color: '#3b82f6', fontSize: 28, opacity: urlOpacity, position: 'absolute', top: 125, left: 0, right: 0, textAlign: 'center'}}>
        agentbazaar.org
      </p>
      {screenshots.map((shot, i) => {
        const start = 60 + i * EACH;
        const end = start + EACH;
        const fadeIn = interpolate(frame, [start, start + 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const fadeOut = interpolate(frame, [end - 15, end], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const opacity = Math.min(fadeIn, fadeOut);
        const scale = interpolate(frame, [start, start + 20], [0.95, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        if (frame < start - 5 || frame > end + 5) return null;
        return (
          <div key={i} style={{position: 'absolute', top: 170, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity}}>
            <Img src={staticFile(shot.file)} style={{maxWidth: 1400, maxHeight: 700, borderRadius: 12, transform: `scale(${scale})`, boxShadow: '0 20px 60px rgba(0,0,0,0.5)'}} />
            <p style={{color: '#a1a1aa', fontSize: 28, marginTop: 24, fontWeight: 500}}>{shot.label}</p>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

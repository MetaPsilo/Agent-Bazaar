import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';

export const LogoSlam: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const logoScale = spring({frame, fps, config: {damping: 8, stiffness: 200}});
  const logoBlur = interpolate(frame, [0, 15], [20, 0], {extrapolateRight: 'clamp'});
  const glowOpacity = interpolate(frame, [5, 30], [0, 0.8], {extrapolateRight: 'clamp'});

  // Typewriter for AGENTBAZAAR
  const text = 'AGENT BAZAAR';
  const typeStart = 20;
  const charsVisible = Math.floor(interpolate(frame, [typeStart, typeStart + 25], [0, text.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const displayText = text.substring(0, charsVisible);

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        {/* Blue glow behind logo */}
        <div style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)',
          opacity: glowOpacity,
          top: -50,
          filter: 'blur(40px)',
        }} />
        <Img
          src={staticFile('logo.png')}
          style={{
            width: 200,
            height: 200,
            transform: `scale(${logoScale * 3 - 2 * Math.min(logoScale, 1)})`,
            filter: `blur(${logoBlur}px)`,
          }}
        />
        <div style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 72,
          fontWeight: 900,
          color: '#fafafa',
          letterSpacing: 12,
          marginTop: 20,
          textShadow: '0 0 40px rgba(59,130,246,0.5)',
        }}>
          {displayText}
          {charsVisible < text.length && <span style={{opacity: frame % 6 < 3 ? 1 : 0}}>|</span>}
        </div>
      </div>
    </AbsoluteFill>
  );
};

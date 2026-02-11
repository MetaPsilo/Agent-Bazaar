import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';

export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Fade from previous
  const fadeIn = interpolate(frame, [0, 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // Logo
  const logoSpring = spring({frame: Math.max(0, frame - 20), fps, config: {damping: 12, stiffness: 80}});
  const glowPulse = 0.5 + 0.5 * Math.sin(frame * 0.08);

  // Typewriter URL
  const url = 'agentbazaar.org';
  const typeStart = 60;
  const charsVisible = Math.floor(interpolate(frame, [typeStart, typeStart + 40], [0, url.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const displayUrl = url.substring(0, charsVisible);

  // Tagline
  const tagSpring = spring({frame: Math.max(0, frame - 110), fps, config: {damping: 12, stiffness: 100}});

  // Built by
  const builtOpacity = interpolate(frame, [150, 170], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // Fade to black over last 2s (frames 180-240 of this scene)
  const fadeToBlack = interpolate(frame, [180, 240], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', opacity: fadeIn}}>
      {/* Blue glow */}
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
        opacity: logoSpring * (0.6 + glowPulse * 0.4),
        filter: 'blur(50px)',
      }} />

      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20}}>
        <Img
          src={staticFile('logo.png')}
          style={{
            width: 180,
            height: 180,
            opacity: logoSpring,
            transform: `scale(${logoSpring})`,
          }}
        />

        <div style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 36,
          fontWeight: 600,
          color: '#a1a1aa',
          letterSpacing: 2,
          marginTop: 10,
        }}>
          {displayUrl}
          {charsVisible < url.length && frame >= typeStart && <span style={{opacity: frame % 6 < 3 ? 1 : 0, color: '#3b82f6'}}>|</span>}
        </div>

        <div style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 48,
          fontWeight: 800,
          color: '#fafafa',
          opacity: tagSpring,
          transform: `translateY(${interpolate(tagSpring, [0, 1], [30, 0])}px)`,
          marginTop: 20,
        }}>
          The agent economy starts here.
        </div>

        <div style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 22,
          fontWeight: 400,
          color: '#71717a',
          opacity: builtOpacity,
          marginTop: 30,
        }}>
          Built by Meta + Ziggy ⚡ · 100% AI-built in &lt;48 hours
        </div>
      </div>

      {/* Fade to black overlay */}
      <AbsoluteFill style={{backgroundColor: '#09090b', opacity: fadeToBlack}} />
    </AbsoluteFill>
  );
};

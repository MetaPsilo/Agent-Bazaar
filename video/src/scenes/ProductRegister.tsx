import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';

export const ProductRegister: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const zoomIn = spring({frame, fps, config: {damping: 12, stiffness: 100}});
  const scale = interpolate(zoomIn, [0, 1], [0.5, 1]);
  const blur = interpolate(frame, [0, 15], [15, 0], {extrapolateRight: 'clamp'});

  // Wallet button pulse
  const walletPulse = 0.5 + 0.5 * Math.sin(frame * 0.15);

  // Step indicators
  const steps = [1, 2, 3, 4];
  const stepCompleteFrame = [20, 45, 70, -1]; // -1 = not complete, 3 is active

  const overlaySpring = spring({frame: Math.max(0, frame - 80), fps, config: {damping: 12, stiffness: 100}});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', overflow: 'hidden', justifyContent: 'center', alignItems: 'center'}}>
      <div style={{
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
        position: 'relative',
      }}>
        <OffthreadVideo src={staticFile('clips/register.mp4')} style={{width: 1400, borderRadius: 16, boxShadow: '0 0 60px rgba(59,130,246,0.15)'}} />
{/* Wallet pulse overlay removed */}
      </div>

{/* Step indicators removed — visible in the actual recording */}

      <div style={{
        position: 'absolute',
        bottom: 100,
        width: '100%',
        textAlign: 'center',
        fontFamily: 'Inter, sans-serif',
        fontSize: 52,
        fontWeight: 800,
        color: '#fafafa',
        opacity: overlaySpring,
        transform: `scale(${overlaySpring})`,
      }}>
        Deploy in 4 steps.
      </div>
    </AbsoluteFill>
  );
};

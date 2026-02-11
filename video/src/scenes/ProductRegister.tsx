import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';

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
        <Img src={staticFile('pitch-assets/register.png')} style={{width: 1400, borderRadius: 16, boxShadow: '0 0 60px rgba(59,130,246,0.15)'}} />
        {/* Wallet pulse overlay */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 200,
          height: 60,
          transform: 'translate(-50%, -50%)',
          borderRadius: 12,
          border: `2px solid rgba(59,130,246,${0.4 + walletPulse * 0.6})`,
          boxShadow: `0 0 ${15 + walletPulse * 25}px rgba(59,130,246,${0.3 + walletPulse * 0.3})`,
        }} />
      </div>

      {/* Step indicators */}
      <div style={{
        position: 'absolute',
        top: 50,
        display: 'flex',
        gap: 30,
        alignItems: 'center',
      }}>
        {steps.map((step, i) => {
          const complete = stepCompleteFrame[i] >= 0 && frame > stepCompleteFrame[i];
          const active = i === 2 && frame > 70;
          const s = stepCompleteFrame[i] >= 0 ? spring({frame: Math.max(0, frame - stepCompleteFrame[i]), fps, config: {damping: 10, stiffness: 200}}) : 0;
          return (
            <div key={step} style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              backgroundColor: complete ? '#22c55e' : active ? '#3b82f6' : '#27272a',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontFamily: 'Inter, sans-serif',
              fontSize: 22,
              fontWeight: 700,
              color: '#fafafa',
              transform: `scale(${complete ? 0.8 + s * 0.2 : active ? 1.1 : 1})`,
              boxShadow: active ? '0 0 20px rgba(59,130,246,0.5)' : 'none',
            }}>
              {complete ? '✓' : step}
            </div>
          );
        })}
      </div>

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

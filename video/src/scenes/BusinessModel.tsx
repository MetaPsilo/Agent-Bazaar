import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';

export const BusinessModel: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const feeOpacity = interpolate(frame, [30, 50], [0, 1], {extrapolateRight: 'clamp'});
  const diagramOpacity = interpolate(frame, [70, 90], [0, 1], {extrapolateRight: 'clamp'});
  const bottomOpacity = interpolate(frame, [140, 160], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, sans-serif'}}>
      <div style={{textAlign: 'center', maxWidth: 1200}}>
        <h2 style={{color: '#fafafa', fontSize: 52, fontWeight: 700, opacity: titleOpacity, margin: '0 0 40px'}}>Business Model</h2>
        <p style={{color: '#3b82f6', fontSize: 40, fontWeight: 600, opacity: feeOpacity, margin: '0 0 60px'}}>
          2.5% protocol fee on every transaction
        </p>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, opacity: diagramOpacity, margin: '0 0 20px'}}>
          <div style={{background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '24px 36px'}}>
            <p style={{color: '#fafafa', fontSize: 28, fontWeight: 600, margin: 0}}>Agent A</p>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <span style={{color: '#fafafa', fontSize: 24}}>$100 USDC</span>
            <span style={{color: '#3b82f6', fontSize: 36}}>→</span>
          </div>
          <div style={{background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '24px 36px'}}>
            <p style={{color: '#fafafa', fontSize: 28, fontWeight: 600, margin: 0}}>Agent B</p>
          </div>
        </div>
        <div style={{opacity: diagramOpacity}}>
          <span style={{color: '#3b82f6', fontSize: 28}}>↓ $2.50</span>
          <div style={{background: '#1e3a5f', border: '1px solid #3b82f6', borderRadius: 12, padding: '16px 32px', display: 'inline-block', marginTop: 12}}>
            <p style={{color: '#3b82f6', fontSize: 24, fontWeight: 600, margin: 0}}>Protocol Treasury</p>
          </div>
        </div>
        <p style={{color: '#a1a1aa', fontSize: 28, fontWeight: 400, opacity: bottomOpacity, marginTop: 40}}>
          Pure protocol revenue. Scales with network activity.
        </p>
      </div>
    </AbsoluteFill>
  );
};

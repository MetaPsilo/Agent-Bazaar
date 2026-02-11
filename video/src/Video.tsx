import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {LogoSlam} from './scenes/LogoSlam';
import {RapidFire} from './scenes/RapidFire';
import {ProductDashboard} from './scenes/ProductDashboard';
import {ProductAgents} from './scenes/ProductAgents';
import {ProductServices} from './scenes/ProductServices';
import {ProductRegister} from './scenes/ProductRegister';
import {StatsSlam} from './scenes/StatsSlam';
import {Close} from './scenes/Close';

const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');`;

export const Video: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#09090b'}}>
      <style>{fontImport}</style>
      {/* 0-2s: Logo slam */}
      <Sequence from={0} durationInFrames={60}><LogoSlam /></Sequence>
      {/* 2-4s: Rapid fire */}
      <Sequence from={60} durationInFrames={60}><RapidFire /></Sequence>
      {/* 4-9s: Dashboard */}
      <Sequence from={120} durationInFrames={150}><ProductDashboard /></Sequence>
      {/* 9-13s: Agents */}
      <Sequence from={270} durationInFrames={120}><ProductAgents /></Sequence>
      {/* 13-17s: Services */}
      <Sequence from={390} durationInFrames={120}><ProductServices /></Sequence>
      {/* 17-21s: Register */}
      <Sequence from={510} durationInFrames={120}><ProductRegister /></Sequence>
      {/* 21-27s: Stats slam */}
      <Sequence from={630} durationInFrames={180}><StatsSlam /></Sequence>
      {/* 27-30s: Close */}
      <Sequence from={810} durationInFrames={90}><Close /></Sequence>
    </AbsoluteFill>
  );
};

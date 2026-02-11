import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {LogoSlam} from './scenes/LogoSlam';
import {RapidFire} from './scenes/RapidFire';
import {ProductDashboard} from './scenes/ProductDashboard';
import {ProductAgents} from './scenes/ProductAgents';
import {ProductServices} from './scenes/ProductServices';
import {ProductRegister} from './scenes/ProductRegister';
import {ProductDocs} from './scenes/ProductDocs';
import {StatsSlam} from './scenes/StatsSlam';
import {Close} from './scenes/Close';

const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');`;

export const Video: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#09090b'}}>
      <style>{fontImport}</style>
      {/* 0-3s: Logo slam */}
      <Sequence from={0} durationInFrames={90}><LogoSlam /></Sequence>
      {/* 3-7s: Rapid fire text */}
      <Sequence from={90} durationInFrames={120}><RapidFire /></Sequence>
      {/* 7-15s: Dashboard scroll */}
      <Sequence from={210} durationInFrames={240}><ProductDashboard /></Sequence>
      {/* 15-20s: Agent Explorer */}
      <Sequence from={450} durationInFrames={150}><ProductAgents /></Sequence>
      {/* 20-25s: Services */}
      <Sequence from={600} durationInFrames={150}><ProductServices /></Sequence>
      {/* 25-30s: Registration flow */}
      <Sequence from={750} durationInFrames={150}><ProductRegister /></Sequence>
      {/* 30-36s: Docs scroll */}
      <Sequence from={900} durationInFrames={180}><ProductDocs /></Sequence>
      {/* 36-50s: Stats slam */}
      <Sequence from={1080} durationInFrames={420}><StatsSlam /></Sequence>
      {/* 50-60s: Close */}
      <Sequence from={1500} durationInFrames={300}><Close /></Sequence>
    </AbsoluteFill>
  );
};

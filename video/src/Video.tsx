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
      <Sequence from={0} durationInFrames={90}><LogoSlam /></Sequence>
      <Sequence from={90} durationInFrames={150}><RapidFire /></Sequence>
      <Sequence from={240} durationInFrames={300}><ProductDashboard /></Sequence>
      <Sequence from={540} durationInFrames={240}><ProductAgents /></Sequence>
      <Sequence from={780} durationInFrames={240}><ProductServices /></Sequence>
      <Sequence from={1020} durationInFrames={180}><ProductRegister /></Sequence>
      <Sequence from={1200} durationInFrames={300}><StatsSlam /></Sequence>
      <Sequence from={1500} durationInFrames={300}><Close /></Sequence>
    </AbsoluteFill>
  );
};

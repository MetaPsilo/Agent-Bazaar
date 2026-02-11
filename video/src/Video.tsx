import React from 'react';
import {AbsoluteFill, Audio, Sequence} from 'remotion';
import {staticFile} from 'remotion';
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
      <Audio
        src={staticFile('music.mp3')}
        volume={(f) => {
          // Fade in over first 10 frames
          if (f < 10) return f / 10;
          // Fade out over last 30 frames
          if (f > 720) return (750 - f) / 30;
          return 1;
        }}
      />
      {/* 0-2s: Logo slam */}
      <Sequence from={0} durationInFrames={60}><LogoSlam /></Sequence>
      {/* 2-4s: Rapid fire */}
      <Sequence from={60} durationInFrames={60}><RapidFire /></Sequence>
      {/* 4-7s: Agents */}
      <Sequence from={120} durationInFrames={90}><ProductAgents /></Sequence>
      {/* 7-10.5s: Services */}
      <Sequence from={210} durationInFrames={105}><ProductServices /></Sequence>
      {/* 10.5-15s: Register */}
      <Sequence from={315} durationInFrames={135}><ProductRegister /></Sequence>
      {/* 15-21s: Stats slam */}
      <Sequence from={450} durationInFrames={180}><StatsSlam /></Sequence>
      {/* 21-25s: Close */}
      <Sequence from={630} durationInFrames={120}><Close /></Sequence>
    </AbsoluteFill>
  );
};

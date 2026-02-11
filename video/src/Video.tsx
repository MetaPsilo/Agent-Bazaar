import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {Hook} from './scenes/Hook';
import {Problem} from './scenes/Problem';
import {Solution} from './scenes/Solution';
import {Providers} from './scenes/Providers';
import {Consumers} from './scenes/Consumers';
import {Showcase} from './scenes/Showcase';
import {Architecture} from './scenes/Architecture';
import {Traction} from './scenes/Traction';
import {BusinessModel} from './scenes/BusinessModel';
import {Vision} from './scenes/Vision';
import {Close} from './scenes/Close';

const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');`;

export const Video: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#09090b'}}>
      <style>{fontImport}</style>
      <Sequence from={0} durationInFrames={150}><Hook /></Sequence>
      <Sequence from={150} durationInFrames={300}><Problem /></Sequence>
      <Sequence from={450} durationInFrames={300}><Solution /></Sequence>
      <Sequence from={750} durationInFrames={450}><Providers /></Sequence>
      <Sequence from={1200} durationInFrames={450}><Consumers /></Sequence>
      <Sequence from={1650} durationInFrames={1050}><Showcase /></Sequence>
      <Sequence from={2700} durationInFrames={450}><Architecture /></Sequence>
      <Sequence from={3150} durationInFrames={300}><Traction /></Sequence>
      <Sequence from={3450} durationInFrames={300}><BusinessModel /></Sequence>
      <Sequence from={3750} durationInFrames={450}><Vision /></Sequence>
      <Sequence from={4200} durationInFrames={300}><Close /></Sequence>
    </AbsoluteFill>
  );
};

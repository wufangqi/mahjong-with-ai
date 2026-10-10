import type { ThemeDefinition } from '../types';

/** 经典绿绒 — default MVP theme (Demo felt look). */
export const classicGreenTheme: ThemeDefinition = {
  id: 'classic-green',
  displayName: '经典绿绒',
  modules: {
    table: { felt: 0x0d5a3c, rail: 0x5a2e18, trim: 0xc9a227 },
    mark: { glyph: '雀', color: 0xc9a227 },
    sky: { kind: 'color', color: 0x14261c },
    fog: { color: 0x14261c, near: 24, far: 55 },
    lights: {
      hemiSky: 0xfff2d8,
      hemiGround: 0x1a3024,
      hemiIntensity: 0.85,
      key: 0xfff1dc,
      keyIntensity: 1.35,
    },
    ambientParticles: { kind: 'dust', color: 0xf5c46a },
    tileBack: 0x0f7a4f,
    palette: {
      bannerBasic: '#ffe2a0',
      bannerBig: '#fff0d0',
      bannerTop: '#ffd56a',
      effectPrimary: '#f5c46a',
      effectSecondary: '#e0353f',
    },
  },
};

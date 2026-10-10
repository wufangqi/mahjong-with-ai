import type { ThemeDefinition } from '../types';

/** 中式宫廷 — on-demand MVP theme (procedural, no external assets). */
export const courtPalaceTheme: ThemeDefinition = {
  id: 'court-palace',
  displayName: '中式宫廷',
  modules: {
    table: { felt: 0x8b1e2d, rail: 0x3a1a12, trim: 0xd4af37 },
    mark: { glyph: '福', color: 0xd4af37 },
    sky: {
      kind: 'gradient',
      stops: [
        { t: 0, color: '#2a1028' },
        { t: 0.35, color: '#7a3d48' },
        { t: 0.62, color: '#d48462' },
        { t: 1, color: '#f0c48a' },
      ],
    },
    fog: { color: 0x4a2030, near: 22, far: 52 },
    lights: {
      hemiSky: 0xffe0c8,
      hemiGround: 0x3a1818,
      hemiIntensity: 0.9,
      key: 0xffd8a8,
      keyIntensity: 1.4,
    },
    ambientParticles: { kind: 'petals', color: 0xff8a9a },
    tileBack: 0x7a1528,
    palette: {
      bannerBasic: '#ffe8c0',
      bannerBig: '#ffd0a0',
      bannerTop: '#ffc060',
      effectPrimary: '#d4af37',
      effectSecondary: '#c0392b',
    },
  },
};

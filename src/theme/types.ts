/** MVP theme identifiers — exactly two. */
export type ThemeId = 'classic-green' | 'court-palace';

export const DEFAULT_THEME_ID: ThemeId = 'classic-green';

export const THEME_STORAGE_KEY = 'mahjong.themeId';

/** Transition must finish inside this window (acceptance: 0.3–0.6 s). */
export const THEME_TRANSITION_MS_MIN = 300;
export const THEME_TRANSITION_MS_MAX = 600;
export const DEFAULT_THEME_TRANSITION_MS = 450;

/**
 * Keys that must never appear on a theme definition — tile faces, layout,
 * and win-scene rhythm are outside the theme boundary (ADR-0003).
 */
export const FORBIDDEN_THEME_KEYS = [
  'tileFace',
  'tileFaces',
  'faceDraw',
  'layout',
  'tableLayout',
  'cameraLayout',
  'timeline',
  'timelineRhythm',
  'bannerText',
  'bannerMain',
  'bannerSub',
  'sceneDuration',
] as const;

export interface ThemePalette {
  bannerBasic: string;
  bannerBig: string;
  bannerTop: string;
  effectPrimary: string;
  effectSecondary: string;
}

export type SkyConfig =
  | { kind: 'color'; color: number }
  | { kind: 'gradient'; stops: readonly { t: number; color: string }[] };

export interface ThemeModules {
  table: { felt: number; rail: number; trim: number };
  mark: { glyph: string; color: number };
  sky: SkyConfig;
  fog: { color: number; near: number; far: number };
  lights: {
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    key: number;
    keyIntensity: number;
  };
  ambientParticles: { kind: 'dust' | 'petals'; color: number };
  tileBack: number;
  palette: ThemePalette;
}

export interface ThemeDefinition {
  id: ThemeId;
  displayName: string;
  modules: ThemeModules;
}

export interface ThemeSelectResult {
  activeId: ThemeId;
  transitionMs: number;
  reusedCached: boolean;
  notices: string[];
}

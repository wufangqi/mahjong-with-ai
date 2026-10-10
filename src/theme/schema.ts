import {
  FORBIDDEN_THEME_KEYS,
  type ThemeDefinition,
  type ThemeId,
  type ThemeModules,
  type ThemePalette,
  type SkyConfig,
} from './types';

const THEME_IDS = new Set<ThemeId>(['classic-green', 'court-palace']);

function isFiniteColor(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

function isPalette(value: unknown): value is ThemePalette {
  if (!value || typeof value !== 'object') return false;
  const p = value as ThemePalette;
  return (
    typeof p.bannerBasic === 'string' &&
    typeof p.bannerBig === 'string' &&
    typeof p.bannerTop === 'string' &&
    typeof p.effectPrimary === 'string' &&
    typeof p.effectSecondary === 'string'
  );
}

function isSky(value: unknown): value is SkyConfig {
  if (!value || typeof value !== 'object') return false;
  const sky = value as SkyConfig;
  if (sky.kind === 'color') return isFiniteColor(sky.color);
  if (sky.kind === 'gradient') {
    return (
      Array.isArray(sky.stops) &&
      sky.stops.length >= 2 &&
      sky.stops.every(
        (s) =>
          typeof s === 'object' &&
          s !== null &&
          typeof s.t === 'number' &&
          Number.isFinite(s.t) &&
          typeof s.color === 'string',
      )
    );
  }
  return false;
}

const MODULE_KEYS: (keyof ThemeModules)[] = [
  'table',
  'mark',
  'sky',
  'fog',
  'lights',
  'ambientParticles',
  'tileBack',
  'palette',
];

export type ModuleValidation = {
  ok: boolean;
  failedModules: (keyof ThemeModules)[];
};

export function validateThemeShape(raw: unknown): raw is ThemeDefinition {
  if (!raw || typeof raw !== 'object') return false;
  const t = raw as ThemeDefinition;
  if (!THEME_IDS.has(t.id as ThemeId)) return false;
  if (typeof t.displayName !== 'string' || t.displayName.length === 0) return false;
  if (!t.modules || typeof t.modules !== 'object') return false;

  const json = JSON.stringify(raw);
  for (const key of FORBIDDEN_THEME_KEYS) {
    if (new RegExp(`"${key}"`, 'i').test(json)) return false;
  }

  for (const key of MODULE_KEYS) {
    if (!(key in t.modules)) return false;
  }
  return true;
}

export function validateModule(key: keyof ThemeModules, value: unknown): boolean {
  switch (key) {
    case 'table': {
      if (!value || typeof value !== 'object') return false;
      const v = value as ThemeModules['table'];
      return isFiniteColor(v.felt) && isFiniteColor(v.rail) && isFiniteColor(v.trim);
    }
    case 'mark': {
      if (!value || typeof value !== 'object') return false;
      const v = value as ThemeModules['mark'];
      return typeof v.glyph === 'string' && v.glyph.length > 0 && isFiniteColor(v.color);
    }
    case 'sky':
      return isSky(value);
    case 'fog': {
      if (!value || typeof value !== 'object') return false;
      const v = value as ThemeModules['fog'];
      return isFiniteColor(v.color) && Number.isFinite(v.near) && Number.isFinite(v.far);
    }
    case 'lights': {
      if (!value || typeof value !== 'object') return false;
      const v = value as ThemeModules['lights'];
      return (
        isFiniteColor(v.hemiSky) &&
        isFiniteColor(v.hemiGround) &&
        Number.isFinite(v.hemiIntensity) &&
        isFiniteColor(v.key) &&
        Number.isFinite(v.keyIntensity)
      );
    }
    case 'ambientParticles': {
      if (!value || typeof value !== 'object') return false;
      const v = value as ThemeModules['ambientParticles'];
      return (v.kind === 'dust' || v.kind === 'petals') && isFiniteColor(v.color);
    }
    case 'tileBack':
      return isFiniteColor(value);
    case 'palette':
      return isPalette(value);
    default:
      return false;
  }
}

/** Per-module validation; empty failedModules means all modules ok. */
export function validateModules(modules: ThemeModules): ModuleValidation {
  const failedModules: (keyof ThemeModules)[] = [];
  for (const key of MODULE_KEYS) {
    if (!validateModule(key, modules[key])) failedModules.push(key);
  }
  return { ok: failedModules.length === 0, failedModules };
}

export function isThemeId(value: string): value is ThemeId {
  return THEME_IDS.has(value as ThemeId);
}

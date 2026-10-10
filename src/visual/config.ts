export type VisualTier = 'basic' | 'big' | 'top';
export type VisualThemeId = 'classic-green' | 'court-palace';

export interface VisualConfig {
  enabled: boolean;
  tier: VisualTier;
  seed: number;
  width: number;
  height: number;
  dpr: number;
  theme: VisualThemeId;
  /** Scene time (ms) at which the harness should pause for capture. */
  captureAt: number;
  /** Fixed simulation step in ms (deterministic clock). */
  stepMs: number;
}

const TIERS: readonly VisualTier[] = ['basic', 'big', 'top'];
const THEMES: readonly VisualThemeId[] = ['classic-green', 'court-palace'];

function num(params: URLSearchParams, key: string, fallback: number): number {
  const raw = params.get(key);
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function parseVisualConfig(search = typeof location !== 'undefined' ? location.search : ''): VisualConfig {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const enabled = params.get('visual') === '1' || params.get('visual') === 'true';
  const tierRaw = params.get('tier') ?? 'basic';
  const themeRaw = params.get('theme') ?? 'classic-green';
  return {
    enabled,
    tier: (TIERS.includes(tierRaw as VisualTier) ? tierRaw : 'basic') as VisualTier,
    seed: num(params, 'seed', 1) >>> 0,
    width: Math.max(320, Math.floor(num(params, 'width', 1280))),
    height: Math.max(240, Math.floor(num(params, 'height', 720))),
    dpr: Math.min(2, Math.max(1, num(params, 'dpr', 1))),
    theme: (THEMES.includes(themeRaw as VisualThemeId) ? themeRaw : 'classic-green') as VisualThemeId,
    captureAt: Math.max(0, num(params, 'captureAt', 1200)),
    stepMs: Math.max(1, num(params, 'stepMs', 1000 / 60)),
  };
}

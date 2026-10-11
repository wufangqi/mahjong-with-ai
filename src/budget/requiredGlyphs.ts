import { LOAD_STAGES } from './loadProgress';

/** UI punctuation that must remain in the shipped Source Han subsets (ADR-0006). */
export const REQUIRED_UI_PUNCTUATION = '–—…、。！，：；？';

/**
 * Characters that must stay in the shipped WOFF2 cmap.
 * Boot labels + UI punctuation used in HUD / menus / placeholders.
 */
export function requiredRuntimeGlyphs(): string {
  return [
    ...LOAD_STAGES.map((s) => s.label),
    '就绪',
    '加载进度',
    REQUIRED_UI_PUNCTUATION,
  ].join('');
}

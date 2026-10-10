import { classicGreenTheme } from './themes/classicGreen';
import type { ThemeDefinition, ThemeId } from './types';

export type ThemeOption = { id: ThemeId; displayName: string };

/**
 * Menu labels only — court-palace module stays out of the default chunk.
 * Display names for non-default themes are listed here so the select can
 * render without eagerly importing those modules.
 */
export function listThemeOptions(): ThemeOption[] {
  return [
    { id: 'classic-green', displayName: classicGreenTheme.displayName },
    { id: 'court-palace', displayName: '中式宫廷' },
  ];
}

/** Default theme is eager; non-default themes load on demand via dynamic import. */
export async function loadTheme(id: ThemeId): Promise<ThemeDefinition> {
  if (id === 'classic-green') return classicGreenTheme;
  if (id === 'court-palace') {
    const mod = await import('./themes/courtPalace');
    return mod.courtPalaceTheme;
  }
  throw new Error(`unknown theme: ${id}`);
}

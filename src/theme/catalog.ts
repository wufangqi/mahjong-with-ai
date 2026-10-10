import { classicGreenTheme } from './themes/classicGreen';
import { courtPalaceTheme } from './themes/courtPalace';
import type { ThemeDefinition, ThemeId } from './types';

const CATALOG: Record<ThemeId, ThemeDefinition> = {
  'classic-green': classicGreenTheme,
  'court-palace': courtPalaceTheme,
};

/** Build-time discovered MVP themes (exactly two). */
export function listThemes(): ThemeDefinition[] {
  return [classicGreenTheme, courtPalaceTheme];
}

export function loadThemeSync(id: ThemeId): ThemeDefinition {
  const theme = CATALOG[id];
  if (!theme) throw new Error(`unknown theme: ${id}`);
  return theme;
}

export { listThemes, loadThemeSync } from './catalog';
export { ThemeManager, type ThemeManagerDeps, type ThemeStorage } from './themeManager';
export { isThemeId, validateModules, validateThemeShape } from './schema';
export {
  DEFAULT_THEME_ID,
  DEFAULT_THEME_TRANSITION_MS,
  FORBIDDEN_THEME_KEYS,
  THEME_STORAGE_KEY,
  THEME_TRANSITION_MS_MAX,
  THEME_TRANSITION_MS_MIN,
  type ThemeDefinition,
  type ThemeId,
  type ThemeModules,
  type ThemePalette,
  type ThemeSelectResult,
} from './types';
export { classicGreenTheme } from './themes/classicGreen';
export { courtPalaceTheme } from './themes/courtPalace';

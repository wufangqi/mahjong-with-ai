import { loadTheme } from '../theme/catalog';
import { ThemeManager } from '../theme/themeManager';
import { classicGreenTheme } from '../theme/themes/classicGreen';
import type { ThemeId, ThemeModules } from '../theme/types';
import { DEFAULT_THEME_ID } from '../theme/types';

/** Ephemeral storage so visual harness does not overwrite play-mode theme preference. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    key: () => null,
  };
}

let modules: ThemeModules = classicGreenTheme.modules;
let activeId: ThemeId = DEFAULT_THEME_ID;
let manager: ThemeManager | null = null;

export function getPreviewThemeId(): ThemeId {
  return activeId;
}

export function getPreviewThemeModules(): ThemeModules {
  return modules;
}

export function getPreviewThemeManager(): ThemeManager | null {
  return manager;
}

/**
 * Load theme through ThemeManager before preview scene side effects so felt/sky/mark/tileBack
 * match the fixed `theme` query param (AC: 可固定主题).
 */
export async function preparePreviewTheme(themeId: ThemeId): Promise<ThemeModules> {
  const themes = new ThemeManager({
    storage: memoryStorage(),
    now: () => performance.now(),
    schedule: (fn, ms) => {
      window.setTimeout(fn, ms);
    },
    loadTheme,
  });
  await themes.start();
  if (themeId !== themes.getActiveId()) {
    await themes.select(themeId);
  }
  manager = themes;
  activeId = themes.getActiveId();
  modules = themes.getApplied();
  return modules;
}

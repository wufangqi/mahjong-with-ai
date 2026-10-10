import { classicGreenTheme } from './themes/classicGreen';
import { isThemeId, validateModule, validateThemeShape } from './schema';
import {
  DEFAULT_THEME_ID,
  DEFAULT_THEME_TRANSITION_MS,
  THEME_STORAGE_KEY,
  THEME_TRANSITION_MS_MAX,
  THEME_TRANSITION_MS_MIN,
  type ThemeDefinition,
  type ThemeId,
  type ThemeModules,
  type ThemePalette,
  type ThemeSelectResult,
} from './types';

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ThemeManagerDeps {
  storage: ThemeStorage;
  now: () => number;
  schedule: (fn: () => void, ms: number) => void;
  loadTheme: (id: ThemeId) => ThemeDefinition | Promise<ThemeDefinition>;
  disposeDelayMs?: number;
  transitionMs?: number;
}

type CacheEntry = {
  definition: ThemeDefinition;
  refs: number;
  disposeAt: number | null;
};

const MODULE_KEYS = Object.keys(classicGreenTheme.modules) as (keyof ThemeModules)[];

function clampTransition(ms: number): number {
  return Math.min(THEME_TRANSITION_MS_MAX, Math.max(THEME_TRANSITION_MS_MIN, ms));
}

function deepCloneModules(modules: ThemeModules): ThemeModules {
  return structuredClone(modules);
}

export class ThemeManager {
  private readonly storage: ThemeStorage;
  private readonly now: () => number;
  private readonly schedule: (fn: () => void, ms: number) => void;
  private readonly loadTheme: ThemeManagerDeps['loadTheme'];
  private readonly disposeDelayMs: number;
  private readonly transitionMs: number;

  private activeId: ThemeId = DEFAULT_THEME_ID;
  private applied: ThemeModules = deepCloneModules(classicGreenTheme.modules);
  private notices: string[] = [];
  private scenePalette: ThemePalette | null = null;
  private cache = new Map<ThemeId, CacheEntry>();
  private mostRecentPriorId: ThemeId | null = null;
  private disposed = new Set<ThemeId>();
  private started = false;

  constructor(deps: ThemeManagerDeps) {
    this.storage = deps.storage;
    this.now = deps.now;
    this.schedule = deps.schedule;
    this.loadTheme = deps.loadTheme;
    this.disposeDelayMs = deps.disposeDelayMs ?? 2000;
    this.transitionMs = clampTransition(deps.transitionMs ?? DEFAULT_THEME_TRANSITION_MS);
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.notices = [];

    await this.acquire(DEFAULT_THEME_ID);
    this.activeId = DEFAULT_THEME_ID;
    this.applied = deepCloneModules(classicGreenTheme.modules);

    const saved = this.storage.getItem(THEME_STORAGE_KEY);
    if (!saved) return;

    if (!isThemeId(saved)) {
      this.notices.push('已保存的主题无效，已回退到经典绿绒');
      this.storage.setItem(THEME_STORAGE_KEY, DEFAULT_THEME_ID);
      return;
    }

    if (saved !== DEFAULT_THEME_ID) {
      await this.select(saved);
    }
  }

  getActiveId(): ThemeId {
    return this.activeId;
  }

  getApplied(): ThemeModules {
    return this.applied;
  }

  getNotices(): string[] {
    return [...this.notices];
  }

  getTransitionMs(): number {
    return this.transitionMs;
  }

  getDisposeDelayMs(): number {
    return this.disposeDelayMs;
  }

  getMostRecentPriorId(): ThemeId | null {
    return this.mostRecentPriorId;
  }

  getRefCount(id: ThemeId): number {
    return this.cache.get(id)?.refs ?? 0;
  }

  isRetained(id: ThemeId): boolean {
    const entry = this.cache.get(id);
    if (!entry) return false;
    if (id === this.activeId || id === this.mostRecentPriorId) return true;
    return entry.refs > 0;
  }

  wasDisposed(id: ThemeId): boolean {
    return this.disposed.has(id) && !this.cache.has(id);
  }

  captureScenePalette(): ThemePalette {
    this.scenePalette = { ...this.applied.palette };
    return { ...this.scenePalette };
  }

  getScenePalette(): ThemePalette | null {
    return this.scenePalette ? { ...this.scenePalette } : null;
  }

  releaseScenePalette(): void {
    this.scenePalette = null;
  }

  async select(id: ThemeId): Promise<ThemeSelectResult> {
    this.notices = [];
    const reusedCached = this.cache.has(id);

    if (id === this.activeId) {
      return {
        activeId: this.activeId,
        transitionMs: this.transitionMs,
        reusedCached: true,
        notices: [],
      };
    }

    const resolved = await this.resolveTheme(id);
    const previous = this.activeId;

    if (previous !== resolved.activeId) {
      this.releaseTowardDispose(previous);
      this.mostRecentPriorId = previous;
      // Pin most-recent prior so quick switch-back stays hot
      this.pin(previous);
    }

    this.activeId = resolved.activeId;
    this.applied = resolved.modules;
    this.storage.setItem(THEME_STORAGE_KEY, this.activeId);
    this.cancelDispose(this.activeId);

    return {
      activeId: this.activeId,
      transitionMs: this.transitionMs,
      reusedCached: reusedCached && resolved.activeId === id,
      notices: [...this.notices],
    };
  }

  /** Advance delayed dispose timers (also invoked via schedule callbacks). */
  flushDisposes(at = this.now()): void {
    for (const [id, entry] of [...this.cache.entries()]) {
      if (entry.disposeAt !== null && entry.disposeAt <= at) {
        if (id === this.activeId || id === this.mostRecentPriorId) {
          entry.disposeAt = null;
          continue;
        }
        this.cache.delete(id);
        this.disposed.add(id);
      }
    }
  }

  private async resolveTheme(id: ThemeId): Promise<{ activeId: ThemeId; modules: ThemeModules }> {
    let definition: ThemeDefinition;
    try {
      definition = await this.loadTheme(id);
    } catch {
      this.notices.push('主题加载失败，已完整回退到经典绿绒');
      await this.acquire(DEFAULT_THEME_ID);
      return { activeId: DEFAULT_THEME_ID, modules: deepCloneModules(classicGreenTheme.modules) };
    }

    if (!validateThemeShape(definition) || definition.id !== id) {
      this.notices.push('主题配置整套无效，已完整回退到经典绿绒');
      await this.acquire(DEFAULT_THEME_ID);
      return { activeId: DEFAULT_THEME_ID, modules: deepCloneModules(classicGreenTheme.modules) };
    }

    await this.acquire(id);
    const modules = deepCloneModules(definition.modules);
    const fallback = classicGreenTheme.modules;

    for (const key of MODULE_KEYS) {
      if (!validateModule(key, modules[key])) {
        modules[key] = structuredClone(fallback[key]) as never;
        const label = key === 'sky' ? '天空' : key;
        this.notices.push(`主题模块「${label}」失败，已局部回退经典绿绒`);
      }
    }

    return { activeId: id, modules };
  }

  private async acquire(id: ThemeId): Promise<void> {
    const existing = this.cache.get(id);
    if (existing) {
      existing.refs += 1;
      existing.disposeAt = null;
      this.disposed.delete(id);
      return;
    }

    const definition = id === DEFAULT_THEME_ID ? classicGreenTheme : await this.loadTheme(id);
    this.cache.set(id, { definition, refs: 1, disposeAt: null });
    this.disposed.delete(id);
  }

  private pin(id: ThemeId): void {
    const entry = this.cache.get(id);
    if (!entry) return;
    if (entry.refs < 1) entry.refs = 1;
    entry.disposeAt = null;
  }

  private releaseTowardDispose(id: ThemeId): void {
    const entry = this.cache.get(id);
    if (!entry) return;
    entry.refs = Math.max(0, entry.refs - 1);
    if (id === this.mostRecentPriorId || id === this.activeId) {
      entry.disposeAt = null;
      return;
    }
    if (entry.refs === 0) {
      const at = this.now() + this.disposeDelayMs;
      entry.disposeAt = at;
      this.schedule(() => this.flushDisposes(), this.disposeDelayMs);
    }
  }

  private cancelDispose(id: ThemeId): void {
    const entry = this.cache.get(id);
    if (entry) entry.disposeAt = null;
  }
}

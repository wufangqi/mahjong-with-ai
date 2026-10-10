import { lowerTier, settingsForTier } from './presets';
import {
  isQualityTier,
  QUALITY_MODE_STORAGE_KEY,
  QUALITY_STORAGE_KEY,
  type GpuProbeInfo,
  type QualityMode,
  type QualitySettings,
  type QualityTier,
} from './types';

export interface QualityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface QualityControllerDeps {
  storage: QualityStorage;
  /** Sustained window before auto-downgrade (ms). Default 5000. */
  sustainedMs?: number;
  /** Fraction of target FPS that triggers downgrade. Default 0.8. */
  fpsFloorRatio?: number;
}

/**
 * Public seam for 画质档: initial probe, auto one-step downgrade, manual lock.
 * Auto never raises within the same game (一场); next game may re-evaluate.
 */
export class QualityController {
  private readonly storage: QualityStorage;
  private readonly sustainedMs: number;
  private readonly fpsFloorRatio: number;

  private mode: QualityMode = 'auto';
  private tier: QualityTier = 'mid';
  private belowAccumMs = 0;
  private gameActive = false;

  constructor(deps: QualityControllerDeps) {
    this.storage = deps.storage;
    this.sustainedMs = deps.sustainedMs ?? 5000;
    this.fpsFloorRatio = deps.fpsFloorRatio ?? 0.8;
  }

  /** Load persisted manual choice, or leave auto for first-run probe. */
  restore(): void {
    const mode = this.storage.getItem(QUALITY_MODE_STORAGE_KEY);
    const saved = this.storage.getItem(QUALITY_STORAGE_KEY);
    if (mode === 'manual' && saved && isQualityTier(saved)) {
      this.mode = 'manual';
      this.tier = saved;
      return;
    }
    this.mode = 'auto';
    if (saved && isQualityTier(saved)) this.tier = saved;
  }

  getMode(): QualityMode {
    return this.mode;
  }

  getTier(): QualityTier {
    return this.tier;
  }

  getSettings(): QualitySettings {
    return settingsForTier(this.tier);
  }

  /**
   * First-run / auto start: choose from GPU probe + short measured FPS.
   * Manual mode ignores probes.
   */
  selectInitial(probe: GpuProbeInfo, measuredFps: number): QualityTier {
    if (this.mode === 'manual') return this.tier;

    let next: QualityTier = 'mid';
    if (!probe.webgl2 || isWeakGpu(probe.renderer)) {
      next = 'low';
    } else if (measuredFps >= 55 && probe.gpuParticlesAvailable && !isIntegratedBudgetGpu(probe.renderer)) {
      next = 'high';
    } else if (measuredFps < 48) {
      next = 'low';
    } else {
      next = 'mid';
    }

    this.tier = next;
    this.persistTier();
    return this.tier;
  }

  /** Player explicit choice — disables automatic changes. */
  setManual(tier: QualityTier): void {
    this.mode = 'manual';
    this.tier = tier;
    this.belowAccumMs = 0;
    this.storage.setItem(QUALITY_MODE_STORAGE_KEY, 'manual');
    this.persistTier();
  }

  /** Re-enable auto (e.g. settings “自动”). Does not raise mid-game. */
  setAuto(): void {
    this.mode = 'auto';
    this.storage.setItem(QUALITY_MODE_STORAGE_KEY, 'auto');
  }

  /**
   * Enter auto mode at a pinned tier without re-probing (test / handoff seam).
   * Still allows auto-downgrade; never used for silent raise mid-game.
   */
  pinAutoTier(tier: QualityTier): void {
    this.mode = 'auto';
    this.tier = tier;
    this.belowAccumMs = 0;
    this.storage.setItem(QUALITY_MODE_STORAGE_KEY, 'auto');
    this.persistTier();
  }

  /** Start a game (一场): clear below-threshold accumulator. Auto never raises mid-game. */
  beginGame(): void {
    this.gameActive = true;
    this.belowAccumMs = 0;
  }

  /** End current game so the next beginGame + selectInitial may pick a higher tier. */
  endGame(): void {
    this.gameActive = false;
    this.belowAccumMs = 0;
  }

  /**
   * Feed a frame sample while a game is active.
   * Auto: after sustainedMs below 80% of target, drop exactly one tier; never auto-raise.
   */
  recordFrame(dtMs: number, fps: number): QualityTier | null {
    if (this.mode !== 'auto' || !this.gameActive) return null;

    const settings = this.getSettings();
    const floor = settings.targetFps * this.fpsFloorRatio;
    if (fps < floor) {
      this.belowAccumMs += Math.max(0, dtMs);
    } else {
      this.belowAccumMs = 0;
      return null;
    }

    if (this.belowAccumMs < this.sustainedMs) return null;

    const next = lowerTier(this.tier);
    this.belowAccumMs = 0;
    if (!next) return null;

    this.tier = next;
    this.persistTier();
    return next;
  }

  private persistTier(): void {
    this.storage.setItem(QUALITY_STORAGE_KEY, this.tier);
  }
}

/** Heuristic: software / basic renderers start at low. */
export function isWeakGpu(renderer: string): boolean {
  const r = renderer.toLowerCase();
  if (!r.trim()) return false;
  return (
    r.includes('swiftshader') ||
    r.includes('llvmpipe') ||
    r.includes('softpipe') ||
    r.includes('microsoft basic render') ||
    r.includes('gdi generic')
  );
}

/** UHD / HD class integrated GPUs prefer mid as the documented baseline. */
export function isIntegratedBudgetGpu(renderer: string): boolean {
  const r = renderer.toLowerCase();
  return (
    r.includes('uhd graphics') ||
    r.includes('intel(r) hd graphics') ||
    r.includes('intel hd graphics') ||
    r.includes('iris(r) graphics') ||
    r.includes('radeon vega') ||
    r.includes('radeon graphics')
  );
}

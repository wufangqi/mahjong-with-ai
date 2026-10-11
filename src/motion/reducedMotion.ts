import {
  isReducedMotionMode,
  REDUCED_MOTION_STORAGE_KEY,
  type MotionStorage,
  type ReducedMotionMode,
} from './types';

export interface ReducedMotionDeps {
  storage: MotionStorage;
  /** System preference probe (defaults to matchMedia when available). */
  systemPrefersReduced?: () => boolean;
}

function defaultSystemPrefersReduced(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Player override over OS preference. Mode `system` follows prefers-reduced-motion.
 */
export class ReducedMotionController {
  private readonly storage: MotionStorage;
  private readonly systemPrefersReduced: () => boolean;
  private mode: ReducedMotionMode = 'system';

  constructor(deps: ReducedMotionDeps) {
    this.storage = deps.storage;
    this.systemPrefersReduced = deps.systemPrefersReduced ?? defaultSystemPrefersReduced;
  }

  restore(): void {
    const raw = this.storage.getItem(REDUCED_MOTION_STORAGE_KEY);
    if (raw && isReducedMotionMode(raw)) {
      this.mode = raw;
      return;
    }
    this.mode = 'system';
  }

  getMode(): ReducedMotionMode {
    return this.mode;
  }

  setMode(mode: ReducedMotionMode): void {
    this.mode = mode;
    this.storage.setItem(REDUCED_MOTION_STORAGE_KEY, mode);
  }

  /** Resolved effective flag used by camera / effect motion. */
  isEnabled(): boolean {
    if (this.mode === 'on') return true;
    if (this.mode === 'off') return false;
    return this.systemPrefersReduced();
  }
}

import {
  MASTER_VOLUME_STORAGE_KEY,
  SFX_VOLUME_STORAGE_KEY,
  type AudioStorage,
  type SfxId,
  type SfxPlayer,
} from './types';

export interface AudioControllerDeps {
  storage: AudioStorage;
  play?: SfxPlayer;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function parseVolume(raw: string | null, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return clamp01(n);
}

/**
 * Public seam for MVP audio: master + sfx volumes persist; playback is local synth only.
 */
export class AudioController {
  private readonly storage: AudioStorage;
  private readonly playImpl: SfxPlayer | null;
  private masterVolume = 0.8;
  private sfxVolume = 0.7;

  constructor(deps: AudioControllerDeps) {
    this.storage = deps.storage;
    this.playImpl = deps.play ?? null;
  }

  restore(): void {
    this.masterVolume = parseVolume(this.storage.getItem(MASTER_VOLUME_STORAGE_KEY), 0.8);
    this.sfxVolume = parseVolume(this.storage.getItem(SFX_VOLUME_STORAGE_KEY), 0.7);
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  /** Effective gain applied to a one-shot SFX. */
  effectiveGain(): number {
    return this.masterVolume * this.sfxVolume;
  }

  setMasterVolume(value: number): void {
    this.masterVolume = clamp01(value);
    this.storage.setItem(MASTER_VOLUME_STORAGE_KEY, String(this.masterVolume));
  }

  setSfxVolume(value: number): void {
    this.sfxVolume = clamp01(value);
    this.storage.setItem(SFX_VOLUME_STORAGE_KEY, String(this.sfxVolume));
  }

  play(id: SfxId): void {
    const gain = this.effectiveGain();
    if (gain <= 0) return;
    this.playImpl?.(id, gain);
  }
}

/** Locally synthesized SFX ids — no external audio assets. */
export type SfxId =
  | 'draw'
  | 'discard'
  | 'chow'
  | 'pung'
  | 'kong'
  | 'win'
  | 'scene_basic'
  | 'scene_big'
  | 'scene_top';

export const MASTER_VOLUME_STORAGE_KEY = 'mahjong.audio.masterVolume';
export const SFX_VOLUME_STORAGE_KEY = 'mahjong.audio.sfxVolume';

export interface AudioStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Injectable seam for WebAudio playback (tests assert ids without AudioContext). */
export type SfxPlayer = (id: SfxId, gain: number) => void;

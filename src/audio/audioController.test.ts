import { describe, expect, it, vi } from 'vitest';
import { AudioController } from './audioController';
import {
  MASTER_VOLUME_STORAGE_KEY,
  SFX_VOLUME_STORAGE_KEY,
  type AudioStorage,
  type SfxId,
} from './types';

function memoryStorage(initial: Record<string, string> = {}): AudioStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe('AudioController', () => {
  it('restores persisted master and sfx volumes', () => {
    const storage = memoryStorage({
      [MASTER_VOLUME_STORAGE_KEY]: '0.4',
      [SFX_VOLUME_STORAGE_KEY]: '0.5',
    });
    const audio = new AudioController({ storage });
    audio.restore();
    expect(audio.getMasterVolume()).toBe(0.4);
    expect(audio.getSfxVolume()).toBe(0.5);
    expect(audio.effectiveGain()).toBeCloseTo(0.2);
  });

  it('clamps and persists volume changes', () => {
    const storage = memoryStorage();
    const audio = new AudioController({ storage });
    audio.setMasterVolume(1.5);
    audio.setSfxVolume(-0.2);
    expect(audio.getMasterVolume()).toBe(1);
    expect(audio.getSfxVolume()).toBe(0);
    expect(storage.getItem(MASTER_VOLUME_STORAGE_KEY)).toBe('1');
    expect(storage.getItem(SFX_VOLUME_STORAGE_KEY)).toBe('0');
  });

  it('plays synthesized ids with effective gain and skips when silent', () => {
    const played: Array<{ id: SfxId; gain: number }> = [];
    const audio = new AudioController({
      storage: memoryStorage(),
      play: (id, gain) => played.push({ id, gain }),
    });
    audio.setMasterVolume(0.5);
    audio.setSfxVolume(0.4);
    audio.play('draw');
    audio.play('scene_top');
    expect(played).toEqual([
      { id: 'draw', gain: 0.2 },
      { id: 'scene_top', gain: 0.2 },
    ]);

    audio.setSfxVolume(0);
    audio.play('discard');
    expect(played).toHaveLength(2);
  });

  it('covers every MVP feedback id without external assets', () => {
    const ids: SfxId[] = [
      'draw',
      'discard',
      'chow',
      'pung',
      'kong',
      'win',
      'scene_basic',
      'scene_big',
      'scene_top',
    ];
    const play = vi.fn();
    const audio = new AudioController({ storage: memoryStorage(), play });
    for (const id of ids) audio.play(id);
    expect(play.mock.calls.map((c) => c[0])).toEqual(ids);
  });
});

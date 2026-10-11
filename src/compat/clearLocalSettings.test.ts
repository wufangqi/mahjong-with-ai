import { describe, expect, it } from 'vitest';
import { EXTERNAL_AI_STORAGE_KEY } from '../ai/config';
import { MASTER_VOLUME_STORAGE_KEY, SFX_VOLUME_STORAGE_KEY } from '../audio/types';
import { REDUCED_MOTION_STORAGE_KEY } from '../motion/types';
import { QUALITY_MODE_STORAGE_KEY, QUALITY_STORAGE_KEY } from '../quality/types';
import { THEME_STORAGE_KEY } from '../theme/types';
import { AUTO_SKIP_STORAGE_KEY, clearLocalSettingsKeys } from './clearLocalSettings';

function memoryStorage(init: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(init));
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

describe('clearLocalSettingsKeys', () => {
  it('removes theme, quality, audio, motion, scene, and external AI settings', () => {
    const storage = memoryStorage({
      [THEME_STORAGE_KEY]: 'court-palace',
      [QUALITY_STORAGE_KEY]: 'high',
      [QUALITY_MODE_STORAGE_KEY]: 'manual',
      [MASTER_VOLUME_STORAGE_KEY]: '0.2',
      [SFX_VOLUME_STORAGE_KEY]: '0.1',
      [REDUCED_MOTION_STORAGE_KEY]: 'on',
      [AUTO_SKIP_STORAGE_KEY]: '1',
      [EXTERNAL_AI_STORAGE_KEY]: '{"proxyUrl":"https://x"}',
      keep: 'yes',
    });

    clearLocalSettingsKeys(storage);

    expect(storage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(QUALITY_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(QUALITY_MODE_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(MASTER_VOLUME_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(SFX_VOLUME_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(REDUCED_MOTION_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(AUTO_SKIP_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(EXTERNAL_AI_STORAGE_KEY)).toBeNull();
    expect(storage.getItem('keep')).toBe('yes');
  });
});

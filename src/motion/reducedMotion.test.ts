import { describe, expect, it } from 'vitest';
import { dampenCameraMotion } from './dampen';
import { ReducedMotionController } from './reducedMotion';
import { REDUCED_MOTION_STORAGE_KEY, type MotionStorage } from './types';

function memoryStorage(initial: Record<string, string> = {}): MotionStorage {
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

describe('ReducedMotionController', () => {
  it('defaults to system preference when nothing is stored', () => {
    const on = new ReducedMotionController({
      storage: memoryStorage(),
      systemPrefersReduced: () => true,
    });
    on.restore();
    expect(on.getMode()).toBe('system');
    expect(on.isEnabled()).toBe(true);

    const off = new ReducedMotionController({
      storage: memoryStorage(),
      systemPrefersReduced: () => false,
    });
    off.restore();
    expect(off.isEnabled()).toBe(false);
  });

  it('lets the player override and persist the choice', () => {
    const storage = memoryStorage();
    const ctrl = new ReducedMotionController({
      storage,
      systemPrefersReduced: () => true,
    });
    ctrl.restore();
    ctrl.setMode('off');
    expect(ctrl.isEnabled()).toBe(false);
    expect(storage.getItem(REDUCED_MOTION_STORAGE_KEY)).toBe('off');

    const restored = new ReducedMotionController({
      storage,
      systemPrefersReduced: () => true,
    });
    restored.restore();
    expect(restored.getMode()).toBe('off');
    expect(restored.isEnabled()).toBe(false);

    restored.setMode('on');
    expect(restored.isEnabled()).toBe(true);
  });
});

describe('dampenCameraMotion', () => {
  it('zeros shake, softens aggressive dolly push, and slows turns', () => {
    const out = dampenCameraMotion({ shake: 0.45, dolly: -3, turnRate: 1 });
    expect(out.shake).toBe(0);
    expect(Math.abs(out.dolly)).toBeLessThanOrEqual(0.25);
    expect(out.turnRate).toBe(0.25);
  });

  it('does not invent particle or banner channels — only camera motion', () => {
    const keys = Object.keys(dampenCameraMotion({ shake: 1, dolly: 2 }));
    expect(keys.sort()).toEqual(['dolly', 'shake', 'turnRate'].sort());
  });
});

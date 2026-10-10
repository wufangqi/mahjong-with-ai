import { describe, expect, it } from 'vitest';
import { QUALITY_PRESETS } from './presets';
import { QualityController, type QualityStorage } from './qualityController';
import {
  QUALITY_MODE_STORAGE_KEY,
  QUALITY_STORAGE_KEY,
  type GpuProbeInfo,
} from './types';

function memoryStorage(initial: Record<string, string> = {}): QualityStorage {
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

const capableGpu: GpuProbeInfo = {
  renderer: 'NVIDIA GeForce RTX 3060',
  webgl2: true,
  gpuParticlesAvailable: true,
};

const uhdGpu: GpuProbeInfo = {
  renderer: 'Intel(R) UHD Graphics 620',
  webgl2: true,
  gpuParticlesAvailable: true,
};

const weakGpu: GpuProbeInfo = {
  renderer: 'Google SwiftShader',
  webgl2: true,
  gpuParticlesAvailable: false,
};

describe('Quality presets', () => {
  it('exposes distinct DPR, shadow, bloom, particle, and sky controls per tier', () => {
    expect(QUALITY_PRESETS.low).toMatchObject({
      dprCap: 1,
      shadows: 'off',
      bloom: 'off',
      sky: 'simplified',
      preferGpuParticles: false,
    });
    expect(QUALITY_PRESETS.mid).toMatchObject({
      dprCap: 1.5,
      shadows: 'mid',
      shadowMapSize: 1024,
      bloom: 'full',
      sky: 'full',
      preferGpuParticles: true,
    });
    expect(QUALITY_PRESETS.high).toMatchObject({
      dprCap: 2,
      shadows: 'high',
      shadowMapSize: 2048,
      bloom: 'full',
      sky: 'full',
      preferGpuParticles: true,
    });
    expect(QUALITY_PRESETS.low.particleBudget).toBeLessThan(QUALITY_PRESETS.mid.particleBudget);
    expect(QUALITY_PRESETS.mid.particleBudget).toBeLessThan(QUALITY_PRESETS.high.particleBudget);
  });
});

describe('QualityController', () => {
  it('selects low on weak GPU regardless of measured fps', () => {
    const qc = new QualityController({ storage: memoryStorage() });
    expect(qc.selectInitial(weakGpu, 60)).toBe('low');
  });

  it('selects mid for UHD-class GPU with healthy measured fps', () => {
    const qc = new QualityController({ storage: memoryStorage() });
    expect(qc.selectInitial(uhdGpu, 58)).toBe('mid');
  });

  it('selects high for capable discrete GPU with high measured fps', () => {
    const qc = new QualityController({ storage: memoryStorage() });
    expect(qc.selectInitial(capableGpu, 60)).toBe('high');
  });

  it('selects low when measured fps is below mid floor', () => {
    const qc = new QualityController({ storage: memoryStorage() });
    expect(qc.selectInitial(capableGpu, 40)).toBe('low');
  });

  it('auto-downgrades exactly one tier after 5s below 80% target and never raises in the same game', () => {
    const qc = new QualityController({ storage: memoryStorage() });
    qc.selectInitial(capableGpu, 60);
    expect(qc.getTier()).toBe('high');
    qc.beginGame();

    // 80% of high target 60 = 48
    let changed: string | null = null;
    for (let i = 0; i < 50; i++) {
      changed = qc.recordFrame(100, 40) ?? changed;
    }
    expect(changed).toBe('mid');
    expect(qc.getTier()).toBe('mid');

    // More poor frames must not raise; at most another one-step drop after another 5s
    for (let i = 0; i < 49; i++) {
      expect(qc.recordFrame(100, 40)).toBeNull();
    }
    expect(qc.getTier()).toBe('mid');
    expect(qc.recordFrame(100, 40)).toBe('low');
    expect(qc.getTier()).toBe('low');

    // Healthy fps must not auto-raise within the same game
    for (let i = 0; i < 100; i++) {
      expect(qc.recordFrame(100, 60)).toBeNull();
    }
    expect(qc.getTier()).toBe('low');
  });

  it('manual selection disables auto changes', () => {
    const storage = memoryStorage();
    const qc = new QualityController({ storage });
    qc.selectInitial(capableGpu, 60);
    qc.setManual('high');
    qc.beginGame();

    for (let i = 0; i < 60; i++) {
      expect(qc.recordFrame(100, 20)).toBeNull();
    }
    expect(qc.getTier()).toBe('high');
    expect(qc.getMode()).toBe('manual');
    expect(storage.getItem(QUALITY_MODE_STORAGE_KEY)).toBe('manual');
    expect(storage.getItem(QUALITY_STORAGE_KEY)).toBe('high');
  });

  it('restore keeps manual tier and ignores selectInitial probes', () => {
    const storage = memoryStorage({
      [QUALITY_MODE_STORAGE_KEY]: 'manual',
      [QUALITY_STORAGE_KEY]: 'low',
    });
    const qc = new QualityController({ storage });
    qc.restore();
    expect(qc.getMode()).toBe('manual');
    expect(qc.getTier()).toBe('low');
    expect(qc.selectInitial(capableGpu, 60)).toBe('low');
  });

  it('endGame then selectInitial may raise again for the next game', () => {
    const qc = new QualityController({ storage: memoryStorage() });
    qc.selectInitial(capableGpu, 60);
    qc.beginGame();
    for (let i = 0; i < 50; i++) qc.recordFrame(100, 40);
    expect(qc.getTier()).toBe('mid');
    qc.endGame();
    expect(qc.selectInitial(capableGpu, 60)).toBe('high');
  });

  it('pinAutoTier keeps auto mode for downgrade tests', () => {
    const qc = new QualityController({ storage: memoryStorage() });
    qc.pinAutoTier('mid');
    expect(qc.getMode()).toBe('auto');
    expect(qc.getTier()).toBe('mid');
    qc.beginGame();
    for (let i = 0; i < 50; i++) qc.recordFrame(100, 20);
    expect(qc.getTier()).toBe('low');
  });
});

/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { createParticleSystem } from './particleSystem';

describe('createParticleSystem', () => {
  it('uses GPU backend when preferred and available', () => {
    const sys = createParticleSystem({ capacity: 64, preferGpu: true, gpuAvailable: true });
    expect(sys.backend).toBe('gpu');
    expect(sys.points.name).toBe('particles-gpu');
    sys.dispose();
  });

  it('falls back to CPU when GPU path is unavailable', () => {
    const sys = createParticleSystem({ capacity: 64, preferGpu: true, gpuAvailable: false });
    expect(sys.backend).toBe('cpu');
    expect(sys.points.name).toBe('particles-cpu');
    sys.dispose();
  });

  it('uses CPU when tier prefers CPU even if GPU is available', () => {
    const sys = createParticleSystem({ capacity: 32, preferGpu: false, gpuAvailable: true });
    expect(sys.backend).toBe('cpu');
    sys.dispose();
  });

  it('honors particle budget for emit capacity', () => {
    const sys = createParticleSystem({ capacity: 100, preferGpu: true, gpuAvailable: true });
    sys.setBudget(3);
    for (let i = 0; i < 10; i++) {
      sys.emit({ x: i, y: 0, z: 0, color: [1, 1, 1], life: 1 });
    }
    sys.update(0.016);
    // Only budget slots should be live; alpha sum stays within budget particles.
    let live = 0;
    const alpha = sys.points.geometry.getAttribute('aAlpha');
    for (let i = 0; i < alpha.count; i++) {
      if ((alpha.getX(i) as number) > 0) live += 1;
    }
    expect(live).toBeLessThanOrEqual(3);
    sys.dispose();
  });

  it('covers scene emits on both backends (smoke update)', () => {
    for (const gpu of [true, false]) {
      const sys = createParticleSystem({ capacity: 16, preferGpu: gpu, gpuAvailable: gpu });
      sys.emit({
        x: 0,
        y: 1,
        z: 0,
        vx: 0.1,
        vy: 0.2,
        vz: 0,
        color: [1, 0.8, 0.2],
        size: 0.2,
        life: 0.5,
      });
      sys.update(0.05);
      const pos = sys.points.geometry.getAttribute('position');
      expect(pos.getY(0)).not.toBe(1);
      sys.clear();
      sys.update(0);
      expect(sys.points.geometry.getAttribute('aAlpha').getX(0)).toBe(0);
      sys.dispose();
    }
  });
});

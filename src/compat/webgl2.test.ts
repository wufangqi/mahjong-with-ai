import { describe, expect, it, vi } from 'vitest';
import { isWebGL2Available, WEBGL2_UNSUPPORTED_MESSAGE } from './webgl2';

describe('isWebGL2Available', () => {
  it('returns true when getContext yields a WebGL2 context', () => {
    const canvas = {
      getContext: vi.fn(() => ({})),
    };
    expect(isWebGL2Available(canvas as unknown as HTMLCanvasElement)).toBe(true);
    expect(canvas.getContext).toHaveBeenCalledWith('webgl2', { failIfMajorPerformanceCaveat: false });
  });

  it('returns false when webgl2 context is unavailable', () => {
    const canvas = {
      getContext: vi.fn(() => null),
    };
    expect(isWebGL2Available(canvas as unknown as HTMLCanvasElement)).toBe(false);
  });

  it('returns false when getContext throws', () => {
    const canvas = {
      getContext: vi.fn(() => {
        throw new Error('no gl');
      }),
    };
    expect(isWebGL2Available(canvas as unknown as HTMLCanvasElement)).toBe(false);
  });

  it('exposes a clear Chinese unsupported message for the compatibility page', () => {
    expect(WEBGL2_UNSUPPORTED_MESSAGE).toContain('WebGL2');
    expect(WEBGL2_UNSUPPORTED_MESSAGE).toMatch(/桌面|浏览器/);
  });
});

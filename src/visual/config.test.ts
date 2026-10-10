import { describe, expect, it } from 'vitest';
import { parseVisualConfig } from './config';

describe('parseVisualConfig', () => {
  it('parses fixed clock, seed, viewport, dpr, theme, and capture time', () => {
    const cfg = parseVisualConfig(
      '?visual=1&tier=top&seed=7&width=800&height=600&dpr=1&theme=court-palace&captureAt=2450&stepMs=16',
    );
    expect(cfg.enabled).toBe(true);
    expect(cfg.tier).toBe('top');
    expect(cfg.seed).toBe(7);
    expect(cfg.width).toBe(800);
    expect(cfg.height).toBe(600);
    expect(cfg.dpr).toBe(1);
    expect(cfg.theme).toBe('court-palace');
    expect(cfg.captureAt).toBe(2450);
    expect(cfg.stepMs).toBe(16);
  });

  it('defaults to disabled interactive preview when visual flag absent', () => {
    expect(parseVisualConfig('').enabled).toBe(false);
    expect(parseVisualConfig('?tier=big').enabled).toBe(false);
  });
});

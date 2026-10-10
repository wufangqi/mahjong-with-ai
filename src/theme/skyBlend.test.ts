import { describe, expect, it } from 'vitest';
import { blendSkyColumn, lerpRgb, sampleSkyRgb } from './skyBlend';
import { classicGreenTheme } from './themes/classicGreen';
import { courtPalaceTheme } from './themes/courtPalace';

describe('skyBlend — continuous sky transition samples', () => {
  it('samples solid sky as a constant color', () => {
    const sky = classicGreenTheme.modules.sky;
    expect(sampleSkyRgb(sky, 0)).toEqual(sampleSkyRgb(sky, 1));
    expect(sampleSkyRgb(sky, 0.5)).toEqual([(0x14), (0x26), (0x1c)]);
  });

  it('samples court gradient top darker than bottom', () => {
    const sky = courtPalaceTheme.modules.sky;
    const top = sampleSkyRgb(sky, 0);
    const bottom = sampleSkyRgb(sky, 1);
    const topLuma = top[0] + top[1] + top[2];
    const bottomLuma = bottom[0] + bottom[1] + bottom[2];
    expect(bottomLuma).toBeGreaterThan(topLuma);
  });

  it('mid-transition column differs from both endpoints (no end-frame-only jump)', () => {
    const from = classicGreenTheme.modules.sky;
    const to = courtPalaceTheme.modules.sky;
    const mid = blendSkyColumn(from, to, 0.5, 8);
    const start = blendSkyColumn(from, to, 0, 8);
    const end = blendSkyColumn(from, to, 1, 8);
    expect(mid[0]).not.toEqual(start[0]);
    expect(mid[0]).not.toEqual(end[0]);
    expect(mid[0]).toEqual(lerpRgb(start[0]!, end[0]!, 0.5));
  });
});

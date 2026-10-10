import { describe, expect, it } from 'vitest';
import { FONT_SANS_FAMILY, FONT_SERIF_FAMILY } from './families';

describe('font families', () => {
  it('exposes distinct Source Han Sans / Serif CSS family names', () => {
    expect(FONT_SANS_FAMILY).toContain('Sans');
    expect(FONT_SERIF_FAMILY).toContain('Serif');
    expect(FONT_SANS_FAMILY).not.toEqual(FONT_SERIF_FAMILY);
  });
});

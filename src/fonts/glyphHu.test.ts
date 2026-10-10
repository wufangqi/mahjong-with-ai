import { describe, expect, it } from 'vitest';
import { installVisualRng } from '../visual/rng';
import { sampleGlyph } from '../preview/fx';
import glyphHu from './glyph-hu.json';

describe('offline 胡 glyph', () => {
  it('ships a non-empty offline point lattice', () => {
    expect(glyphHu.char).toBe('胡');
    expect(glyphHu.points.length).toBeGreaterThan(100);
  });

  it('sampleGlyph for 胡 is deterministic under a fixed visual seed and ignores system fonts', () => {
    installVisualRng(42);
    const a = sampleGlyph('胡', 64, 'invalid-system-font-name');
    installVisualRng(42);
    const b = sampleGlyph('胡', 64, 'invalid-system-font-name');
    expect([...a]).toEqual([...b]);
    // Points should span a real glyph silhouette, not a single fallback pixel.
    const xs = Array.from({ length: 64 }, (_, i) => a[i * 2]!);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.1);
  });
});

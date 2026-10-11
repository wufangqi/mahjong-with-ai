import { describe, expect, it } from 'vitest';
import { hasSustainedGrowth } from './stability';

describe('hasSustainedGrowth', () => {
  it('returns false for flat or noisy-stable series', () => {
    const flat = Array.from({ length: 20 }, () => 50_000_000);
    expect(hasSustainedGrowth(flat)).toBe(false);

    const noisy = Array.from({ length: 20 }, (_, i) => 50_000_000 + (i % 3) * 100_000);
    expect(hasSustainedGrowth(noisy)).toBe(false);
  });

  it('returns true when heap grows steadily across the soak window', () => {
    const growing = Array.from({ length: 20 }, (_, i) => 40_000_000 + i * 500_000);
    expect(hasSustainedGrowth(growing, { maxBytesPerStep: 100_000, minDeltaBytes: 1_000_000 })).toBe(
      true,
    );
  });
});

import { describe, expect, it } from 'vitest';
import { FIXED_BASIC_HAND, FIXED_HANDS, isFixedHand } from './fixedHands';

describe('fixed effect preview hands', () => {
  it('exposes the Demo basic hand as a 14-tile fixed input', () => {
    expect(FIXED_BASIC_HAND).toHaveLength(14);
    expect([...FIXED_BASIC_HAND]).toEqual([
      'm2',
      'm3',
      'm4',
      'p5',
      'p6',
      'p7',
      's3',
      's4',
      's5',
      'E',
      'E',
      'E',
      'P',
      'P',
    ]);
  });

  it('keeps idle/basic/big/top hands aligned with the read-only prototype', () => {
    expect(FIXED_HANDS.idle).toEqual(FIXED_HANDS.basic);
    expect(FIXED_HANDS.big).toHaveLength(14);
    expect(FIXED_HANDS.top).toHaveLength(14);
    expect(isFixedHand('basic')).toBe(true);
    expect(isFixedHand('unknown')).toBe(false);
  });
});

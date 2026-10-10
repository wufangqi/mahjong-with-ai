import { describe, expect, it } from 'vitest';
import type { TileCode } from './tiles';
import { isWinningCodes, waitingTileCodes } from './winning';

function codes(...list: TileCode[]): TileCode[] {
  return list;
}

describe('isWinningCodes', () => {
  it('recognizes a standard 平胡 hand (four melds and a pair)', () => {
    expect(
      isWinningCodes(
        codes(
          'm1',
          'm2',
          'm3',
          'm4',
          'm5',
          'm6',
          'p2',
          'p2',
          'p2',
          's7',
          's8',
          's9',
          'E',
          'E',
        ),
      ),
    ).toBe(true);
  });

  it('rejects a non-winning 14-tile hand', () => {
    expect(
      isWinningCodes(
        codes(
          'm1',
          'm2',
          'm3',
          'm4',
          'm5',
          'm6',
          'p2',
          'p2',
          'p2',
          's7',
          's8',
          's9',
          'E',
          'S',
        ),
      ),
    ).toBe(false);
  });

  it('recognizes 七对 including four identical tiles as two pairs', () => {
    expect(
      isWinningCodes(
        codes('m1', 'm1', 'm2', 'm2', 'm3', 'm3', 'm4', 'm4', 'm5', 'm5', 'm5', 'm5', 'p1', 'p1'),
      ),
    ).toBe(true);
  });

  it('recognizes 十三幺', () => {
    expect(
      isWinningCodes(
        codes(
          'm1',
          'm9',
          'p1',
          'p9',
          's1',
          's9',
          'E',
          'S',
          'W',
          'N',
          'C',
          'F',
          'P',
          'P',
        ),
      ),
    ).toBe(true);
  });
});

describe('waitingTileCodes', () => {
  it('lists tiles that complete a ready hand', () => {
    // 听 m1 / m4：两面听
    const hand = codes('m2', 'm3', 'm5', 'm6', 'm7', 'p2', 'p2', 'p2', 's7', 's8', 's9', 'E', 'E');
    expect(waitingTileCodes(hand)).toEqual(['m1', 'm4']);
  });

  it('returns empty when the hand is not ready', () => {
    const hand = codes('m1', 'm2', 'm3', 'm4', 'm5', 'm7', 'p2', 'p2', 'p2', 's7', 's8', 's9', 'E');
    expect(waitingTileCodes(hand)).toEqual([]);
  });
});

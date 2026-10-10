import { describe, expect, it } from 'vitest';
import type { TileCode } from './tiles';
import { evaluateWin, isWinningCodes, waitingTileCodes } from './winning';

function codes(...list: TileCode[]): TileCode[] {
  return list;
}

const PINGHU = codes(
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
);

const QIDUI = codes('m1', 'm1', 'm2', 'm2', 'm3', 'm3', 'm4', 'm4', 'm5', 'm5', 'm5', 'm5', 'p1', 'p1');

const SHISANYAO = codes(
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
);

describe('isWinningCodes', () => {
  it('recognizes a standard 平胡 hand (four melds and a pair)', () => {
    expect(isWinningCodes(PINGHU)).toBe(true);
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
    expect(isWinningCodes(QIDUI)).toBe(true);
  });

  it('recognizes 十三幺', () => {
    expect(isWinningCodes(SHISANYAO)).toBe(true);
  });
});

describe('evaluateWin', () => {
  it('tags ordinary four-meld hands as 平胡 with 1 fan', () => {
    expect(evaluateWin(PINGHU)).toEqual({ patterns: ['pinghu'], fan: 1 });
  });

  it('does not tag 平胡 when 七对 already matches', () => {
    expect(evaluateWin(QIDUI)).toEqual({ patterns: ['qidui'], fan: 1 });
  });

  it('does not tag 平胡 when 十三幺 already matches', () => {
    expect(evaluateWin(SHISANYAO)).toEqual({ patterns: ['shisanyao'], fan: 1 });
  });

  it('returns empty patterns for a non-winning hand', () => {
    expect(
      evaluateWin(
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
    ).toEqual({ patterns: [], fan: 0 });
  });

  it('tags 杠上开花 in place of bare 平胡', () => {
    expect(evaluateWin(PINGHU, 0, { gangShangKaiHua: true })).toEqual({
      patterns: ['gangshangkaihua'],
      fan: 1,
    });
  });

  it('stacks 杠上开花 with 七对', () => {
    expect(evaluateWin(QIDUI, 0, { gangShangKaiHua: true })).toEqual({
      patterns: ['qidui', 'gangshangkaihua'],
      fan: 2,
    });
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

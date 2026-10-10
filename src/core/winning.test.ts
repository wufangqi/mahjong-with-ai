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

/** Four concealed triplets + pair (碰碰胡, includes honors). */
const PENGPENGHU = codes(
  'm1',
  'm1',
  'm1',
  'p3',
  'p3',
  'p3',
  's5',
  's5',
  's5',
  'E',
  'E',
  'E',
  'C',
  'C',
);

/** All-characters 清一色 standard hand (sequences + pair). */
const QINGYISE = codes(
  'm1',
  'm2',
  'm3',
  'm2',
  'm3',
  'm4',
  'm5',
  'm5',
  'm5',
  'm7',
  'm8',
  'm9',
  'm9',
  'm9',
);

/** 清一色 + 碰碰胡. */
const QINGYISE_PENGPENGHU = codes(
  'm1',
  'm1',
  'm1',
  'm3',
  'm3',
  'm3',
  'm5',
  'm5',
  'm5',
  'm7',
  'm7',
  'm7',
  'm9',
  'm9',
);

const QIDUI = codes('m1', 'm1', 'm2', 'm2', 'm3', 'm3', 'm4', 'm4', 'm5', 'm5', 'm5', 'm5', 'p1', 'p1');

/** 七对 that is also 清一色. */
const QIDUI_QINGYISE = codes(
  'm1',
  'm1',
  'm2',
  'm2',
  'm3',
  'm3',
  'm4',
  'm4',
  'm5',
  'm5',
  'm6',
  'm6',
  'm7',
  'm7',
);

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

  it('tags 碰碰胡 for four triplets and a pair', () => {
    expect(evaluateWin(PENGPENGHU)).toEqual({ patterns: ['pengpenghu'], fan: 1 });
  });

  it('rejects 碰碰胡 when a sequence is required', () => {
    expect(evaluateWin(PINGHU).patterns).not.toContain('pengpenghu');
  });

  it('tags 清一色 for a single numbered suit without honors', () => {
    expect(evaluateWin(QINGYISE)).toEqual({ patterns: ['qingyise'], fan: 1 });
  });

  it('rejects 清一色 when honors are present', () => {
    expect(evaluateWin(PINGHU).patterns).not.toContain('qingyise');
  });

  it('rejects 清一色 when two numbered suits are mixed', () => {
    const mixed = codes(
      'm1',
      'm2',
      'm3',
      'm4',
      'm5',
      'm6',
      'p1',
      'p2',
      'p3',
      'p7',
      'p8',
      'p9',
      'p5',
      'p5',
    );
    expect(evaluateWin(mixed)).toEqual({ patterns: ['pinghu'], fan: 1 });
  });

  it('stacks 清一色 with 碰碰胡 for 2 fan', () => {
    expect(evaluateWin(QINGYISE_PENGPENGHU)).toEqual({
      patterns: ['pengpenghu', 'qingyise'],
      fan: 2,
    });
  });

  it('stacks 清一色 with 七对', () => {
    expect(evaluateWin(QIDUI_QINGYISE)).toEqual({
      patterns: ['qidui', 'qingyise'],
      fan: 2,
    });
  });

  it('stacks 清一色 with 杠上开花', () => {
    expect(evaluateWin(QINGYISE, 0, { gangShangKaiHua: true })).toEqual({
      patterns: ['qingyise', 'gangshangkaihua'],
      fan: 2,
    });
  });

  it('does not add fan for self-draw or dealer (no such multipliers)', () => {
    const base = evaluateWin(PINGHU);
    expect(base).toEqual({ patterns: ['pinghu'], fan: 1 });
    // API has no selfDraw/dealer fan knobs — settlement stays pattern-only.
    expect(evaluateWin(PINGHU, 0, {})).toEqual(base);
  });

  it('counts four identical tiles as two pairs in 七对', () => {
    expect(evaluateWin(QIDUI)).toEqual({ patterns: ['qidui'], fan: 1 });
  });

  it('rejects 七对 when an exposed meld is present', () => {
    // Gapped pairs cannot form a standard hand either — only 七对 would have matched if concealed.
    const result = evaluateWin(codes('m1', 'm1', 'm3', 'm3', 'm5', 'm5', 'm7', 'm7'), 2, {
      melds: [
        { kind: 'pung', codes: ['p2', 'p2', 'p2'] },
        { kind: 'pung', codes: ['s2', 's2', 's2'] },
      ],
    });
    expect(result.patterns).not.toContain('qidui');
    expect(result).toEqual({ patterns: [], fan: 0 });
  });

  it('rejects 十三幺 when any exposed meld is present', () => {
    // 11 concealed orphans-ish tiles + exposed pung — not 十三幺 (requires no melds).
    const concealed = codes('m1', 'm9', 'p1', 'p9', 's1', 's9', 'E', 'S', 'W', 'N', 'C');
    expect(
      evaluateWin(concealed, 1, {
        melds: [{ kind: 'pung', codes: ['F', 'F', 'F'] }],
      }).patterns,
    ).not.toContain('shisanyao');
  });

  it('includes exposed melds when judging 清一色', () => {
    // 1 exposed meld → 11 concealed (three melds + pair), all characters.
    const concealed = codes('m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm2', 'm2');
    expect(
      evaluateWin(concealed, 1, {
        melds: [{ kind: 'pung', codes: ['m9', 'm9', 'm9'] }],
      }),
    ).toEqual({ patterns: ['qingyise'], fan: 1 });
  });

  it('rejects 清一色 when an exposed meld introduces another suit', () => {
    const concealed = codes('m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm2', 'm2');
    expect(
      evaluateWin(concealed, 1, {
        melds: [{ kind: 'pung', codes: ['p9', 'p9', 'p9'] }],
      }),
    ).toEqual({ patterns: ['pinghu'], fan: 1 });
  });

  it('rejects 碰碰胡 when an exposed chow is present', () => {
    // 1 exposed + 11 concealed: two triplets, one more meld slot filled by chow, + pair.
    const concealed = codes('m1', 'm1', 'm1', 'p3', 'p3', 'p3', 'E', 'E', 'E', 'C', 'C');
    expect(
      evaluateWin(concealed, 1, {
        melds: [{ kind: 'chow', codes: ['s1', 's2', 's3'] }],
      }).patterns,
    ).not.toContain('pengpenghu');
  });

  it('tags 碰碰胡 with exposed pung/kong melds', () => {
    // 2 exposed → 8 concealed (two triplets + pair).
    const concealed = codes('m1', 'm1', 'm1', 'E', 'E', 'E', 'C', 'C');
    expect(
      evaluateWin(concealed, 2, {
        melds: [
          { kind: 'pung', codes: ['p3', 'p3', 'p3'] },
          { kind: 'exposed_kong', codes: ['s5', 's5', 's5', 's5'] },
        ],
      }),
    ).toEqual({ patterns: ['pengpenghu'], fan: 1 });
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

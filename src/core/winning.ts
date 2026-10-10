import { FACE_CODES, type TileCode } from './tiles';

const ORPHANS: readonly TileCode[] = [
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
];

function countsOf(codes: readonly TileCode[]): Map<TileCode, number> {
  const map = new Map<TileCode, number>();
  for (const code of codes) {
    map.set(code, (map.get(code) ?? 0) + 1);
  }
  return map;
}

function isSevenPairs(codes: readonly TileCode[]): boolean {
  if (codes.length !== 14) return false;
  const counts = countsOf(codes);
  let pairs = 0;
  for (const n of counts.values()) {
    if (n % 2 !== 0) return false;
    pairs += n / 2;
  }
  return pairs === 7;
}

function isThirteenOrphans(codes: readonly TileCode[]): boolean {
  if (codes.length !== 14) return false;
  const counts = countsOf(codes);
  let pairFound = false;
  for (const orphan of ORPHANS) {
    const n = counts.get(orphan) ?? 0;
    if (n === 0) return false;
    if (n === 1) continue;
    if (n === 2 && !pairFound) {
      pairFound = true;
      continue;
    }
    return false;
  }
  if (!pairFound) return false;
  for (const code of counts.keys()) {
    if (!ORPHANS.includes(code)) return false;
  }
  return true;
}

function cloneCounts(counts: Map<TileCode, number>): Map<TileCode, number> {
  return new Map(counts);
}

function remove(counts: Map<TileCode, number>, code: TileCode, n: number): boolean {
  const have = counts.get(code) ?? 0;
  if (have < n) return false;
  if (have === n) counts.delete(code);
  else counts.set(code, have - n);
  return true;
}

function isNumberedSuit(code: TileCode): boolean {
  const suit = code[0];
  return (suit === 'm' || suit === 'p' || suit === 's') && code.length === 2;
}

function tryStandard(counts: Map<TileCode, number>, meldsLeft: number): boolean {
  if (meldsLeft === 0) {
    return counts.size === 0;
  }

  let anchor: TileCode | null = null;
  for (const code of FACE_CODES) {
    if ((counts.get(code) ?? 0) > 0) {
      anchor = code;
      break;
    }
  }
  if (!anchor) return meldsLeft === 0;

  {
    const next = cloneCounts(counts);
    if (remove(next, anchor, 3) && tryStandard(next, meldsLeft - 1)) return true;
  }

  if (isNumberedSuit(anchor)) {
    const suit = anchor[0]!;
    const rank = Number(anchor[1]);
    if (rank <= 7) {
      const a = anchor;
      const b = `${suit}${rank + 1}` as TileCode;
      const c = `${suit}${rank + 2}` as TileCode;
      const next = cloneCounts(counts);
      if (remove(next, a, 1) && remove(next, b, 1) && remove(next, c, 1) && tryStandard(next, meldsLeft - 1)) {
        return true;
      }
    }
  }

  return false;
}

function isStandardWin(codes: readonly TileCode[], exposedMeldCount = 0): boolean {
  const meldsLeft = 4 - exposedMeldCount;
  if (meldsLeft < 0) return false;
  // Kong replacement keeps concealed length identical to pung/chow melds.
  const expected = 2 + meldsLeft * 3;
  if (codes.length !== expected) return false;
  const base = countsOf(codes);
  for (const code of FACE_CODES) {
    if ((base.get(code) ?? 0) < 2) continue;
    const next = cloneCounts(base);
    remove(next, code, 2);
    if (tryStandard(next, meldsLeft)) return true;
  }
  return false;
}

/** Whitelist fan ids recognized by the core (ADR-0002). */
export type FanPatternId =
  | 'pinghu'
  | 'qidui'
  | 'shisanyao'
  | 'gangshangkaihua';

export interface WinEvaluation {
  patterns: FanPatternId[];
  fan: number;
}

export interface EvaluateWinOptions {
  /** True when the winning tile was a kong replacement (杠上开花). */
  gangShangKaiHua?: boolean;
}

/**
 * Score a completed hand. 平胡 only applies when no other listed pattern
 * matches. 杠上开花 stacks with other non-平胡 patterns and replaces bare 平胡.
 */
export function evaluateWin(
  codes: readonly TileCode[],
  exposedMeldCount = 0,
  options: EvaluateWinOptions = {},
): WinEvaluation {
  const gangShangKaiHua = Boolean(options.gangShangKaiHua);

  let patterns: FanPatternId[] = [];

  if (exposedMeldCount === 0) {
    if (codes.length !== 14) return { patterns: [], fan: 0 };
    if (isSevenPairs(codes)) patterns.push('qidui');
    if (isThirteenOrphans(codes)) patterns.push('shisanyao');
    if (patterns.length === 0 && isStandardWin(codes, 0)) {
      patterns.push('pinghu');
    }
  } else {
    if (!isStandardWin(codes, exposedMeldCount)) return { patterns: [], fan: 0 };
    patterns.push('pinghu');
  }

  if (patterns.length === 0) return { patterns: [], fan: 0 };

  if (gangShangKaiHua) {
    patterns = patterns.filter((p) => p !== 'pinghu');
    patterns.push('gangshangkaihua');
  }

  return { patterns, fan: patterns.length };
}

/** True when face codes form a recognized winning hand under 爽胡规则 (fully concealed). */
export function isWinningCodes(codes: readonly TileCode[]): boolean {
  return evaluateWin(codes).patterns.length > 0;
}

/**
 * Win check for a seat that may already hold exposed melds.
 * 七对 / 十三幺 require a fully concealed hand.
 */
export function isWinningHand(concealed: readonly TileCode[], exposedMeldCount: number): boolean {
  if (exposedMeldCount === 0) return isWinningCodes(concealed);
  return isStandardWin(concealed, exposedMeldCount);
}

/**
 * Face codes that would complete a concealed hand given existing exposed melds (听牌可胡牌).
 * Order follows FACE_CODES.
 */
export function waitingTileCodes(
  concealed: readonly TileCode[],
  exposedMeldCount = 0,
): TileCode[] {
  const expected = 13 - exposedMeldCount * 3;
  if (concealed.length !== expected) return [];
  const waiting: TileCode[] = [];
  for (const code of FACE_CODES) {
    if (isWinningHand([...concealed, code], exposedMeldCount)) waiting.push(code);
  }
  return waiting;
}

import type { MeldKind } from './types';
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

const TRIPLET_MELD_KINDS: ReadonlySet<MeldKind> = new Set([
  'pung',
  'exposed_kong',
  'concealed_kong',
  'added_kong',
]);

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

function tryOnlyTriplets(counts: Map<TileCode, number>, meldsLeft: number): boolean {
  if (meldsLeft === 0) return counts.size === 0;

  let anchor: TileCode | null = null;
  for (const code of FACE_CODES) {
    if ((counts.get(code) ?? 0) > 0) {
      anchor = code;
      break;
    }
  }
  if (!anchor) return meldsLeft === 0;

  const next = cloneCounts(counts);
  if (!remove(next, anchor, 3)) return false;
  return tryOnlyTriplets(next, meldsLeft - 1);
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

function isAllTripletsWin(
  codes: readonly TileCode[],
  melds: readonly MeldForWin[],
  exposedMeldCount: number,
): boolean {
  for (const meld of melds) {
    if (!TRIPLET_MELD_KINDS.has(meld.kind)) return false;
  }
  const meldsLeft = 4 - exposedMeldCount;
  if (meldsLeft < 0) return false;
  const expected = 2 + meldsLeft * 3;
  if (codes.length !== expected) return false;
  const base = countsOf(codes);
  for (const code of FACE_CODES) {
    if ((base.get(code) ?? 0) < 2) continue;
    const next = cloneCounts(base);
    remove(next, code, 2);
    if (tryOnlyTriplets(next, meldsLeft)) return true;
  }
  return false;
}

function isQingYiSe(concealed: readonly TileCode[], melds: readonly MeldForWin[]): boolean {
  const all: TileCode[] = [...concealed];
  for (const meld of melds) {
    all.push(...meld.codes);
  }
  if (all.length === 0) return false;
  let suit: string | null = null;
  for (const code of all) {
    if (!isNumberedSuit(code)) return false;
    const s = code[0]!;
    if (suit === null) suit = s;
    else if (suit !== s) return false;
  }
  return true;
}

/** Whitelist fan ids recognized by the core (ADR-0002). */
export type FanPatternId =
  | 'pinghu'
  | 'pengpenghu'
  | 'qingyise'
  | 'qidui'
  | 'shisanyao'
  | 'gangshangkaihua';

/** Exposed meld facts needed for 碰碰胡 / 清一色. */
export interface MeldForWin {
  kind: MeldKind;
  codes: readonly TileCode[];
}

export interface WinEvaluation {
  patterns: FanPatternId[];
  fan: number;
}

export interface EvaluateWinOptions {
  /** True when the winning tile was a kong replacement (杠上开花). */
  gangShangKaiHua?: boolean;
  /**
   * Exposed melds for pattern detection. When provided, length is the exposed
   * meld count (overrides the numeric `exposedMeldCount` argument).
   */
  melds?: readonly MeldForWin[];
}

/**
 * Score a completed hand. 平胡 only applies when no other listed pattern
 * matches. Non-平胡 patterns each count 1 fan and may stack. Self-draw and
 * dealer status never add fan.
 */
export function evaluateWin(
  codes: readonly TileCode[],
  exposedMeldCount = 0,
  options: EvaluateWinOptions = {},
): WinEvaluation {
  const melds = options.melds ?? [];
  const exposed = options.melds !== undefined ? melds.length : exposedMeldCount;
  const gangShangKaiHua = Boolean(options.gangShangKaiHua);

  let qidui = false;
  let shisanyao = false;
  let standard = false;

  if (exposed === 0) {
    if (codes.length !== 14) return { patterns: [], fan: 0 };
    qidui = isSevenPairs(codes);
    shisanyao = isThirteenOrphans(codes);
    standard = isStandardWin(codes, 0);
  } else {
    // 七对 / 十三幺 require a fully concealed hand.
    standard = isStandardWin(codes, exposed);
  }

  if (!qidui && !shisanyao && !standard) {
    return { patterns: [], fan: 0 };
  }

  const patterns: FanPatternId[] = [];

  if (qidui) patterns.push('qidui');
  if (shisanyao) patterns.push('shisanyao');
  if (standard && isAllTripletsWin(codes, melds, exposed)) {
    patterns.push('pengpenghu');
  }
  if (isQingYiSe(codes, melds)) {
    patterns.push('qingyise');
  }
  if (gangShangKaiHua) {
    patterns.push('gangshangkaihua');
  }

  if (patterns.length === 0 && standard) {
    patterns.push('pinghu');
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

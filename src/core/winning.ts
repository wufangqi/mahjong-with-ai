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
  // No non-orphan tiles allowed.
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

  // Pick the lowest remaining tile as an anchor.
  let anchor: TileCode | null = null;
  for (const code of FACE_CODES) {
    if ((counts.get(code) ?? 0) > 0) {
      anchor = code;
      break;
    }
  }
  if (!anchor) return meldsLeft === 0;

  // Triplet
  {
    const next = cloneCounts(counts);
    if (remove(next, anchor, 3) && tryStandard(next, meldsLeft - 1)) return true;
  }

  // Sequence (numbered suits only)
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

function isStandardWin(codes: readonly TileCode[]): boolean {
  if (codes.length !== 14) return false;
  const base = countsOf(codes);
  for (const code of FACE_CODES) {
    if ((base.get(code) ?? 0) < 2) continue;
    const next = cloneCounts(base);
    remove(next, code, 2);
    if (tryStandard(next, 4)) return true;
  }
  return false;
}

/** True when 14 face codes form a recognized winning hand under 爽胡规则. */
export function isWinningCodes(codes: readonly TileCode[]): boolean {
  if (codes.length !== 14) return false;
  return isSevenPairs(codes) || isThirteenOrphans(codes) || isStandardWin(codes);
}

/**
 * Face codes that would complete a 13-tile concealed hand (听牌可胡牌).
 * Order follows FACE_CODES.
 */
export function waitingTileCodes(concealed13: readonly TileCode[]): TileCode[] {
  if (concealed13.length !== 13) return [];
  const waiting: TileCode[] = [];
  for (const code of FACE_CODES) {
    if (isWinningCodes([...concealed13, code])) waiting.push(code);
  }
  return waiting;
}

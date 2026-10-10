/** Tile face codes used by 爽胡规则 (`shuanghu-v1`). */
export type TileCode =
  | `m${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | `p${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | `s${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | 'E'
  | 'S'
  | 'W'
  | 'N'
  | 'C'
  | 'F'
  | 'P';

/** One of the 136 distinct physical tiles. */
export interface PhysicalTile {
  readonly id: string;
  readonly code: TileCode;
}

export const SUIT_ORDER = ['m', 'p', 's'] as const;
export const HONOR_ORDER = ['E', 'S', 'W', 'N', 'C', 'F', 'P'] as const;

const SUIT_CODES: TileCode[] = (['m', 'p', 's'] as const).flatMap((suit) =>
  ([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => `${suit}${n}` as TileCode),
);

const HONOR_CODES: TileCode[] = [...HONOR_ORDER];

/** Canonical 34 face codes (each appears four times in a full set). */
export const FACE_CODES: readonly TileCode[] = [...SUIT_CODES, ...HONOR_CODES];

export const FULL_SET_SIZE = 136;

/** Build the fixed 136-tile set with stable entity ids (`code#copy`). */
export function createFullSet(): PhysicalTile[] {
  const tiles: PhysicalTile[] = [];
  for (const code of FACE_CODES) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({ id: `${code}#${copy}`, code });
    }
  }
  return tiles;
}

export function tileSortKey(code: TileCode): number {
  const suit = code[0];
  if (suit === 'm' || suit === 'p' || suit === 's') {
    const suitIndex = SUIT_ORDER.indexOf(suit);
    const rank = Number(code.slice(1));
    return suitIndex * 10 + rank;
  }
  return 100 + HONOR_ORDER.indexOf(code as (typeof HONOR_ORDER)[number]);
}

/** Sort by 万、筒、索、字. Does not move a separated drawn tile. */
export function sortHand(tiles: readonly PhysicalTile[]): PhysicalTile[] {
  return [...tiles].sort((a, b) => {
    const byCode = tileSortKey(a.code) - tileSortKey(b.code);
    if (byCode !== 0) return byCode;
    return a.id.localeCompare(b.id);
  });
}

export function countTilesInPlay(parts: readonly (readonly PhysicalTile[])[]): number {
  return parts.reduce((sum, list) => sum + list.length, 0);
}

import type { PhysicalTile, TileCode } from './tiles';
import type { HandState, Seat, SeatState } from './types';

/** One concrete chow choice: the two concealed tiles that complete a sequence with the discard. */
export interface ChowOption {
  tileIds: [string, string];
  codes: [TileCode, TileCode];
}

export interface LegalClaims {
  canWin: boolean;
  canPung: boolean;
  chowOptions: ChowOption[];
}

function asSeat(n: number): Seat {
  if (n === 0 || n === 1 || n === 2 || n === 3) return n;
  throw new Error(`invalid seat ${n}`);
}

export function nextSeat(seat: Seat): Seat {
  return asSeat((seat + 1) % 4);
}

/** Seats from the discarder's next seat, walking around the table. */
export function seatsAfter(discarder: Seat): Seat[] {
  const out: Seat[] = [];
  let s = nextSeat(discarder);
  for (let i = 0; i < 3; i++) {
    out.push(s);
    s = nextSeat(s);
  }
  return out;
}

function isNumberedSuit(code: TileCode): boolean {
  const suit = code[0];
  return (suit === 'm' || suit === 'p' || suit === 's') && code.length === 2;
}

/** Whether `claimant` may chow `discarder`'s discard (must be the discarder's lower seat / 下家). */
export function canChowFrom(discarder: Seat, claimant: Seat): boolean {
  return claimant === nextSeat(discarder);
}

function handTilesMatching(hand: readonly PhysicalTile[], code: TileCode): PhysicalTile[] {
  return hand.filter((t) => t.code === code);
}

/**
 * List every concrete chow option for `hand` + discarded face.
 * Options are ordered by the two hand codes, then by tile id.
 */
export function listChowOptions(hand: readonly PhysicalTile[], discardCode: TileCode): ChowOption[] {
  if (!isNumberedSuit(discardCode)) return [];
  const suit = discardCode[0]!;
  const rank = Number(discardCode[1]);
  const patterns: Array<[number, number]> = [];
  if (rank >= 3) patterns.push([rank - 2, rank - 1]);
  if (rank >= 2 && rank <= 8) patterns.push([rank - 1, rank + 1]);
  if (rank <= 7) patterns.push([rank + 1, rank + 2]);

  const options: ChowOption[] = [];
  const seen = new Set<string>();

  for (const [r1, r2] of patterns) {
    const c1 = `${suit}${r1}` as TileCode;
    const c2 = `${suit}${r2}` as TileCode;
    const pool1 = handTilesMatching(hand, c1);
    const pool2 = handTilesMatching(hand, c2);
    if (pool1.length === 0 || pool2.length === 0) continue;

    const t1 = [...pool1].sort((a, b) => a.id.localeCompare(b.id))[0]!;
    const t2 = [...pool2].sort((a, b) => a.id.localeCompare(b.id))[0]!;
    const tileIds = [t1.id, t2.id].sort() as [string, string];
    const codes = tileSortCodes(c1, c2);
    const key = `${codes[0]}+${codes[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ tileIds, codes });
  }

  return options.sort((a, b) => {
    const byCode = `${a.codes[0]}${a.codes[1]}`.localeCompare(`${b.codes[0]}${b.codes[1]}`);
    if (byCode !== 0) return byCode;
    return `${a.tileIds[0]}${a.tileIds[1]}`.localeCompare(`${b.tileIds[0]}${b.tileIds[1]}`);
  });
}

function tileSortCodes(a: TileCode, b: TileCode): [TileCode, TileCode] {
  return a <= b ? [a, b] : [b, a];
}

export function canPungHand(hand: readonly PhysicalTile[], discardCode: TileCode): boolean {
  return handTilesMatching(hand, discardCode).length >= 2;
}

export function pungTileIds(hand: readonly PhysicalTile[], discardCode: TileCode): [string, string] | null {
  const matches = handTilesMatching(hand, discardCode);
  if (matches.length < 2) return null;
  const sorted = [...matches].sort((a, b) => a.id.localeCompare(b.id));
  return [sorted[0]!.id, sorted[1]!.id];
}

/** Legal claim summary for a seat against the open discard (caller supplies win check). */
export function legalClaimsForSeat(
  seatState: SeatState,
  discarder: Seat,
  seat: Seat,
  discardCode: TileCode,
  canWin: boolean,
): LegalClaims {
  const canPung = canPungHand(seatState.hand, discardCode);
  const chowOptions =
    canChowFrom(discarder, seat) && !seatState.drawn ? listChowOptions(seatState.hand, discardCode) : [];
  return { canWin, canPung, chowOptions };
}

export function hasAnyClaim(claims: LegalClaims): boolean {
  return claims.canWin || claims.canPung || claims.chowOptions.length > 0;
}

/** Nearest seat after `discarder` among `candidates` (table order). */
export function nearestAfter(discarder: Seat, candidates: readonly Seat[]): Seat | null {
  if (candidates.length === 0) return null;
  const order = seatsAfter(discarder);
  for (const s of order) {
    if (candidates.includes(s)) return s;
  }
  return null;
}

export function otherSeats(discarder: Seat): Seat[] {
  return ([0, 1, 2, 3] as Seat[]).filter((s) => s !== discarder);
}

/** Seats that still need to answer a mid-hand claim window. */
export function pendingClaimSeats(
  state: HandState,
  discarder: Seat,
  discardCode: TileCode,
  canWin: (seat: Seat) => boolean,
): Seat[] {
  return otherSeats(discarder).filter((seat) => {
    const claims = legalClaimsForSeat(state.seats[seat], discarder, seat, discardCode, canWin(seat));
    return hasAnyClaim(claims);
  });
}

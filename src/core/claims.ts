import type { PhysicalTile, TileCode } from './tiles';
import type { HandState, Seat, SeatState } from './types';

/** One concrete chow choice: the two concealed tiles that complete a sequence with the discard. */
export interface ChowOption {
  tileIds: [string, string];
  codes: [TileCode, TileCode];
}

export interface LegalClaims {
  canWin: boolean;
  canKong: boolean;
  canPung: boolean;
  chowOptions: ChowOption[];
}

export function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
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

/** Order winning seats from the discarder's next seat (一炮多响 domain order). */
export function orderWinnerSeats(discarder: Seat, winners: readonly Seat[]): Seat[] {
  if (winners.length <= 1) return [...winners];
  const order = seatsAfter(discarder);
  return order.filter((seat) => winners.includes(seat));
}

/**
 * Next dealer after a win settlement: single winner, or nearest winner after
 * the discarder when multiple seats won on the same discard.
 */
export function nextDealerAfterWin(winners: readonly Seat[], discarder: Seat): Seat {
  if (winners.length === 0) throw new Error('no winners for next dealer');
  if (winners.length === 1) return winners[0]!;
  const ordered = orderWinnerSeats(discarder, winners);
  return ordered[0] ?? winners[0]!;
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
    const codes = [c1, c2].sort((x, y) => x.localeCompare(y)) as [TileCode, TileCode];
    const key = `${codes[0]}+${codes[1]}`;
    /* v8 ignore next — pattern ranks are unique per discard face */
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ tileIds, codes });
  }

  // Deduped by face-code pair above, so sorting by codes alone is total.
  return options.sort((a, b) =>
    `${a.codes[0]}${a.codes[1]}`.localeCompare(`${b.codes[0]}${b.codes[1]}`),
  );
}

export function canPungHand(hand: readonly PhysicalTile[], discardCode: TileCode): boolean {
  return handTilesMatching(hand, discardCode).length >= 2;
}

export function canKongHand(hand: readonly PhysicalTile[], discardCode: TileCode): boolean {
  return handTilesMatching(hand, discardCode).length >= 3;
}

export function pungTileIds(hand: readonly PhysicalTile[], discardCode: TileCode): [string, string] | null {
  const matches = handTilesMatching(hand, discardCode);
  if (matches.length < 2) return null;
  const sorted = [...matches].sort((a, b) => a.id.localeCompare(b.id));
  return [sorted[0]!.id, sorted[1]!.id];
}

export function kongTileIds(
  hand: readonly PhysicalTile[],
  discardCode: TileCode,
): [string, string, string] | null {
  const matches = handTilesMatching(hand, discardCode);
  if (matches.length < 3) return null;
  const sorted = [...matches].sort((a, b) => a.id.localeCompare(b.id));
  return [sorted[0]!.id, sorted[1]!.id, sorted[2]!.id];
}

/** Legal claim summary for a seat against the open discard (caller supplies win check). */
export function legalClaimsForSeat(
  seatState: SeatState,
  discarder: Seat,
  seat: Seat,
  discardCode: TileCode,
  canWin: boolean,
  wallHasReplacement: boolean,
): LegalClaims {
  const canPung = canPungHand(seatState.hand, discardCode);
  const canKong = wallHasReplacement && canKongHand(seatState.hand, discardCode);
  const chowOptions =
    canChowFrom(discarder, seat) && !seatState.drawn ? listChowOptions(seatState.hand, discardCode) : [];
  return { canWin, canKong, canPung, chowOptions };
}

export function hasAnyClaim(claims: LegalClaims): boolean {
  return claims.canWin || claims.canKong || claims.canPung || claims.chowOptions.length > 0;
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
  const wallHasReplacement = state.wall.length > 0;
  return otherSeats(discarder).filter((seat) => {
    const claims = legalClaimsForSeat(
      state.seats[seat],
      discarder,
      seat,
      discardCode,
      canWin(seat),
      wallHasReplacement,
    );
    return hasAnyClaim(claims);
  });
}

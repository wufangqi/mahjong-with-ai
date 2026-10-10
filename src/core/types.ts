import type { PhysicalTile, TileCode } from './tiles';
import type { FanPatternId } from './winning';

/** Seat index: 0 = player (bottom), then counterclockwise 1→2→3. */
export type Seat = 0 | 1 | 2 | 3;

export type HandPhase =
  | 'awaiting_discard'
  | 'awaiting_win_response'
  | 'awaiting_claim_response'
  | 'exhaustive_draw'
  | 'hand_won';

export type MeldKind = 'chow' | 'pung' | 'exposed_kong' | 'concealed_kong' | 'added_kong';

/** Exposed meld formed by claiming a discard or declaring a kong. */
export interface Meld {
  kind: MeldKind;
  tiles: PhysicalTile[];
  /** Seat that discarded the claimed tile; null for concealed kong. */
  fromSeat: Seat | null;
  claimedTileId: string | null;
}

export interface SeatState {
  hand: PhysicalTile[];
  drawn: PhysicalTile | null;
  river: PhysicalTile[];
  melds: Meld[];
}

export type ResponseMode = 'win_only' | 'claims';

export type LockedResponse =
  | { kind: 'pass' }
  | { kind: 'win' }
  | { kind: 'kong' }
  | { kind: 'pung' }
  | { kind: 'chow'; tileIds: [string, string] };

/** Response window after a discard (final win-only, or mid-hand claims). */
export interface ResponseWindow {
  mode: ResponseMode;
  discarder: Seat;
  tile: PhysicalTile;
  pending: Seat[];
  /** Private until the window resolves — presentation must not reveal AI choices early. */
  locked: Partial<Record<Seat, LockedResponse>>;
  winners: Seat[];
}

export interface SeatDrawInfo {
  seat: Seat;
  hand: PhysicalTile[];
  ready: boolean;
  waitingTiles: TileCode[];
}

/** Exhaustive-draw settlement: reveal hands / 听牌; no fan or score. */
export interface ExhaustiveDrawSettlement {
  dealer: Seat;
  seats: [SeatDrawInfo, SeatDrawInfo, SeatDrawInfo, SeatDrawInfo];
  fanBySeat: Record<Seat, 0>;
}

/** One winner's domain facts inside HandWon / win settlement (no presentation). */
export interface WinnerResult {
  seat: Seat;
  patterns: FanPatternId[];
  fan: number;
  /** Completed concealed tiles including the winning tile (excludes exposed meld tiles). */
  hand: PhysicalTile[];
}

/** Win settlement shown after HandWon. */
export interface WinSettlement {
  winners: WinnerResult[];
  /** Discarder for discard wins; winning seat for self-draw. */
  discarder: Seat;
  tile: PhysicalTile;
  winKind: 'discard' | 'self_draw';
}

export type LastDrawKind = 'normal' | 'kong_replacement';

export interface HandState {
  schemaVersion: 1;
  ruleSetId: 'shuanghu-v1';
  seed: number;
  rngState: number;
  dealer: Seat;
  turn: Seat;
  phase: HandPhase;
  wall: PhysicalTile[];
  seats: [SeatState, SeatState, SeatState, SeatState];
  responseWindow: ResponseWindow | null;
  settlement: ExhaustiveDrawSettlement | null;
  winSettlement: WinSettlement | null;
  /** Kind of the current seat's drawn tile, if any. */
  lastDrawKind: LastDrawKind | null;
}

export type DomainEvent =
  | {
      type: 'HandDealt';
      dealer: Seat;
      wallRemaining: number;
      hands: Record<Seat, { hand: PhysicalTile[]; drawn: PhysicalTile | null }>;
    }
  | { type: 'TileDrawn'; seat: Seat; tile: PhysicalTile; kind: LastDrawKind }
  | { type: 'TileDiscarded'; seat: Seat; tile: PhysicalTile }
  | { type: 'WinResponseOpened'; discarder: Seat; tile: PhysicalTile }
  | { type: 'ClaimResponseOpened'; discarder: Seat; tile: PhysicalTile; pending: Seat[] }
  | {
      type: 'MeldFormed';
      seat: Seat;
      kind: MeldKind;
      tiles: PhysicalTile[];
      fromSeat: Seat | null;
      claimedTileId: string | null;
    }
  | {
      type: 'HandWon';
      winners: WinnerResult[];
      discarder: Seat;
      tile: PhysicalTile;
      winKind: 'discard' | 'self_draw';
    }
  | { type: 'ExhaustiveDraw'; settlement: ExhaustiveDrawSettlement };

export type Command =
  | { type: 'StartHand'; seed: number; dealer?: Seat }
  | { type: 'Discard'; seat: Seat; tileId: string }
  | { type: 'ClaimWin'; seat: Seat }
  | { type: 'ClaimKong'; seat: Seat }
  | { type: 'ClaimPung'; seat: Seat }
  | { type: 'ClaimChow'; seat: Seat; tileIds: [string, string] }
  | { type: 'DeclareConcealedKong'; seat: Seat; code: TileCode }
  | { type: 'DeclareAddedKong'; seat: Seat; code: TileCode }
  | { type: 'DeclareWin'; seat: Seat }
  | { type: 'Pass'; seat: Seat };

export interface CommandResult {
  state: HandState;
  events: DomainEvent[];
}

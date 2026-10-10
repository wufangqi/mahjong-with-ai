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

/** Exposed meld formed by claiming a discard (吃 / 碰). */
export interface Meld {
  kind: 'chow' | 'pung';
  tiles: PhysicalTile[];
  /** Seat that discarded the claimed tile. */
  fromSeat: Seat;
  claimedTileId: string;
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
  /** Completed 14-tile concealed hand including the winning tile. */
  hand: PhysicalTile[];
}

/** Win settlement shown after HandWon. */
export interface WinSettlement {
  winners: WinnerResult[];
  discarder: Seat;
  tile: PhysicalTile;
  winKind: 'discard';
}

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
}

export type DomainEvent =
  | {
      type: 'HandDealt';
      dealer: Seat;
      wallRemaining: number;
      hands: Record<Seat, { hand: PhysicalTile[]; drawn: PhysicalTile | null }>;
    }
  | { type: 'TileDrawn'; seat: Seat; tile: PhysicalTile }
  | { type: 'TileDiscarded'; seat: Seat; tile: PhysicalTile }
  | { type: 'WinResponseOpened'; discarder: Seat; tile: PhysicalTile }
  | { type: 'ClaimResponseOpened'; discarder: Seat; tile: PhysicalTile; pending: Seat[] }
  | {
      type: 'MeldFormed';
      seat: Seat;
      kind: 'chow' | 'pung';
      tiles: PhysicalTile[];
      fromSeat: Seat;
      claimedTileId: string;
    }
  | {
      type: 'HandWon';
      winners: WinnerResult[];
      discarder: Seat;
      tile: PhysicalTile;
      winKind: 'discard';
    }
  | { type: 'ExhaustiveDraw'; settlement: ExhaustiveDrawSettlement };

export type Command =
  | { type: 'StartHand'; seed: number; dealer?: Seat }
  | { type: 'Discard'; seat: Seat; tileId: string }
  | { type: 'ClaimWin'; seat: Seat }
  | { type: 'ClaimPung'; seat: Seat }
  | { type: 'ClaimChow'; seat: Seat; tileIds: [string, string] }
  | { type: 'Pass'; seat: Seat };

export interface CommandResult {
  state: HandState;
  events: DomainEvent[];
}

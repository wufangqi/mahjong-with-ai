import type { PhysicalTile, TileCode } from './tiles';

/** Seat index: 0 = player (bottom), then counterclockwise 1→2→3. */
export type Seat = 0 | 1 | 2 | 3;

export type HandPhase =
  | 'awaiting_discard'
  | 'awaiting_win_response'
  | 'exhaustive_draw'
  | 'hand_won';

export interface SeatState {
  hand: PhysicalTile[];
  drawn: PhysicalTile | null;
  river: PhysicalTile[];
}

/** Final-discard win/pass window (only after the last normal wall draw). */
export interface ResponseWindow {
  discarder: Seat;
  tile: PhysicalTile;
  pending: Seat[];
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
  | {
      type: 'HandWon';
      winners: Seat[];
      discarder: Seat;
      tile: PhysicalTile;
    }
  | { type: 'ExhaustiveDraw'; settlement: ExhaustiveDrawSettlement };

export type Command =
  | { type: 'StartHand'; seed: number; dealer?: Seat }
  | { type: 'Discard'; seat: Seat; tileId: string }
  | { type: 'ClaimWin'; seat: Seat }
  | { type: 'Pass'; seat: Seat };

export interface CommandResult {
  state: HandState;
  events: DomainEvent[];
}

import type { PhysicalTile } from './tiles';

/** Seat index: 0 = player (bottom), then counterclockwise 1→2→3. */
export type Seat = 0 | 1 | 2 | 3;

export type HandPhase = 'awaiting_discard' | 'discard_complete';

export interface SeatState {
  hand: PhysicalTile[];
  drawn: PhysicalTile | null;
  river: PhysicalTile[];
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
}

export type DomainEvent =
  | {
      type: 'HandDealt';
      dealer: Seat;
      wallRemaining: number;
      hands: Record<Seat, { hand: PhysicalTile[]; drawn: PhysicalTile | null }>;
    }
  | { type: 'TileDrawn'; seat: Seat; tile: PhysicalTile }
  | { type: 'TileDiscarded'; seat: Seat; tile: PhysicalTile };

export type Command =
  | { type: 'StartHand'; seed: number }
  | { type: 'Discard'; seat: Seat; tileId: string };

export interface CommandResult {
  state: HandState;
  events: DomainEvent[];
}

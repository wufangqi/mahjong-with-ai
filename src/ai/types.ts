import type { HandPhase, Meld, PhysicalTile, Seat, TileCode } from '../core';

/** Action a DecisionProvider may return; must match an entry from the legal list. */
export type DecisionAction =
  | { type: 'Discard'; tileId: string }
  | { type: 'DeclareWin' }
  | { type: 'DeclareConcealedKong'; code: TileCode }
  | { type: 'DeclareAddedKong'; code: TileCode }
  | { type: 'ClaimWin' }
  | { type: 'ClaimKong' }
  | { type: 'ClaimPung' }
  | { type: 'ClaimChow'; tileIds: [string, string] }
  | { type: 'Pass' };

/** Public information for one seat (no concealed tiles of others). */
export interface PublicSeatInfo {
  river: PhysicalTile[];
  melds: Meld[];
  /** Concealed tile count (hand + drawn), never tile identities for other seats. */
  concealedCount: number;
}

/**
 * Seat-visible game view for a DecisionProvider.
 * Omits wall order, other hands, seed, and rng state (ADR-0005).
 */
export interface SeatVisibleState {
  seat: Seat;
  dealer: Seat;
  turn: Seat;
  phase: HandPhase;
  wallRemaining: number;
  hand: PhysicalTile[];
  drawn: PhysicalTile | null;
  publicSeats: Record<Seat, PublicSeatInfo>;
  responseTile: PhysicalTile | null;
  discarder: Seat | null;
}

export interface DecisionChooseOptions {
  /** Shared deadline for parallel multi-seat claim windows. */
  signal?: AbortSignal;
}

export interface DecisionProvider {
  choose(
    view: SeatVisibleState,
    legalActions: readonly DecisionAction[],
    opts?: DecisionChooseOptions,
  ): Promise<DecisionAction>;
}

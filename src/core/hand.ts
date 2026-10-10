import { createRng, shuffleInPlace } from './rng';
import {
  countTilesInPlay,
  createFullSet,
  FULL_SET_SIZE,
  sortHand,
  type PhysicalTile,
} from './tiles';
import type { Command, CommandResult, DomainEvent, HandState, Seat, SeatState } from './types';

export const PLAYER_SEAT: Seat = 0;

function emptySeat(): SeatState {
  return { hand: [], drawn: null, river: [] };
}

function cloneSeat(seat: SeatState): SeatState {
  return {
    hand: [...seat.hand],
    drawn: seat.drawn,
    river: [...seat.river],
  };
}

function cloneState(state: HandState): HandState {
  return {
    ...state,
    wall: [...state.wall],
    seats: [
      cloneSeat(state.seats[0]),
      cloneSeat(state.seats[1]),
      cloneSeat(state.seats[2]),
      cloneSeat(state.seats[3]),
    ],
  };
}

function asSeat(n: number): Seat {
  if (n === 0 || n === 1 || n === 2 || n === 3) return n;
  throw new Error(`invalid seat ${n}`);
}

function nextSeat(seat: Seat): Seat {
  return asSeat((seat + 1) % 4);
}

function allRegions(state: HandState): PhysicalTile[][] {
  return [
    state.wall,
    ...state.seats.flatMap((s) => [s.hand, s.drawn ? [s.drawn] : [], s.river]),
  ];
}

/** Total physical tiles across wall, hands, drawn, and rivers. */
export function totalTileCount(state: HandState): number {
  return countTilesInPlay(allRegions(state));
}

function assertConservation(state: HandState): void {
  const total = totalTileCount(state);
  if (total !== FULL_SET_SIZE) {
    throw new Error(`tile conservation broken: ${total} !== ${FULL_SET_SIZE}`);
  }
}

function drawFromWall(state: HandState, seat: Seat): PhysicalTile {
  const tile = state.wall.shift();
  if (!tile) throw new Error('wall is empty');
  const seatState = state.seats[seat];
  if (seatState.drawn) throw new Error(`seat ${seat} already holds a drawn tile`);
  seatState.drawn = tile;
  return tile;
}

function visibleHand(seat: SeatState): PhysicalTile[] {
  return seat.drawn ? [...seat.hand, seat.drawn] : [...seat.hand];
}

function startHand(seed: number): CommandResult {
  const rng = createRng(seed);
  const wall = createFullSet();
  shuffleInPlace(wall, rng);
  const dealer = asSeat(rng.nextInt(4));

  const seats: HandState['seats'] = [emptySeat(), emptySeat(), emptySeat(), emptySeat()];

  // 13 tiles each, starting from dealer, then dealer draws the 14th.
  for (let round = 0; round < 13; round++) {
    let seat = dealer;
    for (let i = 0; i < 4; i++) {
      const tile = wall.shift();
      if (!tile) throw new Error('wall exhausted during deal');
      seats[seat].hand.push(tile);
      seat = nextSeat(seat);
    }
  }

  for (const seat of seats) {
    seat.hand = sortHand(seat.hand);
  }

  const state: HandState = {
    schemaVersion: 1,
    ruleSetId: 'shuanghu-v1',
    seed: seed >>> 0,
    rngState: rng.state,
    dealer,
    turn: dealer,
    phase: 'awaiting_discard',
    wall,
    seats,
  };

  const fourteenth = drawFromWall(state, dealer);
  // Keep drawn separated on the right; concealed hand stays sorted.
  void fourteenth;

  assertConservation(state);

  const events: DomainEvent[] = [
    {
      type: 'HandDealt',
      dealer,
      wallRemaining: state.wall.length,
      hands: {
        0: { hand: [...state.seats[0].hand], drawn: state.seats[0].drawn },
        1: { hand: [...state.seats[1].hand], drawn: state.seats[1].drawn },
        2: { hand: [...state.seats[2].hand], drawn: state.seats[2].drawn },
        3: { hand: [...state.seats[3].hand], drawn: state.seats[3].drawn },
      },
    },
    { type: 'TileDrawn', seat: dealer, tile: state.seats[dealer].drawn! },
  ];

  return { state, events };
}

function findTileInSeat(seat: SeatState, tileId: string): { where: 'hand' | 'drawn'; index: number } | null {
  if (seat.drawn?.id === tileId) return { where: 'drawn', index: -1 };
  const index = seat.hand.findIndex((t) => t.id === tileId);
  if (index >= 0) return { where: 'hand', index };
  return null;
}

function discard(state: HandState, seat: Seat, tileId: string): CommandResult {
  if (state.phase !== 'awaiting_discard') {
    throw new Error('discard is not allowed in the current phase');
  }
  if (state.turn !== seat) {
    throw new Error(`seat ${seat} cannot discard on seat ${state.turn}'s turn`);
  }

  const seatState = state.seats[seat];
  if (!seatState.drawn && seatState.hand.length !== 14) {
    // After deal, current player must hold drawn (14th) tile.
  }
  const held = visibleHand(seatState);
  if (held.length !== 14) {
    throw new Error(`seat ${seat} must hold 14 tiles to discard, has ${held.length}`);
  }

  const found = findTileInSeat(seatState, tileId);
  if (!found) throw new Error(`tile ${tileId} is not in seat ${seat}'s hand`);

  let discarded: PhysicalTile;
  if (found.where === 'drawn') {
    discarded = seatState.drawn!;
    seatState.drawn = null;
  } else {
    discarded = seatState.hand.splice(found.index, 1)[0]!;
    // Fold the previous drawn tile into the sorted hand.
    if (seatState.drawn) {
      seatState.hand.push(seatState.drawn);
      seatState.drawn = null;
      seatState.hand = sortHand(seatState.hand);
    }
  }

  seatState.river.push(discarded);
  seatState.hand = sortHand(seatState.hand);

  // WUF-51 slice: one confirmed discard completes the vertical cut.
  // Later tickets resume the full draw/response loop from here.
  state.phase = 'discard_complete';

  assertConservation(state);

  const events: DomainEvent[] = [{ type: 'TileDiscarded', seat, tile: discarded }];
  return { state, events };
}

/**
 * Pure rule-core command applicator.
 * Returns a new authoritative state plus domain events (ADR-0007).
 */
export function applyCommand(prev: HandState | null, command: Command): CommandResult {
  if (command.type === 'StartHand') {
    return startHand(command.seed);
  }

  if (!prev) throw new Error('StartHand is required before Discard');
  const state = cloneState(prev);
  return discard(state, command.seat, command.tileId);
}

/** Draw for the current turn seat when they hold 13 tiles (no drawn yet). */
export function ensureDrawn(prev: HandState): CommandResult {
  if (prev.phase !== 'awaiting_discard') {
    return { state: prev, events: [] };
  }
  const seat = prev.turn;
  const seatState = prev.seats[seat];
  if (seatState.drawn) return { state: prev, events: [] };
  if (seatState.hand.length !== 13) {
    throw new Error(`seat ${seat} unexpected hand size ${seatState.hand.length}`);
  }

  const state = cloneState(prev);
  const tile = drawFromWall(state, seat);
  assertConservation(state);
  return { state, events: [{ type: 'TileDrawn', seat, tile }] };
}

export function legalDiscardTileIds(state: HandState, seat: Seat): string[] {
  if (state.phase !== 'awaiting_discard' || state.turn !== seat) return [];
  const seatState = state.seats[seat];
  return visibleHand(seatState).map((t) => t.id);
}

export function displayHand(seat: SeatState): PhysicalTile[] {
  return seat.drawn ? [...seat.hand, seat.drawn] : [...seat.hand];
}

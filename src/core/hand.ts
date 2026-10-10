import { createRng, shuffleInPlace } from './rng';
import {
  countTilesInPlay,
  createFullSet,
  FULL_SET_SIZE,
  sortHand,
  type PhysicalTile,
  type TileCode,
} from './tiles';
import type {
  Command,
  CommandResult,
  DomainEvent,
  ExhaustiveDrawSettlement,
  HandState,
  Seat,
  SeatState,
} from './types';
import { isWinningCodes, waitingTileCodes } from './winning';

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
    responseWindow: state.responseWindow
      ? {
          ...state.responseWindow,
          pending: [...state.responseWindow.pending],
          winners: [...state.responseWindow.winners],
        }
      : null,
    settlement: state.settlement
      ? {
          ...state.settlement,
          seats: state.settlement.seats.map((s) => ({
            ...s,
            hand: [...s.hand],
            waitingTiles: [...s.waitingTiles],
          })) as ExhaustiveDrawSettlement['seats'],
          fanBySeat: { ...state.settlement.fanBySeat },
        }
      : null,
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

function otherSeats(discarder: Seat): Seat[] {
  return ([0, 1, 2, 3] as Seat[]).filter((s) => s !== discarder);
}

function handCodes(seat: SeatState): TileCode[] {
  return seat.hand.map((t) => t.code);
}

/** Whether `seat` can win on the given discarded face code (13 concealed + tile). */
export function canWinOnDiscard(state: HandState, seat: Seat, tileCode: TileCode): boolean {
  const seatState = state.seats[seat];
  if (seatState.drawn || seatState.hand.length !== 13) return false;
  return isWinningCodes([...handCodes(seatState), tileCode]);
}

export function buildExhaustiveDrawSettlement(state: HandState): ExhaustiveDrawSettlement {
  const seats = ([0, 1, 2, 3] as Seat[]).map((seat) => {
    const hand = sortHand([...state.seats[seat].hand]);
    const waiting = waitingTileCodes(hand.map((t) => t.code));
    return {
      seat,
      hand,
      ready: waiting.length > 0,
      waitingTiles: waiting,
    };
  }) as ExhaustiveDrawSettlement['seats'];

  return {
    dealer: state.dealer,
    seats,
    fanBySeat: { 0: 0, 1: 0, 2: 0, 3: 0 },
  };
}

function startHand(seed: number, forcedDealer?: Seat): CommandResult {
  const rng = createRng(seed);
  const wall = createFullSet();
  shuffleInPlace(wall, rng);
  const dealer = forcedDealer !== undefined ? forcedDealer : asSeat(rng.nextInt(4));

  const seats: HandState['seats'] = [emptySeat(), emptySeat(), emptySeat(), emptySeat()];

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
    responseWindow: null,
    settlement: null,
  };

  drawFromWall(state, dealer);
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
    if (seatState.drawn) {
      seatState.hand.push(seatState.drawn);
      seatState.drawn = null;
      seatState.hand = sortHand(seatState.hand);
    }
  }

  seatState.river.push(discarded);
  seatState.hand = sortHand(seatState.hand);

  const events: DomainEvent[] = [{ type: 'TileDiscarded', seat, tile: discarded }];

  if (state.wall.length === 0) {
    // Last normal draw was already taken; only win responses remain.
    state.phase = 'awaiting_win_response';
    state.responseWindow = {
      discarder: seat,
      tile: discarded,
      pending: otherSeats(seat),
      winners: [],
    };
    events.push({ type: 'WinResponseOpened', discarder: seat, tile: discarded });
  } else {
    state.phase = 'awaiting_discard';
    state.turn = nextSeat(seat);
  }

  assertConservation(state);
  return { state, events };
}

function finishResponseWindow(state: HandState): DomainEvent[] {
  const window = state.responseWindow;
  if (!window) throw new Error('no response window');
  if (window.pending.length > 0) return [];

  if (window.winners.length > 0) {
    state.phase = 'hand_won';
    state.settlement = null;
    const event: DomainEvent = {
      type: 'HandWon',
      winners: [...window.winners],
      discarder: window.discarder,
      tile: window.tile,
    };
    state.responseWindow = null;
    return [event];
  }

  const settlement = buildExhaustiveDrawSettlement(state);
  state.phase = 'exhaustive_draw';
  state.settlement = settlement;
  state.responseWindow = null;
  return [{ type: 'ExhaustiveDraw', settlement }];
}

function claimWin(state: HandState, seat: Seat): CommandResult {
  if (state.phase !== 'awaiting_win_response' || !state.responseWindow) {
    throw new Error('win claim is not allowed in the current phase');
  }
  const window = state.responseWindow;
  if (!window.pending.includes(seat)) {
    throw new Error(`seat ${seat} has no pending win response`);
  }
  if (!canWinOnDiscard(state, seat, window.tile.code)) {
    throw new Error(`seat ${seat} cannot win on ${window.tile.code}`);
  }

  window.pending = window.pending.filter((s) => s !== seat);
  window.winners.push(seat);
  const events = finishResponseWindow(state);
  assertConservation(state);
  return { state, events };
}

function pass(state: HandState, seat: Seat): CommandResult {
  if (state.phase !== 'awaiting_win_response' || !state.responseWindow) {
    throw new Error('pass is not allowed in the current phase');
  }
  const window = state.responseWindow;
  if (!window.pending.includes(seat)) {
    throw new Error(`seat ${seat} has no pending win response`);
  }

  window.pending = window.pending.filter((s) => s !== seat);
  const events = finishResponseWindow(state);
  assertConservation(state);
  return { state, events };
}

/**
 * Pure rule-core command applicator.
 * Returns a new authoritative state plus domain events (ADR-0007).
 */
export function applyCommand(prev: HandState | null, command: Command): CommandResult {
  if (command.type === 'StartHand') {
    return startHand(command.seed, command.dealer);
  }

  if (!prev) throw new Error('StartHand is required before other commands');
  const state = cloneState(prev);

  switch (command.type) {
    case 'Discard':
      return discard(state, command.seat, command.tileId);
    case 'ClaimWin':
      return claimWin(state, command.seat);
    case 'Pass':
      return pass(state, command.seat);
    default: {
      const _exhaustive: never = command;
      throw new Error(`unknown command ${JSON.stringify(_exhaustive)}`);
    }
  }
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
  if (prev.wall.length === 0) {
    throw new Error('cannot draw: wall is empty');
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

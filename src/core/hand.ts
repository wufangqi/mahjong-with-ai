import {
  hasAnyClaim,
  legalClaimsForSeat,
  listChowOptions,
  nearestAfter,
  nextSeat,
  otherSeats,
  pendingClaimSeats,
  pungTileIds,
} from './claims';
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
  LockedResponse,
  Meld,
  Seat,
  SeatState,
  WinnerResult,
  WinSettlement,
} from './types';
import { evaluateWin, isWinningHand, waitingTileCodes } from './winning';

export const PLAYER_SEAT: Seat = 0;

function emptySeat(): SeatState {
  return { hand: [], drawn: null, river: [], melds: [] };
}

function cloneMeld(meld: Meld): Meld {
  return {
    ...meld,
    tiles: [...meld.tiles],
  };
}

function cloneSeat(seat: SeatState): SeatState {
  return {
    hand: [...seat.hand],
    drawn: seat.drawn,
    river: [...seat.river],
    melds: seat.melds.map(cloneMeld),
  };
}

function cloneWinner(w: WinnerResult): WinnerResult {
  return { ...w, patterns: [...w.patterns], hand: [...w.hand] };
}

function cloneWinSettlement(s: WinSettlement): WinSettlement {
  return {
    ...s,
    winners: s.winners.map(cloneWinner),
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
          locked: { ...state.responseWindow.locked },
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
    winSettlement: state.winSettlement ? cloneWinSettlement(state.winSettlement) : null,
  };
}

function asSeat(n: number): Seat {
  if (n === 0 || n === 1 || n === 2 || n === 3) return n;
  throw new Error(`invalid seat ${n}`);
}

function allRegions(state: HandState): PhysicalTile[][] {
  return [
    state.wall,
    ...state.seats.flatMap((s) => [
      s.hand,
      s.drawn ? [s.drawn] : [],
      s.river,
      ...s.melds.map((m) => m.tiles),
    ]),
  ];
}

/** Total physical tiles across wall, hands, drawn, rivers, and melds. */
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

function expectedConcealedBeforeDiscard(seat: SeatState): number {
  // 14 with a draw, or 11 / 8 / 5 after a successful chow/pung (must discard).
  return 14 - seat.melds.length * 3;
}

function handCodes(seat: SeatState): TileCode[] {
  return seat.hand.map((t) => t.code);
}

/** Whether `seat` can win on the given discarded face code. */
export function canWinOnDiscard(state: HandState, seat: Seat, tileCode: TileCode): boolean {
  const seatState = state.seats[seat];
  if (seatState.drawn) return false;
  const exposed = seatState.melds.length;
  const expected = 13 - exposed * 3;
  if (seatState.hand.length !== expected) return false;
  return isWinningHand([...handCodes(seatState), tileCode], exposed);
}

function buildWinnerResult(state: HandState, seat: Seat, winningTile: PhysicalTile): WinnerResult {
  const seatState = state.seats[seat];
  const hand = sortHand([...seatState.hand, winningTile]);
  const evaluation = evaluateWin(
    hand.map((t) => t.code),
    seatState.melds.length,
  );
  if (evaluation.patterns.length === 0) {
    throw new Error(`seat ${seat} claimed win without a matching pattern`);
  }
  return {
    seat,
    patterns: evaluation.patterns,
    fan: evaluation.fan,
    hand,
  };
}

function emitHandWon(
  state: HandState,
  winnerSeats: readonly Seat[],
  discarder: Seat,
  tile: PhysicalTile,
): DomainEvent {
  const winners = winnerSeats.map((seat) => buildWinnerResult(state, seat, tile));
  const winSettlement: WinSettlement = {
    winners,
    discarder,
    tile,
    winKind: 'discard',
  };
  state.phase = 'hand_won';
  state.settlement = null;
  state.winSettlement = winSettlement;
  state.responseWindow = null;
  return {
    type: 'HandWon',
    winners,
    discarder,
    tile,
    winKind: 'discard',
  };
}

export function buildExhaustiveDrawSettlement(state: HandState): ExhaustiveDrawSettlement {
  const seats = ([0, 1, 2, 3] as Seat[]).map((seat) => {
    const seatState = state.seats[seat];
    const hand = sortHand([...seatState.hand]);
    const waiting = waitingTileCodes(
      hand.map((t) => t.code),
      seatState.melds.length,
    );
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
    winSettlement: null,
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

function removeHandTiles(seat: SeatState, tileIds: readonly string[]): PhysicalTile[] {
  const removed: PhysicalTile[] = [];
  for (const id of tileIds) {
    const index = seat.hand.findIndex((t) => t.id === id);
    if (index < 0) throw new Error(`tile ${id} is not in hand`);
    removed.push(seat.hand.splice(index, 1)[0]!);
  }
  seat.hand = sortHand(seat.hand);
  return removed;
}

function takeDiscardFromRiver(state: HandState, discarder: Seat, tileId: string): PhysicalTile {
  const river = state.seats[discarder].river;
  const index = river.findIndex((t) => t.id === tileId);
  if (index < 0) throw new Error(`discard ${tileId} is not in seat ${discarder}'s river`);
  return river.splice(index, 1)[0]!;
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
  const expected = expectedConcealedBeforeDiscard(seatState);
  if (held.length !== expected) {
    throw new Error(`seat ${seat} must hold ${expected} tiles to discard, has ${held.length}`);
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
      mode: 'win_only',
      discarder: seat,
      tile: discarded,
      pending: otherSeats(seat),
      locked: {},
      winners: [],
    };
    events.push({ type: 'WinResponseOpened', discarder: seat, tile: discarded });
  } else {
    const pending = pendingClaimSeats(state, seat, discarded.code, (s) =>
      canWinOnDiscard(state, s, discarded.code),
    );
    if (pending.length === 0) {
      state.phase = 'awaiting_discard';
      state.turn = nextSeat(seat);
    } else {
      state.phase = 'awaiting_claim_response';
      state.responseWindow = {
        mode: 'claims',
        discarder: seat,
        tile: discarded,
        pending: [...pending],
        locked: {},
        winners: [],
      };
      events.push({
        type: 'ClaimResponseOpened',
        discarder: seat,
        tile: discarded,
        pending: [...pending],
      });
    }
  }

  assertConservation(state);
  return { state, events };
}

function finishWinOnlyWindow(state: HandState): DomainEvent[] {
  const window = state.responseWindow;
  if (!window) throw new Error('no response window');
  if (window.pending.length > 0) return [];

  if (window.winners.length > 0) {
    return [emitHandWon(state, window.winners, window.discarder, window.tile)];
  }

  // All passed: final discard → 流局; otherwise only this opportunity is spent.
  if (state.wall.length === 0) {
    const settlement = buildExhaustiveDrawSettlement(state);
    state.phase = 'exhaustive_draw';
    state.settlement = settlement;
    state.winSettlement = null;
    state.responseWindow = null;
    return [{ type: 'ExhaustiveDraw', settlement }];
  }

  state.phase = 'awaiting_discard';
  state.turn = nextSeat(window.discarder);
  state.responseWindow = null;
  state.winSettlement = null;
  return [];
}

function applyMeld(
  state: HandState,
  seat: Seat,
  kind: 'chow' | 'pung',
  handTileIds: [string, string],
): DomainEvent {
  const window = state.responseWindow;
  if (!window) throw new Error('no response window');
  const claimed = takeDiscardFromRiver(state, window.discarder, window.tile.id);
  const fromHand = removeHandTiles(state.seats[seat], handTileIds);
  const tiles = sortHand([...fromHand, claimed]);
  const meld: Meld = {
    kind,
    tiles,
    fromSeat: window.discarder,
    claimedTileId: claimed.id,
  };
  state.seats[seat].melds.push(meld);
  state.turn = seat;
  state.phase = 'awaiting_discard';
  state.responseWindow = null;
  return {
    type: 'MeldFormed',
    seat,
    kind,
    tiles: [...tiles],
    fromSeat: window.discarder,
    claimedTileId: claimed.id,
  };
}

function resolveClaimsWindow(state: HandState): DomainEvent[] {
  const window = state.responseWindow;
  if (!window || window.mode !== 'claims') throw new Error('no claims window');
  if (window.pending.length > 0) return [];

  const winners = ([0, 1, 2, 3] as Seat[]).filter((s) => window.locked[s]?.kind === 'win');
  if (winners.length > 0) {
    return [emitHandWon(state, winners, window.discarder, window.tile)];
  }

  const pungSeats = ([0, 1, 2, 3] as Seat[]).filter((s) => window.locked[s]?.kind === 'pung');
  const pungWinner = nearestAfter(window.discarder, pungSeats);
  if (pungWinner !== null) {
    const ids = pungTileIds(state.seats[pungWinner].hand, window.tile.code);
    if (!ids) throw new Error(`seat ${pungWinner} locked pung but lacks tiles`);
    return [applyMeld(state, pungWinner, 'pung', ids)];
  }

  const chowSeats = ([0, 1, 2, 3] as Seat[]).filter((s) => window.locked[s]?.kind === 'chow');
  const chowWinner = nearestAfter(window.discarder, chowSeats);
  if (chowWinner !== null) {
    const locked = window.locked[chowWinner];
    if (!locked || locked.kind !== 'chow') throw new Error('missing chow lock');
    return [applyMeld(state, chowWinner, 'chow', locked.tileIds)];
  }

  // Everyone passed — resume with the discarder's next seat drawing.
  state.phase = 'awaiting_discard';
  state.turn = nextSeat(window.discarder);
  state.responseWindow = null;
  return [];
}

function lockResponse(state: HandState, seat: Seat, response: LockedResponse): DomainEvent[] {
  const window = state.responseWindow;
  if (!window) throw new Error('no response window');
  if (!window.pending.includes(seat)) {
    throw new Error(`seat ${seat} has no pending response`);
  }
  if (window.locked[seat]) {
    throw new Error(`seat ${seat} already responded`);
  }

  window.locked[seat] = response;
  window.pending = window.pending.filter((s) => s !== seat);

  if (window.mode === 'win_only') {
    if (response.kind === 'win') window.winners.push(seat);
    return finishWinOnlyWindow(state);
  }

  return resolveClaimsWindow(state);
}

function claimWin(state: HandState, seat: Seat): CommandResult {
  const window = state.responseWindow;
  if (
    !window ||
    (state.phase !== 'awaiting_win_response' && state.phase !== 'awaiting_claim_response')
  ) {
    throw new Error('win claim is not allowed in the current phase');
  }
  if (!window.pending.includes(seat)) {
    throw new Error(`seat ${seat} has no pending win response`);
  }
  if (!canWinOnDiscard(state, seat, window.tile.code)) {
    throw new Error(`seat ${seat} cannot win on ${window.tile.code}`);
  }

  const events = lockResponse(state, seat, { kind: 'win' });
  assertConservation(state);
  return { state, events };
}

function claimPung(state: HandState, seat: Seat): CommandResult {
  if (state.phase !== 'awaiting_claim_response' || !state.responseWindow) {
    throw new Error('pung claim is not allowed in the current phase');
  }
  const window = state.responseWindow;
  if (window.mode !== 'claims') throw new Error('pung is not allowed in a win-only window');
  if (!window.pending.includes(seat)) {
    throw new Error(`seat ${seat} has no pending claim response`);
  }
  if (!pungTileIds(state.seats[seat].hand, window.tile.code)) {
    throw new Error(`seat ${seat} cannot pung ${window.tile.code}`);
  }

  const events = lockResponse(state, seat, { kind: 'pung' });
  assertConservation(state);
  return { state, events };
}

function claimChow(state: HandState, seat: Seat, tileIds: [string, string]): CommandResult {
  if (state.phase !== 'awaiting_claim_response' || !state.responseWindow) {
    throw new Error('chow claim is not allowed in the current phase');
  }
  const window = state.responseWindow;
  if (window.mode !== 'claims') throw new Error('chow is not allowed in a win-only window');
  if (!window.pending.includes(seat)) {
    throw new Error(`seat ${seat} has no pending claim response`);
  }
  if (seat !== nextSeat(window.discarder)) {
    throw new Error(`seat ${seat} cannot chow from seat ${window.discarder}`);
  }

  const options = listChowOptions(state.seats[seat].hand, window.tile.code);
  const sortedIds = [...tileIds].sort() as [string, string];
  const match = options.find(
    (opt) =>
      [...opt.tileIds].sort().join(',') === sortedIds.join(','),
  );
  if (!match) {
    throw new Error(`seat ${seat} cannot chow with ${tileIds.join(',')}`);
  }

  const events = lockResponse(state, seat, { kind: 'chow', tileIds: sortedIds });
  assertConservation(state);
  return { state, events };
}

function pass(state: HandState, seat: Seat): CommandResult {
  if (
    (state.phase !== 'awaiting_win_response' && state.phase !== 'awaiting_claim_response') ||
    !state.responseWindow
  ) {
    throw new Error('pass is not allowed in the current phase');
  }
  const window = state.responseWindow;
  if (!window.pending.includes(seat)) {
    throw new Error(`seat ${seat} has no pending response`);
  }

  const events = lockResponse(state, seat, { kind: 'pass' });
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
    case 'ClaimPung':
      return claimPung(state, command.seat);
    case 'ClaimChow':
      return claimChow(state, command.seat, command.tileIds);
    case 'Pass':
      return pass(state, command.seat);
    default: {
      const _exhaustive: never = command;
      throw new Error(`unknown command ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** Draw for the current turn seat when they hold the pre-draw concealed count. */
export function ensureDrawn(prev: HandState): CommandResult {
  if (prev.phase !== 'awaiting_discard') {
    return { state: prev, events: [] };
  }
  const seat = prev.turn;
  const seatState = prev.seats[seat];
  if (seatState.drawn) return { state: prev, events: [] };

  const expectedAfterMeldDiscard = 13 - seatState.melds.length * 3;
  // After chow/pung the seat holds one extra tile and must discard without drawing.
  if (seatState.hand.length === expectedAfterMeldDiscard + 1) {
    return { state: prev, events: [] };
  }
  if (seatState.hand.length !== expectedAfterMeldDiscard) {
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

export function legalClaims(state: HandState, seat: Seat) {
  const window = state.responseWindow;
  if (!window || state.phase !== 'awaiting_claim_response') {
    return { canWin: false, canPung: false, chowOptions: [] as ReturnType<typeof listChowOptions> };
  }
  return legalClaimsForSeat(
    state.seats[seat],
    window.discarder,
    seat,
    window.tile.code,
    canWinOnDiscard(state, seat, window.tile.code),
  );
}

export function seatHasClaimOptions(state: HandState, seat: Seat): boolean {
  return hasAnyClaim(legalClaims(state, seat));
}

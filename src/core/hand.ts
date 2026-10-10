import {
  hasAnyClaim,
  kongTileIds,
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

function drawFromWallHead(state: HandState, seat: Seat): PhysicalTile {
  const tile = state.wall.shift();
  if (!tile) throw new Error('wall is empty');
  const seatState = state.seats[seat];
  if (seatState.drawn) throw new Error(`seat ${seat} already holds a drawn tile`);
  seatState.drawn = tile;
  state.lastDrawKind = 'normal';
  return tile;
}

function drawReplacementFromTail(state: HandState, seat: Seat): PhysicalTile {
  const tile = state.wall.pop();
  if (!tile) throw new Error('no kong replacement available');
  const seatState = state.seats[seat];
  if (seatState.drawn) throw new Error(`seat ${seat} already holds a drawn tile`);
  seatState.drawn = tile;
  state.lastDrawKind = 'kong_replacement';
  return tile;
}

function visibleHand(seat: SeatState): PhysicalTile[] {
  return seat.drawn ? [...seat.hand, seat.drawn] : [...seat.hand];
}

function expectedConcealedBeforeDiscard(seat: SeatState): number {
  // Kong replacement restores the 4th tile, so meld count × 3 still holds.
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

/** Whether the current seat can declare a self-draw win on their drawn tile. */
export function canWinOnDraw(state: HandState, seat: Seat): boolean {
  if (state.phase !== 'awaiting_discard' || state.turn !== seat) return false;
  const seatState = state.seats[seat];
  if (!seatState.drawn) return false;
  const exposed = seatState.melds.length;
  const expected = 13 - exposed * 3;
  if (seatState.hand.length !== expected) return false;
  return isWinningHand([...handCodes(seatState), seatState.drawn.code], exposed);
}

function buildWinnerResult(
  state: HandState,
  seat: Seat,
  winningTile: PhysicalTile,
  gangShangKaiHua: boolean,
): WinnerResult {
  const seatState = state.seats[seat];
  const hand = sortHand([...seatState.hand, winningTile]);
  const evaluation = evaluateWin(hand.map((t) => t.code), seatState.melds.length, {
    gangShangKaiHua,
    melds: seatState.melds.map((meld) => ({
      kind: meld.kind,
      codes: meld.tiles.map((tile) => tile.code),
    })),
  });
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
  winKind: 'discard' | 'self_draw',
  gangShangKaiHua: boolean,
): DomainEvent {
  const winners = winnerSeats.map((seat) =>
    buildWinnerResult(state, seat, tile, gangShangKaiHua && seat === discarder),
  );
  const winSettlement: WinSettlement = {
    winners,
    discarder,
    tile,
    winKind,
  };
  state.phase = 'hand_won';
  state.settlement = null;
  state.winSettlement = winSettlement;
  state.responseWindow = null;
  state.lastDrawKind = null;
  return {
    type: 'HandWon',
    winners,
    discarder,
    tile,
    winKind,
  };
}

export function buildExhaustiveDrawSettlement(state: HandState): ExhaustiveDrawSettlement {
  const seats = ([0, 1, 2, 3] as Seat[]).map((seat) => {
    const seatState = state.seats[seat];
    const hand = sortHand([...seatState.hand]);
    const waiting = waitingTileCodes(hand.map((t) => t.code), seatState.melds.length);
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
    lastDrawKind: null,
  };

  const drawn = drawFromWallHead(state, dealer);
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
    { type: 'TileDrawn', seat: dealer, tile: drawn, kind: 'normal' },
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

/** Remove matching tiles from hand and/or drawn (for concealed / added kong). */
function removeVisibleMatching(
  seat: SeatState,
  code: TileCode,
  count: number,
): PhysicalTile[] {
  const removed: PhysicalTile[] = [];
  if (seat.drawn?.code === code) {
    removed.push(seat.drawn);
    seat.drawn = null;
  }
  while (removed.length < count) {
    const index = seat.hand.findIndex((t) => t.code === code);
    if (index < 0) throw new Error(`not enough ${code} to remove`);
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
  state.lastDrawKind = null;

  const events: DomainEvent[] = [{ type: 'TileDiscarded', seat, tile: discarded }];

  if (state.wall.length === 0) {
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
    return [emitHandWon(state, window.winners, window.discarder, window.tile, 'discard', false)];
  }

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

function applyChowOrPung(
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
  state.lastDrawKind = null;
  return {
    type: 'MeldFormed',
    seat,
    kind,
    tiles: [...tiles],
    fromSeat: window.discarder,
    claimedTileId: claimed.id,
  };
}

function applyExposedKong(state: HandState, seat: Seat): DomainEvent[] {
  const window = state.responseWindow;
  if (!window) throw new Error('no response window');
  if (state.wall.length === 0) throw new Error('no kong replacement available');

  const ids = kongTileIds(state.seats[seat].hand, window.tile.code);
  if (!ids) throw new Error(`seat ${seat} locked kong but lacks tiles`);

  const claimed = takeDiscardFromRiver(state, window.discarder, window.tile.id);
  const fromHand = removeHandTiles(state.seats[seat], ids);
  const tiles = sortHand([...fromHand, claimed]);
  const meld: Meld = {
    kind: 'exposed_kong',
    tiles,
    fromSeat: window.discarder,
    claimedTileId: claimed.id,
  };
  state.seats[seat].melds.push(meld);
  state.turn = seat;
  state.phase = 'awaiting_discard';
  state.responseWindow = null;

  const replacement = drawReplacementFromTail(state, seat);
  return [
    {
      type: 'MeldFormed',
      seat,
      kind: 'exposed_kong',
      tiles: [...tiles],
      fromSeat: window.discarder,
      claimedTileId: claimed.id,
    },
    { type: 'TileDrawn', seat, tile: replacement, kind: 'kong_replacement' },
  ];
}

function resolveClaimsWindow(state: HandState): DomainEvent[] {
  const window = state.responseWindow;
  if (!window || window.mode !== 'claims') throw new Error('no claims window');
  if (window.pending.length > 0) return [];

  const winners = ([0, 1, 2, 3] as Seat[]).filter((s) => window.locked[s]?.kind === 'win');
  if (winners.length > 0) {
    return [emitHandWon(state, winners, window.discarder, window.tile, 'discard', false)];
  }

  const kongSeats = ([0, 1, 2, 3] as Seat[]).filter((s) => window.locked[s]?.kind === 'kong');
  const kongWinner = nearestAfter(window.discarder, kongSeats);
  if (kongWinner !== null) {
    return applyExposedKong(state, kongWinner);
  }

  const pungSeats = ([0, 1, 2, 3] as Seat[]).filter((s) => window.locked[s]?.kind === 'pung');
  const pungWinner = nearestAfter(window.discarder, pungSeats);
  if (pungWinner !== null) {
    const ids = pungTileIds(state.seats[pungWinner].hand, window.tile.code);
    if (!ids) throw new Error(`seat ${pungWinner} locked pung but lacks tiles`);
    return [applyChowOrPung(state, pungWinner, 'pung', ids)];
  }

  const chowSeats = ([0, 1, 2, 3] as Seat[]).filter((s) => window.locked[s]?.kind === 'chow');
  const chowWinner = nearestAfter(window.discarder, chowSeats);
  if (chowWinner !== null) {
    const locked = window.locked[chowWinner];
    if (!locked || locked.kind !== 'chow') throw new Error('missing chow lock');
    return [applyChowOrPung(state, chowWinner, 'chow', locked.tileIds)];
  }

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

function claimKong(state: HandState, seat: Seat): CommandResult {
  if (state.phase !== 'awaiting_claim_response' || !state.responseWindow) {
    throw new Error('kong claim is not allowed in the current phase');
  }
  const window = state.responseWindow;
  if (window.mode !== 'claims') throw new Error('kong is not allowed in a win-only window');
  if (!window.pending.includes(seat)) {
    throw new Error(`seat ${seat} has no pending claim response`);
  }
  if (state.wall.length === 0) {
    throw new Error('kong is unavailable without a replacement tile');
  }
  if (!kongTileIds(state.seats[seat].hand, window.tile.code)) {
    throw new Error(`seat ${seat} cannot kong ${window.tile.code}`);
  }

  const events = lockResponse(state, seat, { kind: 'kong' });
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
    (opt) => [...opt.tileIds].sort().join(',') === sortedIds.join(','),
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

function countCodeInVisible(seat: SeatState, code: TileCode): number {
  let n = seat.hand.filter((t) => t.code === code).length;
  if (seat.drawn?.code === code) n += 1;
  return n;
}

export interface LegalSelfActions {
  concealedKongCodes: TileCode[];
  addedKongCodes: TileCode[];
  canWin: boolean;
}

/** Self-turn actions available after drawing and before discarding. */
export function legalSelfActions(state: HandState, seat: Seat): LegalSelfActions {
  if (state.phase !== 'awaiting_discard' || state.turn !== seat) {
    return { concealedKongCodes: [], addedKongCodes: [], canWin: false };
  }
  const seatState = state.seats[seat];
  if (!seatState.drawn) {
    return { concealedKongCodes: [], addedKongCodes: [], canWin: false };
  }

  const wallHasReplacement = state.wall.length > 0;
  const concealedKongCodes: TileCode[] = [];
  const addedKongCodes: TileCode[] = [];

  if (wallHasReplacement) {
    const seen = new Set<TileCode>();
    for (const t of visibleHand(seatState)) {
      if (seen.has(t.code)) continue;
      seen.add(t.code);
      if (countCodeInVisible(seatState, t.code) >= 4) {
        concealedKongCodes.push(t.code);
      }
    }
    concealedKongCodes.sort();

    for (const meld of seatState.melds) {
      if (meld.kind !== 'pung') continue;
      const code = meld.tiles[0]!.code;
      if (countCodeInVisible(seatState, code) >= 1) {
        addedKongCodes.push(code);
      }
    }
    addedKongCodes.sort();
  }

  return {
    concealedKongCodes,
    addedKongCodes,
    canWin: canWinOnDraw(state, seat),
  };
}

function declareConcealedKong(state: HandState, seat: Seat, code: TileCode): CommandResult {
  if (state.phase !== 'awaiting_discard' || state.turn !== seat) {
    throw new Error('concealed kong is not allowed in the current phase');
  }
  const seatState = state.seats[seat];
  if (!seatState.drawn) {
    throw new Error('concealed kong requires a drawn tile');
  }
  if (state.wall.length === 0) {
    throw new Error('kong is unavailable without a replacement tile');
  }
  if (countCodeInVisible(seatState, code) < 4) {
    throw new Error(`seat ${seat} cannot declare concealed kong of ${code}`);
  }

  const tiles = sortHand(removeVisibleMatching(seatState, code, 4));
  const meld: Meld = {
    kind: 'concealed_kong',
    tiles,
    fromSeat: null,
    claimedTileId: null,
  };
  seatState.melds.push(meld);
  // If the drawn tile was not part of the kong, fold it into the hand before replacement.
  if (seatState.drawn) {
    seatState.hand = sortHand([...seatState.hand, seatState.drawn]);
    seatState.drawn = null;
  }

  const replacement = drawReplacementFromTail(state, seat);
  assertConservation(state);
  return {
    state,
    events: [
      {
        type: 'MeldFormed',
        seat,
        kind: 'concealed_kong',
        tiles: [...tiles],
        fromSeat: null,
        claimedTileId: null,
      },
      { type: 'TileDrawn', seat, tile: replacement, kind: 'kong_replacement' },
    ],
  };
}

function declareAddedKong(state: HandState, seat: Seat, code: TileCode): CommandResult {
  if (state.phase !== 'awaiting_discard' || state.turn !== seat) {
    throw new Error('added kong is not allowed in the current phase');
  }
  const seatState = state.seats[seat];
  if (!seatState.drawn) {
    throw new Error('added kong requires a drawn tile');
  }
  if (state.wall.length === 0) {
    throw new Error('kong is unavailable without a replacement tile');
  }

  const pungIndex = seatState.melds.findIndex(
    (m) => m.kind === 'pung' && m.tiles[0]?.code === code,
  );
  if (pungIndex < 0) {
    throw new Error(`seat ${seat} has no pung of ${code} to upgrade`);
  }
  if (countCodeInVisible(seatState, code) < 1) {
    throw new Error(`seat ${seat} lacks ${code} for added kong`);
  }

  const [extra] = removeVisibleMatching(seatState, code, 1);
  const pung = seatState.melds[pungIndex]!;
  const tiles = sortHand([...pung.tiles, extra!]);
  seatState.melds[pungIndex] = {
    kind: 'added_kong',
    tiles,
    fromSeat: pung.fromSeat,
    claimedTileId: pung.claimedTileId,
  };
  if (seatState.drawn) {
    seatState.hand = sortHand([...seatState.hand, seatState.drawn]);
    seatState.drawn = null;
  }

  // 加杠不可被抢杠胡 — no response window.
  const replacement = drawReplacementFromTail(state, seat);
  assertConservation(state);
  return {
    state,
    events: [
      {
        type: 'MeldFormed',
        seat,
        kind: 'added_kong',
        tiles: [...tiles],
        fromSeat: pung.fromSeat,
        claimedTileId: pung.claimedTileId,
      },
      { type: 'TileDrawn', seat, tile: replacement, kind: 'kong_replacement' },
    ],
  };
}

function declareWin(state: HandState, seat: Seat): CommandResult {
  if (!canWinOnDraw(state, seat)) {
    throw new Error(`seat ${seat} cannot declare a self-draw win`);
  }
  const seatState = state.seats[seat];
  const winningTile = seatState.drawn!;
  const gangShangKaiHua = state.lastDrawKind === 'kong_replacement';
  // Fold drawn into the hand snapshot via buildWinnerResult; clear drawn after.
  const event = emitHandWon(state, [seat], seat, winningTile, 'self_draw', gangShangKaiHua);
  seatState.hand = sortHand([...seatState.hand, winningTile]);
  seatState.drawn = null;
  assertConservation(state);
  return { state, events: [event] };
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
    case 'ClaimKong':
      return claimKong(state, command.seat);
    case 'ClaimPung':
      return claimPung(state, command.seat);
    case 'ClaimChow':
      return claimChow(state, command.seat, command.tileIds);
    case 'DeclareConcealedKong':
      return declareConcealedKong(state, command.seat, command.code);
    case 'DeclareAddedKong':
      return declareAddedKong(state, command.seat, command.code);
    case 'DeclareWin':
      return declareWin(state, command.seat);
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
  // After kong, replacement is already drawn as part of the kong command.
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
  const tile = drawFromWallHead(state, seat);
  assertConservation(state);
  return { state, events: [{ type: 'TileDrawn', seat, tile, kind: 'normal' }] };
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
    return {
      canWin: false,
      canKong: false,
      canPung: false,
      chowOptions: [] as ReturnType<typeof listChowOptions>,
    };
  }
  return legalClaimsForSeat(
    state.seats[seat],
    window.discarder,
    seat,
    window.tile.code,
    canWinOnDiscard(state, seat, window.tile.code),
    state.wall.length > 0,
  );
}

export function seatHasClaimOptions(state: HandState, seat: Seat): boolean {
  return hasAnyClaim(legalClaims(state, seat));
}

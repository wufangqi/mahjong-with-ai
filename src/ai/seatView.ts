import {
  canWinOnDiscard,
  legalClaims,
  legalDiscardTileIds,
  legalSelfActions,
  type HandState,
  type Seat,
} from '../core';
import type { DecisionAction, SeatVisibleState } from './types';

/** Build the seat-visible view: own hand + public table facts only. */
export function buildSeatView(state: HandState, seat: Seat): SeatVisibleState {
  const publicSeats = {
    0: publicInfo(state, 0),
    1: publicInfo(state, 1),
    2: publicInfo(state, 2),
    3: publicInfo(state, 3),
  } as SeatVisibleState['publicSeats'];

  return {
    seat,
    dealer: state.dealer,
    turn: state.turn,
    phase: state.phase,
    wallRemaining: state.wall.length,
    hand: state.seats[seat].hand.map((t) => ({ ...t })),
    drawn: state.seats[seat].drawn ? { ...state.seats[seat].drawn! } : null,
    publicSeats,
    responseTile: state.responseWindow ? { ...state.responseWindow.tile } : null,
    discarder: state.responseWindow?.discarder ?? null,
  };
}

function publicInfo(state: HandState, seat: Seat): SeatVisibleState['publicSeats'][Seat] {
  const s = state.seats[seat];
  return {
    river: s.river.map((t) => ({ ...t })),
    melds: s.melds.map((m) => ({
      ...m,
      tiles: m.tiles.map((t) => ({ ...t })),
    })),
    concealedCount: s.hand.length + (s.drawn ? 1 : 0),
  };
}

/** Legal actions for `seat` in the current phase (computed by the rule core). */
export function listLegalActions(state: HandState, seat: Seat): DecisionAction[] {
  if (state.phase === 'awaiting_discard' && state.turn === seat) {
    const self = legalSelfActions(state, seat);
    const actions: DecisionAction[] = [];
    if (self.canWin) actions.push({ type: 'DeclareWin' });
    for (const code of self.concealedKongCodes) {
      actions.push({ type: 'DeclareConcealedKong', code });
    }
    for (const code of self.addedKongCodes) {
      actions.push({ type: 'DeclareAddedKong', code });
    }
    for (const tileId of legalDiscardTileIds(state, seat)) {
      actions.push({ type: 'Discard', tileId });
    }
    return actions;
  }

  if (
    (state.phase === 'awaiting_win_response' || state.phase === 'awaiting_claim_response') &&
    state.responseWindow?.pending.includes(seat)
  ) {
    const actions: DecisionAction[] = [{ type: 'Pass' }];
    const tileCode = state.responseWindow.tile.code;
    if (canWinOnDiscard(state, seat, tileCode)) {
      actions.unshift({ type: 'ClaimWin' });
    }
    if (state.phase === 'awaiting_claim_response') {
      const claims = legalClaims(state, seat);
      if (claims.canKong) actions.push({ type: 'ClaimKong' });
      if (claims.canPung) actions.push({ type: 'ClaimPung' });
      for (const option of claims.chowOptions) {
        actions.push({ type: 'ClaimChow', tileIds: option.tileIds });
      }
    }
    return actions;
  }

  return [];
}

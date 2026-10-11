import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  canWinOnDiscard,
  createFullSet,
  type HandState,
  type PhysicalTile,
  type Seat,
  type TileCode,
} from '../core';
import { createEasyDecisionProvider } from './easy';
import { buildSeatView, listLegalActions } from './seatView';

function take(pool: PhysicalTile[], code: TileCode): PhysicalTile {
  const i = pool.findIndex((t) => t.code === code);
  if (i < 0) throw new Error(`missing ${code}`);
  return pool.splice(i, 1)[0]!;
}

/** Seat 1 can 胡 on seat 0's discard of m1. */
function winResponseState(): HandState {
  const pool = createFullSet();
  const winning = take(pool, 'm1');
  const seat1Hand = (
    ['m2', 'm3', 'm4', 'm5', 'm6', 'p2', 'p2', 'p2', 's7', 's8', 's9', 'E', 'E'] as TileCode[]
  ).map((code) => take(pool, code));

  const seats: HandState['seats'] = [
    { hand: pool.splice(0, 13), drawn: null, river: [winning], melds: [] },
    { hand: seat1Hand, drawn: null, river: [], melds: [] },
    { hand: pool.splice(0, 13), drawn: null, river: [], melds: [] },
    { hand: pool.splice(0, 13), drawn: null, river: [], melds: [] },
  ];

  return {
    schemaVersion: 1,
    ruleSetId: 'shuanghu-v1',
    seed: 5801,
    rngState: 1,
    dealer: 0,
    turn: 0,
    phase: 'awaiting_claim_response',
    wall: pool,
    seats,
    responseWindow: {
      mode: 'claims',
      discarder: 0,
      tile: winning,
      pending: [1, 2, 3],
      locked: {},
      winners: [],
    },
    settlement: null,
    winSettlement: null,
    lastDrawKind: null,
  };
}

describe('easy DecisionProvider', () => {
  it('always claims win when win is legal', () => {
    const state = winResponseState();
    expect(canWinOnDiscard(state, 1, 'm1')).toBe(true);
    const easy = createEasyDecisionProvider();
    const view = buildSeatView(state, 1);
    const legal = listLegalActions(state, 1);
    const choice = easy.choose(view, legal);
    expect(choice).toEqual({ type: 'ClaimWin' });
  });

  it('always picks a legal action and prefers discard of drawn tile', () => {
    const { state } = applyCommand(null, { type: 'StartHand', seed: 11, dealer: 2 as Seat });
    const drawn = state.seats[2].drawn;
    expect(drawn).not.toBeNull();
    const easy = createEasyDecisionProvider();
    const view = buildSeatView(state, 2);
    const legal = listLegalActions(state, 2);
    const choice = easy.choose(view, legal);
    expect(legal).toContainEqual(choice);
    expect(choice).toEqual({ type: 'Discard', tileId: drawn!.id });
  });

  it('never returns an action outside the legal list', () => {
    const { state } = applyCommand(null, { type: 'StartHand', seed: 99 });
    const easy = createEasyDecisionProvider();
    for (const seat of [1, 2, 3] as Seat[]) {
      if (state.turn !== seat || state.phase !== 'awaiting_discard') continue;
      const legal = listLegalActions(state, seat);
      const choice = easy.choose(buildSeatView(state, seat), legal);
      expect(legal).toContainEqual(choice);
    }
  });
});

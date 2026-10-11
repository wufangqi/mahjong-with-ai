import { describe, expect, it } from 'vitest';
import { applyCommand, PLAYER_SEAT } from '../core';
import { buildSeatView, listLegalActions } from './seatView';

describe('seatView', () => {
  it('exposes only own hand, public rivers/melds, dealer, turn, and wall count', () => {
    const { state } = applyCommand(null, { type: 'StartHand', seed: 42, dealer: PLAYER_SEAT });
    const view = buildSeatView(state, 1);

    expect(view.seat).toBe(1);
    expect(view.dealer).toBe(PLAYER_SEAT);
    expect(view.turn).toBe(PLAYER_SEAT);
    expect(view.wallRemaining).toBe(state.wall.length);
    expect(view.hand.map((t) => t.id)).toEqual(state.seats[1].hand.map((t) => t.id));
    expect(view.drawn).toBeNull();

    for (const seat of [0, 1, 2, 3] as const) {
      expect(view.publicSeats[seat].river).toEqual(state.seats[seat].river);
      expect(view.publicSeats[seat].melds).toEqual(state.seats[seat].melds);
      expect(view.publicSeats[seat].concealedCount).toBe(
        state.seats[seat].hand.length + (state.seats[seat].drawn ? 1 : 0),
      );
    }

    const serialized = JSON.stringify(view);
    expect(serialized).not.toMatch(/"wall"/);
    expect(serialized).not.toMatch(/"rngState"/);
    expect(serialized).not.toMatch(/"seed"/);
    for (const other of [0, 2, 3] as const) {
      for (const tile of state.seats[other].hand) {
        expect(serialized).not.toContain(tile.id);
      }
    }
  });

  it('lists only legal actions for the seat on discard turn', () => {
    const { state } = applyCommand(null, { type: 'StartHand', seed: 7, dealer: 1 });
    const actions = listLegalActions(state, 1);
    expect(actions.some((a) => a.type === 'Discard')).toBe(true);
    expect(actions.every((a) => a.type === 'Discard' || a.type === 'DeclareWin' || a.type.startsWith('Declare'))).toBe(
      true,
    );
  });
});

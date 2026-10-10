import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  displayHand,
  ensureDrawn,
  legalDiscardTileIds,
  PLAYER_SEAT,
  totalTileCount,
} from './hand';
import { createRng, shuffleInPlace } from './rng';
import { createFullSet, FULL_SET_SIZE, sortHand, tileSortKey } from './tiles';
import type { HandState, Seat } from './types';

const SEED = 42;

function start(seed = SEED): HandState {
  return applyCommand(null, { type: 'StartHand', seed }).state;
}

describe('tile set and sorting', () => {
  it('builds exactly 136 distinct physical tiles', () => {
    const set = createFullSet();
    expect(set).toHaveLength(FULL_SET_SIZE);
    expect(new Set(set.map((t) => t.id)).size).toBe(FULL_SET_SIZE);
  });

  it('sorts hands 万→筒→索→字 with drawn kept separate by callers', () => {
    const unsorted = [
      { id: 'E#0', code: 'E' as const },
      { id: 's2#0', code: 's2' as const },
      { id: 'm9#0', code: 'm9' as const },
      { id: 'p1#0', code: 'p1' as const },
      { id: 'C#0', code: 'C' as const },
    ];
    expect(sortHand(unsorted).map((t) => t.code)).toEqual(['m9', 'p1', 's2', 'E', 'C']);
    expect(tileSortKey('m1')).toBeLessThan(tileSortKey('p1'));
  });
});

describe('seeded deal', () => {
  it('same seed yields identical dealer, wall, and deal', () => {
    const a = start(SEED);
    const b = start(SEED);
    expect(a.dealer).toBe(b.dealer);
    expect(a.wall.map((t) => t.id)).toEqual(b.wall.map((t) => t.id));
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      expect(a.seats[seat].hand.map((t) => t.id)).toEqual(b.seats[seat].hand.map((t) => t.id));
      expect(a.seats[seat].drawn?.id).toBe(b.seats[seat].drawn?.id);
    }
  });

  it('different seeds diverge', () => {
    const a = start(1);
    const b = start(2);
    expect(
      a.dealer !== b.dealer ||
        a.wall[0]?.id !== b.wall[0]?.id ||
        a.seats[0].hand[0]?.id !== b.seats[0].hand[0]?.id,
    ).toBe(true);
  });

  it('dealer starts with 14 (drawn separated) and others with 13; dealer discards first', () => {
    const state = start(SEED);
    expect(state.turn).toBe(state.dealer);
    expect(state.phase).toBe('awaiting_discard');

    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const s = state.seats[seat];
      const total = s.hand.length + (s.drawn ? 1 : 0);
      if (seat === state.dealer) {
        expect(total).toBe(14);
        expect(s.drawn).not.toBeNull();
        expect(s.hand).toHaveLength(13);
      } else {
        expect(total).toBe(13);
        expect(s.drawn).toBeNull();
        expect(s.hand).toHaveLength(13);
      }
      expect(s.hand).toEqual(sortHand(s.hand));
    }
  });

  it('keeps entity count at 136 after deal', () => {
    expect(totalTileCount(start(SEED))).toBe(FULL_SET_SIZE);
  });
});

describe('draw placement and discard', () => {
  it('places the drawn tile at the far right of the display hand', () => {
    const state = start(SEED);
    const dealer = state.seats[state.dealer];
    const shown = displayHand(dealer);
    expect(shown).toHaveLength(14);
    expect(shown[13]).toEqual(dealer.drawn);
    expect(shown.slice(0, 13)).toEqual(sortHand(shown.slice(0, 13)));
  });

  it('discards irreversibly, advances turn while wall remains, and preserves 136 tiles', () => {
    const before = start(SEED);
    const seat = before.dealer;
    const tileId = before.seats[seat].drawn!.id;
    const { state, events } = applyCommand(before, { type: 'Discard', seat, tileId });

    expect(events).toEqual([{ type: 'TileDiscarded', seat, tile: expect.objectContaining({ id: tileId }) }]);
    expect(state.phase).toBe('awaiting_discard');
    expect(state.turn).toBe(((seat + 1) % 4) as Seat);
    expect(state.seats[seat].river.map((t) => t.id)).toEqual([tileId]);
    expect(state.seats[seat].drawn).toBeNull();
    expect(state.seats[seat].hand).toHaveLength(13);
    expect(totalTileCount(state)).toBe(FULL_SET_SIZE);

    expect(() => applyCommand(state, { type: 'Discard', seat, tileId })).toThrow(/cannot discard/);
  });

  it('allows discarding a sorted hand tile and folds the previous draw back in', () => {
    const before = start(SEED);
    const seat = before.dealer;
    const fromHand = before.seats[seat].hand[0]!;
    const drawnId = before.seats[seat].drawn!.id;
    const { state } = applyCommand(before, { type: 'Discard', seat, tileId: fromHand.id });

    expect(state.seats[seat].river[0]?.id).toBe(fromHand.id);
    expect(state.seats[seat].hand.map((t) => t.id)).toContain(drawnId);
    expect(state.seats[seat].hand).toEqual(sortHand(state.seats[seat].hand));
    expect(totalTileCount(state)).toBe(FULL_SET_SIZE);
  });

  it('draws for a non-dealer turn so the new tile sits on the right', () => {
    const state = start(SEED);
    const dealer = state.dealer;
    const { state: afterDiscard } = applyCommand(state, {
      type: 'Discard',
      seat: dealer,
      tileId: state.seats[dealer].drawn!.id,
    });

    const { state: drawnState, events } = ensureDrawn(afterDiscard);
    const seat = drawnState.turn;
    expect(events[0]?.type).toBe('TileDrawn');
    expect(displayHand(drawnState.seats[seat]).at(-1)).toEqual(drawnState.seats[seat].drawn);
    expect(totalTileCount(drawnState)).toBe(FULL_SET_SIZE);
  });
});

describe('legal discard surface', () => {
  it('lists every tile the current seat may discard', () => {
    const state = start(SEED);
    const ids = legalDiscardTileIds(state, state.dealer);
    expect(ids).toHaveLength(14);
    expect(legalDiscardTileIds(state, PLAYER_SEAT === state.dealer ? ((state.dealer + 1) % 4) as Seat : PLAYER_SEAT)).toEqual(
      [],
    );
  });
});

describe('gameplay rng', () => {
  it('is deterministic and does not use Math.random', () => {
    const a = createRng(7);
    const b = createRng(7);
    const seqA = Array.from({ length: 8 }, () => a.nextInt(100));
    const seqB = Array.from({ length: 8 }, () => b.nextInt(100));
    expect(seqA).toEqual(seqB);

    const items = [1, 2, 3, 4, 5];
    const copy = [...items];
    shuffleInPlace(items, createRng(9));
    shuffleInPlace(copy, createRng(9));
    expect(items).toEqual(copy);
  });
});

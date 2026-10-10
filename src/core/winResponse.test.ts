import { describe, expect, it } from 'vitest';
import { applyCommand, ensureDrawn, legalDiscardTileIds, PLAYER_SEAT, totalTileCount } from './hand';
import { createFullSet, FULL_SET_SIZE, type PhysicalTile, type TileCode } from './tiles';
import type { HandState, Seat } from './types';

function takeFromPool(pool: PhysicalTile[], code: TileCode): PhysicalTile {
  const index = pool.findIndex((t) => t.code === code);
  if (index < 0) throw new Error(`missing ${code} in pool`);
  return pool.splice(index, 1)[0]!;
}

/** Build a mid-hand state where seat 1 is ready on m1 and seat 0 is about to discard it. */
function pinghuResponseState(): HandState {
  const pool = createFullSet();
  const winning = takeFromPool(pool, 'm1');
  const seat1Hand = (
    ['m2', 'm3', 'm4', 'm5', 'm6', 'p2', 'p2', 'p2', 's7', 's8', 's9', 'E', 'E'] as TileCode[]
  ).map((code) => takeFromPool(pool, code));

  const seats: HandState['seats'] = [
    { hand: pool.splice(0, 13), drawn: null, river: [] },
    { hand: seat1Hand, drawn: null, river: [] },
    { hand: pool.splice(0, 13), drawn: null, river: [] },
    { hand: pool.splice(0, 13), drawn: null, river: [] },
  ];
  // Seat 0 holds the winning discard as the drawn tile (14th).
  seats[0].drawn = winning;

  return {
    schemaVersion: 1,
    ruleSetId: 'shuanghu-v1',
    seed: 1,
    rngState: 1,
    dealer: 0,
    turn: 0,
    phase: 'awaiting_discard',
    wall: pool,
    seats,
    responseWindow: null,
    settlement: null,
    winSettlement: null,
  };
}

describe('mid-hand win response for 平胡', () => {
  it('opens a win/pass window when a discard completes a 平胡 hand', () => {
    const before = pinghuResponseState();
    const wallBefore = before.wall.length;
    expect(wallBefore).toBeGreaterThan(0);

    const { state, events } = applyCommand(before, {
      type: 'Discard',
      seat: PLAYER_SEAT,
      tileId: before.seats[0].drawn!.id,
    });

    expect(state.phase).toBe('awaiting_win_response');
    expect(events.some((e) => e.type === 'WinResponseOpened')).toBe(true);
    expect(state.responseWindow?.tile.code).toBe('m1');
    expect(state.responseWindow?.pending).toContain(1 as Seat);
    expect(totalTileCount(state)).toBe(FULL_SET_SIZE);
  });

  it('emits HandWon domain facts without presentation fields when 平胡 is claimed', () => {
    const before = pinghuResponseState();
    let state = applyCommand(before, {
      type: 'Discard',
      seat: PLAYER_SEAT,
      tileId: before.seats[0].drawn!.id,
    }).state;

    const events = [];
    const claimed = applyCommand(state, { type: 'ClaimWin', seat: 1 });
    state = claimed.state;
    events.push(...claimed.events);
    for (const seat of [...(state.responseWindow?.pending ?? [])]) {
      const passed = applyCommand(state, { type: 'Pass', seat });
      state = passed.state;
      events.push(...passed.events);
    }

    const won = events.find((e) => e.type === 'HandWon');
    expect(won).toBeDefined();
    if (!won || won.type !== 'HandWon') throw new Error('expected HandWon');

    expect(won.winners).toEqual([
      expect.objectContaining({
        seat: 1,
        patterns: ['pinghu'],
        fan: 1,
      }),
    ]);
    expect(won.winners[0]!.hand).toHaveLength(14);
    expect(won).not.toHaveProperty('tier');
    expect(won).not.toHaveProperty('themeId');
    expect(won).not.toHaveProperty('bannerStyle');
    expect(JSON.stringify(won)).not.toMatch(/basic|big|top|theme|banner/i);

    expect(state.phase).toBe('hand_won');
    expect(state.winSettlement).toEqual(
      expect.objectContaining({
        winners: [expect.objectContaining({ seat: 1, patterns: ['pinghu'], fan: 1 })],
        discarder: 0,
      }),
    );
  });

  it('lets pass abandon only the current opportunity and continues the hand', () => {
    const before = pinghuResponseState();
    const opened = applyCommand(before, {
      type: 'Discard',
      seat: PLAYER_SEAT,
      tileId: before.seats[0].drawn!.id,
    }).state;

    let state = opened;
    for (const seat of [...opened.responseWindow!.pending]) {
      ({ state } = applyCommand(state, { type: 'Pass', seat }));
    }

    expect(state.phase).toBe('awaiting_discard');
    expect(state.turn).toBe(1);
    expect(state.responseWindow).toBeNull();
    expect(state.settlement).toBeNull();
    expect(state.winSettlement).toBeNull();

    const drawn = ensureDrawn(state);
    expect(drawn.events[0]?.type).toBe('TileDrawn');
    expect(legalDiscardTileIds(drawn.state, 1).length).toBe(14);
  });
});

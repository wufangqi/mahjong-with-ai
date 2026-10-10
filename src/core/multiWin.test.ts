import { describe, expect, it } from 'vitest';
import { seatsAfter } from './claims';
import { applyCommand, legalClaims, totalTileCount } from './hand';
import { createFullSet, FULL_SET_SIZE, sortHand, type PhysicalTile, type TileCode } from './tiles';
import type { HandState, Seat } from './types';

function tile(code: TileCode, copy: number): PhysicalTile {
  return { id: `${code}#${copy}`, code };
}

/** Mid-hand: discarder about to discard `discardCode`; other seats hold exact 13 codes. */
function openClaimWindow(opts: {
  discarder: Seat;
  discardCode: TileCode;
  hands: Record<Seat, TileCode[]>;
}): HandState {
  const used = new Map<TileCode, number>();
  const take = (code: TileCode): PhysicalTile => {
    const n = used.get(code) ?? 0;
    if (n >= 4) throw new Error(`overused ${code}`);
    used.set(code, n + 1);
    return tile(code, n);
  };

  const seats: HandState['seats'] = [
    { hand: [], drawn: null, river: [], melds: [] },
    { hand: [], drawn: null, river: [], melds: [] },
    { hand: [], drawn: null, river: [], melds: [] },
    { hand: [], drawn: null, river: [], melds: [] },
  ];

  for (const seat of [0, 1, 2, 3] as Seat[]) {
    const codes = opts.hands[seat];
    if (codes.length !== 13) throw new Error(`seat ${seat} needs 13 codes, got ${codes.length}`);
    seats[seat].hand = sortHand(codes.map(take));
  }

  const discarded = take(opts.discardCode);
  seats[opts.discarder].drawn = discarded;

  const remaining = createFullSet().filter((t) => {
    const max = used.get(t.code) ?? 0;
    const copy = Number(t.id.split('#')[1]);
    return copy >= max;
  });

  const state: HandState = {
    schemaVersion: 1,
    ruleSetId: 'shuanghu-v1',
    seed: 57,
    rngState: 1,
    dealer: opts.discarder,
    turn: opts.discarder,
    phase: 'awaiting_discard',
    wall: remaining,
    seats,
    responseWindow: null,
    settlement: null,
    winSettlement: null,
    lastDrawKind: 'normal',
  };

  expect(totalTileCount(state)).toBe(FULL_SET_SIZE);
  return applyCommand(state, {
    type: 'Discard',
    seat: opts.discarder,
    tileId: discarded.id,
  }).state;
}

/** Resolve every pending claim with the given responses (default pass). */
function resolveAll(
  state: HandState,
  responses: Partial<Record<Seat, 'win' | 'pung' | 'kong' | 'pass'>>,
): { state: HandState; events: ReturnType<typeof applyCommand>['events'] } {
  let next = state;
  const events: ReturnType<typeof applyCommand>['events'] = [];
  while (next.phase === 'awaiting_claim_response' && next.responseWindow?.pending[0] !== undefined) {
    const seat = next.responseWindow.pending[0]!;
    const choice = responses[seat] ?? 'pass';
    const result =
      choice === 'win'
        ? applyCommand(next, { type: 'ClaimWin', seat })
        : choice === 'pung'
          ? applyCommand(next, { type: 'ClaimPung', seat })
          : choice === 'kong'
            ? applyCommand(next, { type: 'ClaimKong', seat })
            : applyCommand(next, { type: 'Pass', seat });
    next = result.state;
    events.push(...result.events);
  }
  return { state: next, events };
}

/**
 * Non-overlapping ready hands on m1 (within the 4-copy tile budget).
 * A: 平胡 chow-wait; B: 平胡 pair-wait; Q: 七对; fillers avoid claim faces.
 */
const PINGHU_A: TileCode[] = [
  'm2',
  'm3',
  'm4',
  'm5',
  'm6',
  'p2',
  'p2',
  'p2',
  's1',
  's2',
  's3',
  'E',
  'E',
];
const PINGHU_B: TileCode[] = [
  'm1',
  'p4',
  'p5',
  'p6',
  'p7',
  'p8',
  'p9',
  's4',
  's5',
  's6',
  's7',
  's8',
  's9',
];
const QIDUI_M1: TileCode[] = [
  'm1',
  'm2',
  'm2',
  'm3',
  'm3',
  'm4',
  'm4',
  'm5',
  'm5',
  'm6',
  'm6',
  'm7',
  'm7',
];
/** Discarder filler using honor pairs + one leftover man (no claim on m1). */
const FILL_HONORS: TileCode[] = [
  'W',
  'W',
  'N',
  'N',
  'C',
  'C',
  'F',
  'F',
  'P',
  'P',
  'S',
  'S',
  'm7',
];
/** Non-claimer filler that avoids PINGHU_A / PINGHU_B faces. */
const FILL_SIDE: TileCode[] = [
  'm8',
  'm8',
  'm9',
  'm9',
  'p1',
  'p1',
  'p3',
  'p3',
  's9',
  's9',
  'm7',
  'm7',
  'p2',
];

describe('一炮多响 atomic multi-win', () => {
  it('lets win outrank pung and settles every win claimer in one HandWon', () => {
    // Discarder 0 plays m1. Seat 1 can 平胡; seat 2 can pung (two m1) but not win.
    const opened = openClaimWindow({
      discarder: 0,
      discardCode: 'm1',
      hands: {
        0: FILL_HONORS,
        1: PINGHU_A,
        2: ['m1', 'm1', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 's4', 's5', 's6', 's7', 's8'],
        3: ['m7', 'm8', 'm9', 'm7', 'm8', 'm9', 'p1', 'p1', 'p3', 'p3', 's9', 'W', 'N'],
      },
    });

    expect(legalClaims(opened, 1).canWin).toBe(true);
    expect(legalClaims(opened, 2).canPung).toBe(true);
    expect(legalClaims(opened, 2).canWin).toBe(false);

    // Claim pung first, then win — win must still prevail after the window closes.
    const { state, events } = resolveAll(opened, { 1: 'win', 2: 'pung' });

    expect(state.phase).toBe('hand_won');
    expect(state.seats[2].melds).toHaveLength(0);
    const won = events.filter((e) => e.type === 'HandWon');
    expect(won).toHaveLength(1);
    if (won[0]?.type !== 'HandWon') throw new Error('expected HandWon');
    expect(won[0].winners.map((w) => w.seat)).toEqual([1]);
    expect(state.winSettlement?.winners).toHaveLength(1);
  });

  it('emits one atomic HandWon with all winners and does not stop after the first claim', () => {
    const opened = openClaimWindow({
      discarder: 0,
      discardCode: 'm1',
      hands: {
        0: FILL_HONORS,
        1: PINGHU_A,
        2: PINGHU_B,
        3: FILL_SIDE,
      },
    });

    expect(legalClaims(opened, 1).canWin).toBe(true);
    expect(legalClaims(opened, 2).canWin).toBe(true);

    // First win claim alone must not settle the hand.
    const afterFirst = applyCommand(opened, { type: 'ClaimWin', seat: 1 });
    expect(afterFirst.state.phase).toBe('awaiting_claim_response');
    expect(afterFirst.events.some((e) => e.type === 'HandWon')).toBe(false);
    expect(afterFirst.state.winSettlement).toBeNull();

    const { state, events } = resolveAll(afterFirst.state, { 2: 'win' });
    expect(state.phase).toBe('hand_won');
    const won = events.find((e) => e.type === 'HandWon');
    expect(won).toBeDefined();
    if (!won || won.type !== 'HandWon') throw new Error('expected HandWon');
    expect(won.winners.map((w) => w.seat)).toEqual([1, 2]);
    expect(state.winSettlement?.winners.map((w) => w.seat)).toEqual([1, 2]);
    expect(totalTileCount(state)).toBe(FULL_SET_SIZE);
  });

  it('scores each winner independently (平胡 vs 七对) in seat order after the discarder', () => {
    // Discarder 3 → seats after: 0, 1, 2. Seat 0 七对, seat 2 平胡; seat 1 passes.
    // QIDUI uses m2–m7; PINGHU_B avoids those numbered mans except the wait tile.
    const opened = openClaimWindow({
      discarder: 3,
      discardCode: 'm1',
      hands: {
        0: QIDUI_M1,
        1: FILL_HONORS,
        2: PINGHU_B,
        3: ['p1', 'p1', 'p2', 'p2', 'p3', 'p3', 's1', 's2', 's3', 's4', 's5', 's6', 'm8'],
      },
    });

    expect(legalClaims(opened, 0).canWin).toBe(true);
    expect(legalClaims(opened, 2).canWin).toBe(true);

    const { state, events } = resolveAll(opened, { 0: 'win', 2: 'win' });
    const won = events.find((e) => e.type === 'HandWon');
    expect(won).toBeDefined();
    if (!won || won.type !== 'HandWon') throw new Error('expected HandWon');

    expect(won.winners.map((w) => w.seat)).toEqual(seatsAfter(3).filter((s) => s === 0 || s === 2));
    // 七对 all-man also stacks 清一色; 平胡 stays independent at 1 fan.
    expect(won.winners).toEqual([
      expect.objectContaining({ seat: 0, patterns: ['qidui', 'qingyise'], fan: 2 }),
      expect.objectContaining({ seat: 2, patterns: ['pinghu'], fan: 1 }),
    ]);
    expect(state.winSettlement?.discarder).toBe(3);
    expect(JSON.stringify(won)).not.toMatch(/basic|big|top|theme|banner/i);
  });

  it('supports three simultaneous winners on one discard', () => {
    // Discarder 1; winners 0=平胡A, 2=平胡B, 3=七对 → domain order seatsAfter(1)=[2,3,0].
    const opened = openClaimWindow({
      discarder: 1,
      discardCode: 'm1',
      hands: {
        0: PINGHU_A,
        1: FILL_HONORS,
        2: PINGHU_B,
        3: [
          'm1',
          'm7',
          'm7',
          'm8',
          'm8',
          'm9',
          'm9',
          'p1',
          'p1',
          'p3',
          'p3',
          's9',
          's9',
        ],
      },
    });

    expect(legalClaims(opened, 0).canWin).toBe(true);
    expect(legalClaims(opened, 2).canWin).toBe(true);
    expect(legalClaims(opened, 3).canWin).toBe(true);

    const { state, events } = resolveAll(opened, { 0: 'win', 2: 'win', 3: 'win' });
    const won = events.find((e) => e.type === 'HandWon');
    expect(won).toBeDefined();
    if (!won || won.type !== 'HandWon') throw new Error('expected HandWon');
    expect(won.winners.map((w) => w.seat)).toEqual([2, 3, 0]);
    expect(state.winSettlement?.winners).toHaveLength(3);
    expect(won.winners.find((w) => w.seat === 3)?.patterns).toEqual(['qidui']);
  });
});

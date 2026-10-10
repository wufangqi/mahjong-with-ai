import { describe, expect, it } from 'vitest';
import { listChowOptions, nearestAfter, nextDealerAfterWin, nextSeat, orderWinnerSeats } from './claims';
import { applyCommand, canWinOnDiscard, ensureDrawn, legalClaims, totalTileCount } from './hand';
import { createFullSet, FULL_SET_SIZE, sortHand, type PhysicalTile, type TileCode } from './tiles';
import type { HandState, Seat } from './types';

function tile(code: TileCode, copy: number): PhysicalTile {
  return { id: `${code}#${copy}`, code };
}

/**
 * Build a mid-hand state where `discarder` just discarded `discardCode`,
 * opening a claim window against the configured hands.
 */
function openClaimWindow(opts: {
  discarder: Seat;
  discardCode: TileCode;
  /** Exact 13 face codes per non-discarder; discarder list is the 13 concealed (drawn is the discard). */
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
    seed: 1,
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

describe('chow option listing', () => {
  it('lists every concrete sequence using the discarded face', () => {
    const hand = [tile('m2', 0), tile('m3', 0), tile('m4', 0), tile('m5', 0), tile('p1', 0)];
    const options = listChowOptions(hand, 'm3');
    expect(options).toHaveLength(2);
    expect(options[0]!.codes).toEqual(['m2', 'm4']);
    expect(options[1]!.codes).toEqual(['m4', 'm5']);
  });
});

describe('claim window opening', () => {
  it('allows chow only for the discarder\'s next seat', () => {
    const state = openClaimWindow({
      discarder: 0,
      discardCode: 'm3',
      hands: {
        0: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 's1', 's2', 's3', 's4'],
        1: ['m1', 'm2', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 's1', 's2'],
        2: ['m4', 'm5', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 'E', 'S'],
        3: ['W', 'N', 'C', 'F', 'P', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'],
      },
    });

    expect(state.phase).toBe('awaiting_claim_response');
    expect(legalClaims(state, 1).chowOptions.length).toBeGreaterThan(0);
    expect(legalClaims(state, 2).chowOptions).toHaveLength(0);
    expect(legalClaims(state, 3).chowOptions).toHaveLength(0);
    expect(nextSeat(0)).toBe(1);
  });

  it('allows pung from a non-discarder with two matching tiles', () => {
    const state = openClaimWindow({
      discarder: 1,
      discardCode: 'E',
      hands: {
        0: ['E', 'E', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p1', 'p2'],
        1: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 's1', 's2', 's3', 's4'],
        2: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p1', 'p2', 'p3', 'p4'],
        3: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 'W', 'N', 'C', 'F'],
      },
    });

    expect(state.phase).toBe('awaiting_claim_response');
    expect(legalClaims(state, 0).canPung).toBe(true);
    expect(legalClaims(state, 2).canPung).toBe(false);
    expect(legalClaims(state, 3).canPung).toBe(false);
  });
});

describe('claim resolution priority', () => {
  it('prefers pung over chow when both are locked', () => {
    // Seat 1 chow m1+m2; seat 2 pung with two m3. Discard uses the third m3.
    const state = openClaimWindow({
      discarder: 0,
      discardCode: 'm3',
      hands: {
        0: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 's1', 's2', 's3', 's4'],
        1: ['m1', 'm2', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 's1', 's2'],
        2: ['m3', 'm3', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 'E', 'S'],
        3: ['W', 'N', 'C', 'F', 'P', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'],
      },
    });

    expect(state.phase).toBe('awaiting_claim_response');
    const discardedId = state.responseWindow!.tile.id;
    const chow = legalClaims(state, 1).chowOptions[0]!;
    let next = applyCommand(state, { type: 'ClaimChow', seat: 1, tileIds: chow.tileIds }).state;
    next = applyCommand(next, { type: 'ClaimPung', seat: 2 }).state;
    while (next.phase === 'awaiting_claim_response' && next.responseWindow?.pending[0] !== undefined) {
      next = applyCommand(next, { type: 'Pass', seat: next.responseWindow.pending[0]! }).state;
    }

    expect(next.phase).toBe('awaiting_discard');
    expect(next.turn).toBe(2);
    expect(next.seats[2].melds).toHaveLength(1);
    expect(next.seats[2].melds[0]!.kind).toBe('pung');
    expect(next.seats[2].melds[0]!.fromSeat).toBe(0);
    expect(next.seats[2].melds[0]!.claimedTileId).toBe(discardedId);
    expect(next.seats[0].river.find((t) => t.id === discardedId)).toBeUndefined();
    expect(next.seats[1].melds).toHaveLength(0);
    expect(totalTileCount(next)).toBe(FULL_SET_SIZE);
  });

  it('orders equal-priority seats from the discarder\'s next seat', () => {
    expect(nearestAfter(0, [3, 1])).toBe(1);
    expect(nearestAfter(2, [0, 1])).toBe(0);
    expect(nearestAfter(1, [0, 3])).toBe(3);
  });

  it('picks the nearest multi-win seat after the discarder as next dealer', () => {
    expect(orderWinnerSeats(1, [0, 2, 3])).toEqual([2, 3, 0]);
    expect(nextDealerAfterWin([0, 2, 3], 1)).toBe(2);
    expect(nextDealerAfterWin([3], 1)).toBe(3);
  });

  it('applies chow and lets the claimant discard next without drawing', () => {
    const state = openClaimWindow({
      discarder: 3,
      discardCode: 's5',
      hands: {
        0: ['s3', 's4', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p1', 'p2'],
        1: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'E', 'S', 'W', 'N'],
        2: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p1', 'p2', 'p3', 'p4'],
        3: ['s1', 's2', 's3', 's4', 's6', 's7', 's8', 's9', 'E', 'S', 'W', 'N', 'C'],
      },
    });

    expect(nextSeat(3)).toBe(0);
    const option = legalClaims(state, 0).chowOptions.find(
      (o) => o.codes[0] === 's3' && o.codes[1] === 's4',
    );
    expect(option).toBeTruthy();

    let next = applyCommand(state, {
      type: 'ClaimChow',
      seat: 0,
      tileIds: option!.tileIds,
    }).state;
    while (next.phase === 'awaiting_claim_response' && next.responseWindow?.pending[0] !== undefined) {
      next = applyCommand(next, { type: 'Pass', seat: next.responseWindow.pending[0]! }).state;
    }

    expect(next.phase).toBe('awaiting_discard');
    expect(next.turn).toBe(0);
    expect(next.seats[0].melds).toHaveLength(1);
    expect(next.seats[0].melds[0]!.kind).toBe('chow');
    expect(next.seats[0].melds[0]!.fromSeat).toBe(3);
    expect(next.seats[0].hand).toHaveLength(11);
    expect(next.seats[0].drawn).toBeNull();

    const drawn = ensureDrawn(next);
    expect(drawn.events).toHaveLength(0);
    expect(drawn.state.seats[0].drawn).toBeNull();

    const discardId = next.seats[0].hand[0]!.id;
    next = applyCommand(next, { type: 'Discard', seat: 0, tileId: discardId }).state;
    expect(next.seats[0].hand).toHaveLength(10);
    expect(totalTileCount(next)).toBe(FULL_SET_SIZE);
  });

  it('resumes the next seat after everyone passes', () => {
    const state = openClaimWindow({
      discarder: 0,
      discardCode: 'm3',
      hands: {
        0: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 's1', 's2', 's3', 's4'],
        1: ['m1', 'm2', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 's1', 's2'],
        2: ['m4', 'm5', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 'E', 'S'],
        3: ['W', 'N', 'C', 'F', 'P', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'],
      },
    });

    let next = state;
    while (next.phase === 'awaiting_claim_response' && next.responseWindow?.pending[0] !== undefined) {
      next = applyCommand(next, { type: 'Pass', seat: next.responseWindow.pending[0]! }).state;
    }
    expect(next.phase).toBe('awaiting_discard');
    expect(next.turn).toBe(1);
    expect(next.seats[0].river.at(-1)?.code).toBe('m3');
  });

  it('requires an explicit chow tile pair when multiple options exist', () => {
    const state = openClaimWindow({
      discarder: 0,
      discardCode: 'm3',
      hands: {
        0: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 's1', 's2', 's3', 's4'],
        1: ['m1', 'm2', 'm4', 'm5', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'],
        2: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 'E', 'S', 'W', 'N'],
        3: ['W', 'N', 'C', 'F', 'P', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'],
      },
    });

    const options = legalClaims(state, 1).chowOptions;
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(() =>
      applyCommand(state, { type: 'ClaimChow', seat: 1, tileIds: ['nope#0', 'nope#1'] }),
    ).toThrow(/cannot chow/);

    let next = applyCommand(state, {
      type: 'ClaimChow',
      seat: 1,
      tileIds: options[0]!.tileIds,
    }).state;
    while (next.phase === 'awaiting_claim_response' && next.responseWindow?.pending[0] !== undefined) {
      next = applyCommand(next, { type: 'Pass', seat: next.responseWindow.pending[0]! }).state;
    }
    expect(next.seats[1].melds[0]!.kind).toBe('chow');
  });
});

describe('win helpers still work with no melds', () => {
  it('keeps canWinOnDiscard false for a non-ready hand', () => {
    const started = applyCommand(null, { type: 'StartHand', seed: 1, dealer: 0 }).state;
    expect(canWinOnDiscard(started, 1, 'm1')).toBe(false);
  });
});

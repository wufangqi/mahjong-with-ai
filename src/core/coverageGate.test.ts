import { describe, expect, it } from 'vitest';
import {
  canKongHand,
  canPungHand,
  kongTileIds,
  listChowOptions,
  nearestAfter,
  nextDealerAfterWin,
  pungTileIds,
} from './claims';
import {
  applyCommand,
  ensureDrawn,
  legalClaims,
  legalSelfActions,
  legalDiscardTileIds,
  seatHasClaimOptions,
  totalTileCount,
} from './hand';
import { createRng, shuffleInPlace } from './rng';
import { createFullSet, FULL_SET_SIZE, sortHand, type PhysicalTile, type TileCode } from './tiles';
import type { HandState, Meld, Seat, WinSettlement } from './types';
import {
  evaluateWin,
  isWinningHand,
  waitingTileCodes,
  type MeldForWin,
} from './winning';

function t(code: TileCode, copy: number): PhysicalTile {
  return { id: `${code}#${copy}`, code };
}

function takeFactory() {
  const used = new Map<TileCode, number>();
  const take = (code: TileCode): PhysicalTile => {
    const n = used.get(code) ?? 0;
    if (n >= 4) throw new Error(`overused ${code}`);
    used.set(code, n + 1);
    return t(code, n);
  };
  const remainingWall = (): PhysicalTile[] =>
    createFullSet().filter((tile) => {
      const max = used.get(tile.code) ?? 0;
      const copy = Number(tile.id.split('#')[1]);
      return copy >= max;
    });
  return { take, remainingWall };
}

function openClaimWindow(opts: {
  discarder: Seat;
  discardCode: TileCode;
  hands: Record<Seat, TileCode[]>;
  wallTail?: TileCode[];
}): HandState {
  const { take, remainingWall } = takeFactory();
  const seats: HandState['seats'] = [
    { hand: [], drawn: null, river: [], melds: [] },
    { hand: [], drawn: null, river: [], melds: [] },
    { hand: [], drawn: null, river: [], melds: [] },
    { hand: [], drawn: null, river: [], melds: [] },
  ];
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    seats[seat].hand = sortHand(opts.hands[seat].map(take));
  }
  const discarded = take(opts.discardCode);
  seats[opts.discarder].drawn = discarded;
  const tail = (opts.wallTail ?? []).map(take);
  const wall = [...remainingWall(), ...tail];
  const state: HandState = {
    schemaVersion: 1,
    ruleSetId: 'shuanghu-v1',
    seed: 1,
    rngState: 1,
    dealer: opts.discarder,
    turn: opts.discarder,
    phase: 'awaiting_discard',
    wall,
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

function seatAfterDraw(opts: {
  seat: Seat;
  hand: TileCode[];
  drawn: TileCode;
  melds?: Meld[];
  wallTail?: TileCode[];
}): HandState {
  const { take, remainingWall } = takeFactory();
  const seats: HandState['seats'] = [
    { hand: [], drawn: null, river: [], melds: [] },
    { hand: [], drawn: null, river: [], melds: [] },
    { hand: [], drawn: null, river: [], melds: [] },
    { hand: [], drawn: null, river: [], melds: [] },
  ];
  const melds = (opts.melds ?? []).map((m) => ({
    ...m,
    tiles: m.tiles.map((tile) => take(tile.code)),
  }));
  seats[opts.seat].hand = sortHand(opts.hand.map(take));
  seats[opts.seat].drawn = take(opts.drawn);
  seats[opts.seat].melds = melds;
  let pool = remainingWall();
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    if (seat === opts.seat) continue;
    seats[seat].hand = sortHand(pool.splice(0, 13));
  }
  const tail: PhysicalTile[] = [];
  for (const code of opts.wallTail ?? []) {
    const idx = pool.findIndex((tile) => tile.code === code);
    if (idx < 0) throw new Error(`missing wall tail ${code}`);
    tail.push(pool.splice(idx, 1)[0]!);
  }
  return {
    schemaVersion: 1,
    ruleSetId: 'shuanghu-v1',
    seed: 1,
    rngState: 1,
    dealer: opts.seat,
    turn: opts.seat,
    phase: 'awaiting_discard',
    wall: [...pool, ...tail],
    seats,
    responseWindow: null,
    settlement: null,
    winSettlement: null,
    lastDrawKind: 'normal',
  };
}

describe('core coverage gate — RNG / claims helpers', () => {
  it('allows restoring rng state and rejects invalid nextInt', () => {
    const rng = createRng(1);
    rng.state = 42;
    expect(rng.state).toBe(42);
    expect(() => rng.nextInt(0)).toThrow(/maxExclusive/);
    const items = [1, 2, 3];
    shuffleInPlace(items, createRng(9));
    expect(new Set(items)).toEqual(new Set([1, 2, 3]));
  });

  it('nearestAfter / nextDealerAfterWin / pung-kong helpers cover edge branches', () => {
    expect(nearestAfter(1, [])).toBeNull();
    expect(nearestAfter(1, [1])).toBeNull();
    expect(() => nextDealerAfterWin([], 0)).toThrow(/no winners/);
    expect(nextDealerAfterWin([2], 0)).toBe(2);
    expect(nextDealerAfterWin([3, 1], 0)).toBe(1);
    // Multi-win list that only names the discarder — falls back after empty seat walk.
    expect(nextDealerAfterWin([0, 0], 0)).toBe(0);
    expect(listChowOptions([t('m1', 0)], 'E')).toEqual([]);
    expect(canPungHand([t('E', 0)], 'E')).toBe(false);
    expect(canKongHand([t('E', 0), t('E', 1)], 'E')).toBe(false);
    expect(pungTileIds([t('E', 0)], 'E')).toBeNull();
    expect(kongTileIds([t('E', 0), t('E', 1)], 'E')).toBeNull();
  });

  it('lists multiple chow patterns sorted by face codes', () => {
    const options = listChowOptions(
      [
        t('m1', 0),
        t('m2', 0),
        t('m4', 0),
        t('m5', 0),
        t('p5', 0),
        t('p6', 0),
        t('p7', 0),
        t('p8', 0),
        t('p9', 0),
        t('s1', 0),
        t('s2', 0),
        t('s3', 0),
        t('s4', 0),
      ],
      'm3',
    );
    expect(options.length).toBeGreaterThan(1);
    expect(options.map((o) => o.codes.join('+'))).toEqual(
      [...options].sort((a, b) => `${a.codes[0]}${a.codes[1]}`.localeCompare(`${b.codes[0]}${b.codes[1]}`)).map((o) => o.codes.join('+')),
    );
  });
});

describe('core coverage gate — winning edge branches', () => {
  it('rejects malformed special hands and empty qingyise inputs', () => {
    expect(evaluateWin(['m1']).patterns).toEqual([]);
    expect(
      evaluateWin([
        'm1',
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
        'm8',
      ]).patterns,
    ).toEqual([]);
    expect(
      evaluateWin([
        'm1',
        'm9',
        'p1',
        'p9',
        's1',
        's9',
        'E',
        'S',
        'W',
        'N',
        'C',
        'F',
        'P',
        'm2',
      ]).patterns,
    ).toEqual([]);
    // orphan with n>2
    expect(
      evaluateWin([
        'm1',
        'm1',
        'm1',
        'm9',
        'p1',
        'p9',
        's1',
        's9',
        'E',
        'S',
        'W',
        'N',
        'C',
        'F',
      ]).patterns,
    ).toEqual([]);
    expect(evaluateWin([], 0, { melds: [] }).patterns).toEqual([]);
    expect(isWinningHand(['m1', 'm1', 'm1'], 5)).toBe(false);
    expect(waitingTileCodes(['m1'], 0)).toEqual([]);
    const melds: MeldForWin[] = [{ kind: 'chow', codes: ['m1', 'm2', 'm3'] }];
    expect(
      evaluateWin(['p1', 'p1', 'p2', 'p2', 'p2', 'p3', 'p3', 'p3'], 1, { melds }).patterns,
    ).toEqual([]);
    // exposed meldsLeft < 0 via isAllTriplets / standard
    expect(
      evaluateWin(['m1', 'm1'], 5, { melds: melds.concat(melds, melds, melds, melds) }).patterns,
    ).toEqual([]);
  });
});

describe('core coverage gate — illegal command / empty query paths', () => {
  it('covers empty legalClaims / seatHasClaimOptions and legalSelfActions off-turn', () => {
    const { state } = applyCommand(null, { type: 'StartHand', seed: 3, dealer: 0 });
    expect(legalClaims(state, 0).canPung).toBe(false);
    expect(seatHasClaimOptions(state, 0)).toBe(false);
    expect(legalSelfActions(state, 1).canWin).toBe(false);
  });

  it('rejects commands before StartHand', () => {
    expect(() => applyCommand(null, { type: 'Pass', seat: 0 })).toThrow(/StartHand/);
  });

  it('hits winSettlement clone path via a follow-up command', () => {
    const { state: started } = applyCommand(null, { type: 'StartHand', seed: 5, dealer: 0 });
    const winTile = started.seats[0].drawn ?? started.seats[0].hand[0]!;
    const settlement: WinSettlement = {
      winners: [
        {
          seat: 0,
          patterns: ['pinghu'],
          fan: 1,
          hand: [...started.seats[0].hand, winTile],
        },
      ],
      discarder: 0,
      tile: winTile,
      winKind: 'self_draw',
    };
    const state: HandState = {
      ...started,
      phase: 'hand_won',
      winSettlement: settlement,
      settlement: {
        dealer: 0,
        seats: [
          { seat: 0, ready: false, hand: [], waitingTiles: [] },
          { seat: 1, ready: false, hand: [], waitingTiles: [] },
          { seat: 2, ready: false, hand: [], waitingTiles: [] },
          { seat: 3, ready: false, hand: [], waitingTiles: [] },
        ],
        fanBySeat: { 0: 0, 1: 0, 2: 0, 3: 0 },
      },
    };
    expect(() => applyCommand(state, { type: 'Pass', seat: 0 as Seat })).toThrow();
  });

  it('rejects claim / kong / pung / chow / pass / declare outside their phases', () => {
    const { state } = applyCommand(null, { type: 'StartHand', seed: 11, dealer: 0 });
    expect(() => applyCommand(state, { type: 'ClaimWin', seat: 1 })).toThrow(/win claim/);
    expect(() => applyCommand(state, { type: 'ClaimKong', seat: 1 })).toThrow(/kong claim/);
    expect(() => applyCommand(state, { type: 'ClaimPung', seat: 1 })).toThrow(/pung claim/);
    expect(() => applyCommand(state, { type: 'ClaimChow', seat: 1, tileIds: ['a', 'b'] })).toThrow(
      /chow claim/,
    );
    expect(() => applyCommand(state, { type: 'Pass', seat: 1 })).toThrow();
    expect(() => applyCommand(state, { type: 'DeclareConcealedKong', seat: 0, code: 'm1' })).toThrow();
    expect(() => applyCommand(state, { type: 'DeclareAddedKong', seat: 0, code: 'm1' })).toThrow();
    expect(() => applyCommand(state, { type: 'DeclareWin', seat: 0 })).toThrow(/self-draw/);
  });

  it('covers ensureDrawn no-op paths', () => {
    const { state } = applyCommand(null, { type: 'StartHand', seed: 21, dealer: 0 });
    expect(ensureDrawn(state).events).toEqual([]);
    const won = { ...state, phase: 'hand_won' as const };
    expect(ensureDrawn(won).events).toEqual([]);
  });

  it('rejects discard / claim / kong / pung / chow / pass misuse inside a claim window', () => {
    const state = openClaimWindow({
      discarder: 0,
      discardCode: 'E',
      hands: {
        0: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'p1', 'p2', 'p3', 's1', 's2', 's3', 's4'],
        1: ['E', 'E', 'E', 'm7', 'm8', 'm9', 'p4', 'p5', 'p6', 's5', 's6', 's7', 'W'],
        2: ['m1', 'm2', 'm3', 'p7', 'p8', 'p9', 's1', 's2', 's3', 's8', 's9', 'N', 'C'],
        3: ['m4', 'm5', 'm6', 'p1', 'p2', 'p3', 's4', 's5', 's6', 'F', 'P', 'W', 'N'],
      },
      wallTail: ['C'],
    });
    expect(state.phase).toBe('awaiting_claim_response');
    expect(() => applyCommand(state, { type: 'Discard', seat: 0, tileId: 'x' })).toThrow(/discard/);
    expect(() => applyCommand(state, { type: 'ClaimWin', seat: 2 })).toThrow(/cannot win|pending/);
    expect(() => applyCommand(state, { type: 'ClaimKong', seat: 3 })).toThrow(/cannot kong|pending/);
    expect(() => applyCommand(state, { type: 'ClaimPung', seat: 3 })).toThrow(/cannot pung|pending/);
    expect(() =>
      applyCommand(state, { type: 'ClaimChow', seat: 2, tileIds: ['m1#0', 'm2#0'] }),
    ).toThrow(/cannot chow|pending|chow/);
    // Already-locked seat inside an open window
    const locked: HandState = {
      ...state,
      responseWindow: {
        ...state.responseWindow!,
        pending: [1, 2],
        locked: { 1: { kind: 'pass' } },
        winners: [],
      },
    };
    expect(() => applyCommand(locked, { type: 'Pass', seat: 1 })).toThrow(/already responded/);
  });

  it('rejects kong when the wall has no replacement tile', () => {
    const state = openClaimWindow({
      discarder: 0,
      discardCode: 'E',
      hands: {
        0: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'p1', 'p2', 'p3', 's1', 's2', 's3', 's4'],
        1: ['E', 'E', 'E', 'm7', 'm8', 'm9', 'p4', 'p5', 'p6', 's5', 's6', 's7', 'W'],
        2: ['m1', 'm2', 'm3', 'p7', 'p8', 'p9', 's1', 's2', 's3', 's8', 's9', 'N', 'C'],
        3: ['m4', 'm5', 'm6', 'p1', 'p2', 'p3', 's4', 's5', 's6', 'F', 'P', 'W', 'N'],
      },
    });
    const drained: HandState = { ...state, wall: [] };
    expect(() => applyCommand(drained, { type: 'ClaimKong', seat: 1 })).toThrow(/replacement/);
  });

  it('rejects concealed/added kong misuse and empty-wall declare', () => {
    const state = seatAfterDraw({
      seat: 0,
      hand: ['E', 'E', 'E', 'm1', 'm2', 'm3', 'p1', 'p2', 'p3', 's1', 's2', 's3', 'W'],
      drawn: 'E',
      wallTail: ['C'],
    });
    expect(() =>
      applyCommand(state, { type: 'DeclareConcealedKong', seat: 1, code: 'E' }),
    ).toThrow(/concealed kong/);
    expect(() =>
      applyCommand(state, { type: 'DeclareConcealedKong', seat: 0, code: 'W' }),
    ).toThrow(/cannot declare concealed/);
    const noWall = { ...state, wall: [] as PhysicalTile[] };
    expect(() =>
      applyCommand(noWall, { type: 'DeclareConcealedKong', seat: 0, code: 'E' }),
    ).toThrow(/replacement/);

    const withPung = seatAfterDraw({
      seat: 0,
      hand: ['m1', 'm2', 'm3', 'p1', 'p2', 'p3', 's1', 's2', 's3', 'W'],
      drawn: 'E',
      melds: [
        {
          kind: 'pung',
          tiles: [t('E', 0), t('E', 1), t('E', 2)],
          fromSeat: 1,
          claimedTileId: 'E#0',
        },
      ],
      wallTail: ['C'],
    });
    expect(legalSelfActions(withPung, 0).addedKongCodes).toContain('E');
    expect(() =>
      applyCommand(withPung, { type: 'DeclareAddedKong', seat: 1, code: 'E' }),
    ).toThrow(/added kong/);
    expect(() =>
      applyCommand(withPung, { type: 'DeclareAddedKong', seat: 0, code: 'W' }),
    ).toThrow(/no pung/);
    const drainedPung = { ...withPung, wall: [] as PhysicalTile[] };
    expect(() =>
      applyCommand(drainedPung, { type: 'DeclareAddedKong', seat: 0, code: 'E' }),
    ).toThrow(/replacement/);
  });

  it('rejects discard of wrong seat / wrong tile and ensureDrawn size errors', () => {
    const { state } = applyCommand(null, { type: 'StartHand', seed: 33, dealer: 0 });
    const ids = legalDiscardTileIds(state, 0);
    expect(ids.length).toBeGreaterThan(0);
    expect(() => applyCommand(state, { type: 'Discard', seat: 1, tileId: ids[0]! })).toThrow(
      /cannot discard|turn/,
    );
    expect(() => applyCommand(state, { type: 'Discard', seat: 0, tileId: 'missing' })).toThrow();
    const tooMany = {
      ...state,
      seats: [
        {
          ...state.seats[0],
          hand: [...state.seats[0].hand, ...state.seats[0].hand.slice(0, 2)],
          drawn: state.seats[0].drawn,
        },
        state.seats[1],
        state.seats[2],
        state.seats[3],
      ] as HandState['seats'],
    };
    expect(() =>
      applyCommand(tooMany, { type: 'Discard', seat: 0, tileId: ids[0]! }),
    ).toThrow(/must hold/);
    const broken = {
      ...state,
      seats: [
        { ...state.seats[0], hand: state.seats[0].hand.slice(0, 3), drawn: null },
        state.seats[1],
        state.seats[2],
        state.seats[3],
      ] as HandState['seats'],
    };
    expect(() => ensureDrawn(broken)).toThrow(/unexpected hand size/);
    const emptyWall = {
      ...state,
      wall: [] as PhysicalTile[],
      seats: [
        { ...state.seats[0], hand: state.seats[0].hand.slice(0, 13), drawn: null },
        state.seats[1],
        state.seats[2],
        state.seats[3],
      ] as HandState['seats'],
      turn: 0 as Seat,
      phase: 'awaiting_discard' as const,
    };
    // Dealer after discard holds 13; next seat draw with empty wall.
    const afterDiscard = applyCommand(state, { type: 'Discard', seat: 0, tileId: ids[0]! }).state;
    if (afterDiscard.phase === 'awaiting_discard') {
      const drained = { ...afterDiscard, wall: [] as PhysicalTile[] };
      expect(() => ensureDrawn(drained)).toThrow(/wall is empty/);
    } else {
      expect(emptyWall.wall).toHaveLength(0);
    }
  });

  it('rejects win-only-window meld claims and pass for non-pending seats', () => {
    const state = openClaimWindow({
      discarder: 0,
      discardCode: 'E',
      hands: {
        0: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'p1', 'p2', 'p3', 's1', 's2', 's3', 's4'],
        1: ['E', 'E', 'E', 'm7', 'm8', 'm9', 'p4', 'p5', 'p6', 's5', 's6', 's7', 'W'],
        2: ['m1', 'm2', 'm3', 'p7', 'p8', 'p9', 's1', 's2', 's3', 's8', 's9', 'N', 'C'],
        3: ['m4', 'm5', 'm6', 'p1', 'p2', 'p3', 's4', 's5', 's6', 'F', 'P', 'W', 'N'],
      },
      wallTail: ['C'],
    });
    const winOnly: HandState = {
      ...state,
      phase: 'awaiting_claim_response',
      responseWindow: {
        ...state.responseWindow!,
        mode: 'win_only',
        pending: [1, 2],
        locked: {},
        winners: [],
      },
    };
    expect(() => applyCommand(winOnly, { type: 'ClaimKong', seat: 1 })).toThrow(/win-only/);
    expect(() => applyCommand(winOnly, { type: 'ClaimPung', seat: 1 })).toThrow(/win-only/);
    expect(() =>
      applyCommand(winOnly, { type: 'ClaimChow', seat: 1, tileIds: ['m7#0', 'm8#0'] }),
    ).toThrow(/win-only/);
    expect(() => applyCommand(winOnly, { type: 'Pass', seat: 3 })).toThrow(/no pending/);
  });

  it('rejects concealed kong without drawn and added kong missing tile', () => {
    const state = seatAfterDraw({
      seat: 0,
      hand: ['E', 'E', 'E', 'm1', 'm2', 'm3', 'p1', 'p2', 'p3', 's1', 's2', 's3', 'W'],
      drawn: 'E',
      wallTail: ['C'],
    });
    const noDrawn = {
      ...state,
      seats: [
        { ...state.seats[0], drawn: null, hand: [...state.seats[0].hand, state.seats[0].drawn!] },
        state.seats[1],
        state.seats[2],
        state.seats[3],
      ] as HandState['seats'],
    };
    expect(() =>
      applyCommand(noDrawn, { type: 'DeclareConcealedKong', seat: 0, code: 'E' }),
    ).toThrow(/requires a drawn tile/);
    expect(() =>
      applyCommand(noDrawn, { type: 'DeclareAddedKong', seat: 0, code: 'E' }),
    ).toThrow(/requires a drawn tile/);

    const withPung = seatAfterDraw({
      seat: 0,
      hand: ['m1', 'm2', 'm3', 'p1', 'p2', 'p3', 's1', 's2', 's3', 'W'],
      drawn: 'C',
      melds: [
        {
          kind: 'pung',
          tiles: [t('E', 0), t('E', 1), t('E', 2)],
          fromSeat: 1,
          claimedTileId: 'E#0',
        },
      ],
      wallTail: ['F'],
    });
    expect(() =>
      applyCommand(withPung, { type: 'DeclareAddedKong', seat: 0, code: 'E' }),
    ).toThrow(/lacks E|added kong/);

    // Added kong where the 4th tile is in hand (drawn is unrelated) — folds drawn back.
    const handExtra = seatAfterDraw({
      seat: 0,
      hand: ['E', 'm1', 'm2', 'm3', 'p1', 'p2', 'p3', 's1', 's2', 's3', 'W'],
      drawn: 'C',
      melds: [
        {
          kind: 'pung',
          tiles: [t('E', 0), t('E', 1), t('E', 2)],
          fromSeat: 1,
          claimedTileId: 'E#0',
        },
      ],
      wallTail: ['F'],
    });
    const upgraded = applyCommand(handExtra, { type: 'DeclareAddedKong', seat: 0, code: 'E' }).state;
    expect(upgraded.seats[0].melds[0]!.kind).toBe('added_kong');
    expect(upgraded.seats[0].drawn?.code).toBe('F');
  });

  it('rejects cannot-kong / cannot-pung / cannot-chow seat errors', () => {
    const state = openClaimWindow({
      discarder: 0,
      discardCode: 'm5',
      hands: {
        0: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 's1', 's2', 's3', 's4'],
        1: ['m3', 'm4', 'm1', 'm2', 'm6', 'p4', 'p5', 'p6', 's1', 's2', 's3', 's8', 's9'],
        2: ['m5', 'm5', 'm7', 'm8', 'm9', 'p1', 'p2', 'p3', 's5', 's6', 's7', 'W', 'N'],
        3: ['m4', 'm6', 'm7', 'p7', 'p8', 'p9', 's4', 's5', 's6', 'F', 'P', 'C', 'E'],
      },
      wallTail: ['C'],
    });
    // Seat 2 can pung (2×m5) but not kong — force pending and try kong.
    expect(legalClaims(state, 2).canPung).toBe(true);
    expect(legalClaims(state, 2).canKong).toBe(false);
    expect(() => applyCommand(state, { type: 'ClaimKong', seat: 2 })).toThrow(/cannot kong/);
    // Seat 3 cannot pung m5
    const forcedPending: HandState = {
      ...state,
      responseWindow: {
        ...state.responseWindow!,
        pending: [1, 2, 3],
      },
    };
    expect(() => applyCommand(forcedPending, { type: 'ClaimPung', seat: 3 })).toThrow(/cannot pung/);
    // Seat 2 is not 下家 of discarder 0 (下家 is 1)
    expect(() =>
      applyCommand(forcedPending, { type: 'ClaimChow', seat: 2, tileIds: ['m3#0', 'm4#0'] }),
    ).toThrow(/cannot chow/);
  });
});

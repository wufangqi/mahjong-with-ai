import { describe, expect, it } from 'vitest';
import { applyCommand, ensureDrawn, legalClaims, legalSelfActions, totalTileCount } from './hand';
import { createFullSet, FULL_SET_SIZE, sortHand, type PhysicalTile, type TileCode } from './tiles';
import type { HandState, Meld, Seat } from './types';

function tile(code: TileCode, copy: number): PhysicalTile {
  return { id: `${code}#${copy}`, code };
}

function takeFactory() {
  const used = new Map<TileCode, number>();
  const take = (code: TileCode): PhysicalTile => {
    const n = used.get(code) ?? 0;
    if (n >= 4) throw new Error(`overused ${code}`);
    used.set(code, n + 1);
    return tile(code, n);
  };
  const remainingWall = (): PhysicalTile[] =>
    createFullSet().filter((t) => {
      const max = used.get(t.code) ?? 0;
      const copy = Number(t.id.split('#')[1]);
      return copy >= max;
    });
  return { take, remainingWall };
}

/** Mid-hand claim window after `discarder` discarded `discardCode`. */
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
    const codes = opts.hands[seat];
    if (codes.length !== 13) throw new Error(`seat ${seat} needs 13 codes`);
    seats[seat].hand = sortHand(codes.map(take));
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
  /** Concealed codes before the forced draw (13 − 3×melds). */
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
    tiles: m.tiles.map((t) => take(t.code)),
  }));

  const expectedHand = 13 - melds.length * 3;
  if (opts.hand.length !== expectedHand) {
    throw new Error(`hand length ${opts.hand.length} !== ${expectedHand}`);
  }

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
    const idx = pool.findIndex((t) => t.code === code);
    if (idx < 0) throw new Error(`missing wall tail ${code}`);
    tail.push(pool.splice(idx, 1)[0]!);
  }
  const wall = [...pool, ...tail];

  const state: HandState = {
    schemaVersion: 1,
    ruleSetId: 'shuanghu-v1',
    seed: 1,
    rngState: 1,
    dealer: opts.seat,
    turn: opts.seat,
    phase: 'awaiting_discard',
    wall,
    seats,
    responseWindow: null,
    settlement: null,
    winSettlement: null,
    lastDrawKind: 'normal',
  };
  expect(totalTileCount(state)).toBe(FULL_SET_SIZE);
  return state;
}

describe('exposed kong (明杠)', () => {
  it('offers kong when a seat holds three of the discard and the wall has a replacement', () => {
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
    expect(legalClaims(state, 1).canKong).toBe(true);
    expect(legalClaims(state, 1).canPung).toBe(true);
  });

  it('does not offer kong when the wall has no replacement tile', () => {
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
    const drained: HandState = {
      ...state,
      wall: [],
      seats: [
        { ...state.seats[0], hand: [...state.seats[0].hand], river: [...state.seats[0].river], melds: [] },
        { ...state.seats[1], hand: [...state.seats[1].hand], river: [...state.seats[1].river], melds: [] },
        { ...state.seats[2], hand: [...state.seats[2].hand], river: [...state.seats[2].river], melds: [] },
        { ...state.seats[3], hand: [...state.seats[3].hand], river: [...state.seats[3].river], melds: [] },
      ],
      responseWindow: state.responseWindow
        ? {
            ...state.responseWindow,
            pending: [...state.responseWindow.pending],
            winners: [...state.responseWindow.winners],
            locked: { ...state.responseWindow.locked },
            tile: state.responseWindow.tile,
          }
        : null,
    };
    expect(legalClaims(drained, 1).canKong).toBe(false);
    expect(legalClaims(drained, 1).canPung).toBe(true);
  });

  it('resolves exposed kong before chow and draws replacement from the wall tail', () => {
    // Seat 1 (下家) can chow m5; seat 2 holds three m5 for 明杠.
    const state = openClaimWindow({
      discarder: 0,
      discardCode: 'm5',
      hands: {
        0: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 's1', 's2', 's3', 's4'],
        1: ['m3', 'm4', 'm1', 'm2', 'm6', 'p4', 'p5', 'p6', 's1', 's2', 's3', 's8', 's9'],
        2: ['m5', 'm5', 'm5', 'm7', 'm8', 'm9', 'p1', 'p2', 'p3', 's5', 's6', 's7', 'W'],
        3: ['m4', 'm6', 'm7', 'p7', 'p8', 'p9', 's4', 's5', 's6', 'F', 'P', 'N', 'C'],
      },
      wallTail: ['C'],
    });

    expect(state.wall[state.wall.length - 1]!.code).toBe('C');
    expect(legalClaims(state, 2).canKong).toBe(true);
    expect(legalClaims(state, 1).chowOptions.length).toBeGreaterThan(0);

    const chow = legalClaims(state, 1).chowOptions[0]!;
    let next = applyCommand(state, { type: 'ClaimChow', seat: 1, tileIds: chow.tileIds }).state;
    next = applyCommand(next, { type: 'ClaimKong', seat: 2 }).state;

    expect(next.phase).toBe('awaiting_discard');
    expect(next.turn).toBe(2);
    expect(next.seats[2].melds).toHaveLength(1);
    expect(next.seats[2].melds[0]!.kind).toBe('exposed_kong');
    expect(next.seats[2].melds[0]!.tiles).toHaveLength(4);
    expect(next.seats[2].drawn?.code).toBe('C');
    expect(next.lastDrawKind).toBe('kong_replacement');
    expect(next.seats[1].melds).toHaveLength(0);
    expect(totalTileCount(next)).toBe(FULL_SET_SIZE);
  });
});

describe('concealed and added kong (暗杠 / 加杠)', () => {
  it('lists concealed kong only after drawing and before discarding', () => {
    const state = seatAfterDraw({
      seat: 0,
      hand: ['E', 'E', 'E', 'm1', 'm2', 'm3', 'p1', 'p2', 'p3', 's1', 's2', 's3', 'W'],
      drawn: 'E',
      wallTail: ['C'],
    });

    expect(legalSelfActions(state, 0).concealedKongCodes).toContain('E');
    expect(legalSelfActions(state, 0).addedKongCodes).toEqual([]);
  });

  it('declares concealed kong, replaces from the wall tail, and allows another kong', () => {
    const state = seatAfterDraw({
      seat: 0,
      hand: ['E', 'E', 'E', 'W', 'W', 'W', 'm1', 'm2', 'm3', 'p1', 'p2', 'p3', 's1'],
      drawn: 'E',
      // Tail order: last element is drawn first (wall.pop).
      wallTail: ['C', 'W'],
    });

    const afterFirst = applyCommand(state, {
      type: 'DeclareConcealedKong',
      seat: 0,
      code: 'E',
    });
    expect(afterFirst.events.some((e) => e.type === 'MeldFormed' && e.kind === 'concealed_kong')).toBe(
      true,
    );
    expect(afterFirst.state.seats[0].drawn?.code).toBe('W');
    expect(afterFirst.state.lastDrawKind).toBe('kong_replacement');

    const afterSecond = applyCommand(afterFirst.state, {
      type: 'DeclareConcealedKong',
      seat: 0,
      code: 'W',
    });
    expect(afterSecond.state.seats[0].melds).toHaveLength(2);
    expect(afterSecond.state.seats[0].drawn?.code).toBe('C');
    expect(totalTileCount(afterSecond.state)).toBe(FULL_SET_SIZE);
  });

  it('upgrades a pung to added kong without opening a rob window', () => {
    const state = seatAfterDraw({
      seat: 0,
      hand: ['m1', 'm2', 'm3', 'p1', 'p2', 'p3', 's1', 's2', 's3', 'W'],
      drawn: 'E',
      melds: [
        {
          kind: 'pung',
          tiles: [tile('E', 0), tile('E', 1), tile('E', 2)],
          fromSeat: 2,
          claimedTileId: 'E#0',
        },
      ],
      wallTail: ['C'],
    });

    expect(state.seats[0].hand.length).toBe(10);

    const result = applyCommand(state, { type: 'DeclareAddedKong', seat: 0, code: 'E' });
    expect(result.state.phase).toBe('awaiting_discard');
    expect(result.state.responseWindow).toBeNull();
    expect(result.state.seats[0].melds[0]!.kind).toBe('added_kong');
    expect(result.state.seats[0].melds[0]!.tiles).toHaveLength(4);
    expect(result.state.seats[0].drawn?.code).toBe('C');
    expect(result.events.some((e) => e.type === 'WinResponseOpened')).toBe(false);
    expect(result.events.some((e) => e.type === 'ClaimResponseOpened')).toBe(false);
  });
});

describe('杠上开花', () => {
  it('wins on a kong replacement as 杠上开花 (1 fan) with self-draw settlement', () => {
    const state = seatAfterDraw({
      seat: 0,
      hand: ['E', 'E', 'E', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'p1', 'p2', 'p3', 'W'],
      drawn: 'E',
      wallTail: ['W'],
    });

    const konged = applyCommand(state, {
      type: 'DeclareConcealedKong',
      seat: 0,
      code: 'E',
    }).state;
    expect(konged.seats[0].drawn?.code).toBe('W');

    const won = applyCommand(konged, { type: 'DeclareWin', seat: 0 });
    expect(won.state.phase).toBe('hand_won');
    expect(won.state.winSettlement?.winKind).toBe('self_draw');
    expect(won.state.winSettlement?.winners[0]?.patterns).toEqual(['gangshangkaihua']);
    expect(won.state.winSettlement?.winners[0]?.fan).toBe(1);
    const handWon = won.events.find((e) => e.type === 'HandWon');
    expect(handWon && 'tier' in handWon).toBe(false);
  });
});

describe('ensureDrawn after kong', () => {
  it('does not draw again when the seat already holds a kong replacement', () => {
    const state = seatAfterDraw({
      seat: 0,
      hand: ['E', 'E', 'E', 'm1', 'm2', 'm3', 'p1', 'p2', 'p3', 's1', 's2', 's3', 'W'],
      drawn: 'E',
      wallTail: ['C'],
    });
    const konged = applyCommand(state, {
      type: 'DeclareConcealedKong',
      seat: 0,
      code: 'E',
    }).state;
    const wallLen = konged.wall.length;
    const again = ensureDrawn(konged);
    expect(again.state.wall.length).toBe(wallLen);
    expect(again.events).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';
import { FULL_SET_SIZE, PLAYER_SEAT, totalTileCount } from '../core';
import { PlaySession } from './session';

describe('PlaySession', () => {
  it('advances to the player discard turn for a fixed seed', () => {
    const session = new PlaySession();
    session.start(42);
    const snap = session.snapshot();
    expect(snap.status).toBe('awaiting_player_discard');
    expect(snap.state?.turn).toBe(PLAYER_SEAT);
    expect(snap.state?.seats[PLAYER_SEAT].drawn).not.toBeNull();
    expect(totalTileCount(snap.state!)).toBe(FULL_SET_SIZE);
  });

  it('requires a second click to confirm discard and then continues the round', () => {
    const session = new PlaySession();
    session.start(7);
    const drawnId = session.snapshot().state!.seats[PLAYER_SEAT].drawn!.id;

    session.clickTile(drawnId);
    expect(session.snapshot().selectedTileId).toBe(drawnId);
    expect(session.snapshot().status).toBe('awaiting_player_discard');

    session.clickTile(drawnId);
    const after = session.snapshot();
    expect(after.state?.seats[PLAYER_SEAT].river.at(-1)?.id).toBe(drawnId);
    expect(totalTileCount(after.state!)).toBe(FULL_SET_SIZE);
    // Either back to player discard later in the loop, or a terminal/response status.
    expect(['awaiting_player_discard', 'awaiting_player_win_response', 'exhaustive_draw', 'hand_won']).toContain(
      after.status,
    );
  });

  it('accepts drag discard without a prior selection', () => {
    const session = new PlaySession();
    session.start(11);
    const tileId = session.snapshot().state!.seats[PLAYER_SEAT].hand[0]!.id;
    session.discardByDrag(tileId);
    const snap = session.snapshot();
    expect(snap.state?.seats[PLAYER_SEAT].river.at(-1)?.id).toBe(tileId);
    expect(totalTileCount(snap.state!)).toBe(FULL_SET_SIZE);
  });

  it('plays a full no-response hand to 流局 with first-legal actions', () => {
    const session = new PlaySession();
    session.start(42);
    session.autoPlayPlayerFirstLegal();
    const snap = session.snapshot();
    expect(snap.status).toBe('exhaustive_draw');
    expect(snap.state?.phase).toBe('exhaustive_draw');
    expect(snap.settlement).not.toBeNull();
    expect(snap.settlement!.fanBySeat).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0 });
    expect(snap.state!.wall).toHaveLength(0);
    expect(totalTileCount(snap.state!)).toBe(FULL_SET_SIZE);

    for (const info of snap.settlement!.seats) {
      expect(info.hand).toHaveLength(13);
    }
  });

  it('keeps the dealer when starting the next hand after 流局', () => {
    const session = new PlaySession();
    session.start(42);
    session.autoPlayPlayerFirstLegal();
    const dealer = session.snapshot().state!.dealer;
    session.startNextHand(1001);
    expect(session.snapshot().state!.dealer).toBe(dealer);
    expect(session.snapshot().status).toBe('awaiting_player_discard');
  });

  it('is reproducible for a fixed seed through 流局', () => {
    const a = new PlaySession();
    a.start(99);
    a.autoPlayPlayerFirstLegal();
    const b = new PlaySession();
    b.start(99);
    b.autoPlayPlayerFirstLegal();
    expect(a.snapshot().settlement).toEqual(b.snapshot().settlement);
    expect(a.snapshot().state!.seats.map((s) => s.river.map((t) => t.id))).toEqual(
      b.snapshot().state!.seats.map((s) => s.river.map((t) => t.id)),
    );
  });

  it('loads a 平胡 response demo, claims win, and settles with 1 fan', () => {
    const session = new PlaySession();
    session.loadPinghuWinDemo();
    expect(session.snapshot().status).toBe('awaiting_player_win_response');
    expect(session.snapshot().playerCanWin).toBe(true);

    session.claimWin();
    const snap = session.snapshot();
    expect(snap.status).toBe('hand_won');
    expect(snap.winSettlement?.winners).toEqual([
      expect.objectContaining({ seat: 0, patterns: ['pinghu'], fan: 1 }),
    ]);
    expect(snap.events.some((e) => e.type === 'HandWon')).toBe(true);

    const winnerSeat = snap.winSettlement!.winners[0]!.seat;
    session.startNextHand(5302);
    expect(session.snapshot().state!.dealer).toBe(winnerSeat);
  });

  it('lets the player pass a 平胡 opportunity without ending the hand', () => {
    const session = new PlaySession();
    session.loadPinghuWinDemo();
    session.passWin();
    const snap = session.snapshot();
    expect(snap.status).not.toBe('hand_won');
    expect(snap.winSettlement).toBeNull();
    expect(['awaiting_player_discard', 'awaiting_player_win_response', 'exhaustive_draw']).toContain(
      snap.status,
    );
  });
});

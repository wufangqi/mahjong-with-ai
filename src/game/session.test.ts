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

  it('requires a second click to confirm discard and then locks further discards', () => {
    const session = new PlaySession();
    session.start(7);
    const drawnId = session.snapshot().state!.seats[PLAYER_SEAT].drawn!.id;

    session.clickTile(drawnId);
    expect(session.snapshot().selectedTileId).toBe(drawnId);
    expect(session.snapshot().status).toBe('awaiting_player_discard');

    session.clickTile(drawnId);
    const done = session.snapshot();
    expect(done.status).toBe('complete');
    expect(done.state?.seats[PLAYER_SEAT].river.at(-1)?.id).toBe(drawnId);
    expect(done.state?.phase).toBe('discard_complete');
    expect(totalTileCount(done.state!)).toBe(FULL_SET_SIZE);

    session.clickTile(drawnId);
    expect(session.snapshot().status).toBe('complete');
    expect(session.snapshot().state?.seats[PLAYER_SEAT].river).toHaveLength(1);
  });

  it('accepts drag discard without a prior selection', () => {
    const session = new PlaySession();
    session.start(11);
    const tileId = session.snapshot().state!.seats[PLAYER_SEAT].hand[0]!.id;
    session.discardByDrag(tileId);
    const snap = session.snapshot();
    expect(snap.status).toBe('complete');
    expect(snap.state?.seats[PLAYER_SEAT].river.at(-1)?.id).toBe(tileId);
  });
});

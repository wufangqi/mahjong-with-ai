import { describe, expect, it } from 'vitest';
import { applyCommand, PLAYER_SEAT } from '../core';
import { MatchSession } from './match';

describe('MatchSession', () => {
  it('starts at the main menu with no active hand or match score', () => {
    const match = new MatchSession();
    const snap = match.snapshot();
    expect(snap.status).toBe('menu');
    expect(snap.handIndex).toBe(0);
    expect(snap.matchSeed).toBeNull();
    expect(snap.hand.state).toBeNull();
    expect(snap).not.toHaveProperty('matchScore');
    expect(snap).not.toHaveProperty('totalScore');
    expect(snap).not.toHaveProperty('chips');
  });

  it('starts a match from the menu with random first dealer reproducible by seed', () => {
    const a = new MatchSession();
    const b = new MatchSession();
    a.startMatch(42);
    b.startMatch(42);

    const expectedDealer = applyCommand(null, { type: 'StartHand', seed: 42 }).state.dealer;
    expect(a.snapshot().status).toBe('in_hand');
    expect(a.snapshot().handIndex).toBe(1);
    expect(a.snapshot().matchSeed).toBe(42);
    expect(a.snapshot().hand.state!.dealer).toBe(expectedDealer);
    expect(a.snapshot().hand.state!.dealer).toBe(b.snapshot().hand.state!.dealer);
    expect(a.snapshot().hand.state!.seats[PLAYER_SEAT].hand.map((t) => t.id)).toEqual(
      b.snapshot().hand.state!.seats[PLAYER_SEAT].hand.map((t) => t.id),
    );
  });

  it('keeps the dealer after 流局 next hand and returns to menu on end', () => {
    const match = new MatchSession();
    match.startMatch(42);
    match.hand.autoPlayPlayerFirstLegal();
    expect(match.snapshot().status).toBe('hand_settled');
    expect(match.snapshot().hand.status).toBe('exhaustive_draw');

    const dealer = match.snapshot().hand.state!.dealer;
    match.nextHand();
    expect(match.snapshot().status).toBe('in_hand');
    expect(match.snapshot().handIndex).toBe(2);
    expect(match.snapshot().hand.state!.dealer).toBe(dealer);

    match.hand.autoPlayPlayerFirstLegal();
    match.endMatch();
    expect(match.snapshot().status).toBe('menu');
    expect(match.snapshot().handIndex).toBe(0);
    expect(match.snapshot().hand.state).toBeNull();
    expect(match.snapshot().matchSeed).toBeNull();
  });

  it('advances dealer to the winner after a 平胡 settlement next hand', () => {
    const match = new MatchSession();
    match.startMatch(1);
    match.hand.loadPinghuWinDemo();
    match.hand.claimWin();
    expect(match.snapshot().status).toBe('hand_settled');
    const winner = match.snapshot().hand.winSettlement!.winners[0]!.seat;
    match.nextHand();
    expect(match.snapshot().hand.state!.dealer).toBe(winner);
  });
});

import type { Command, HandState } from '../core';
import type { ActiveSave } from '../persist';
import type { PlaySessionSnapshot, SessionStatus } from './session';
import { PlaySession } from './session';

export type MatchStatus = 'menu' | 'in_hand' | 'hand_settled';

export interface MatchSnapshot {
  status: MatchStatus;
  /** 1-based hand index within the current match; 0 on the menu. */
  handIndex: number;
  matchSeed: number | null;
  hand: PlaySessionSnapshot;
}

/**
 * One local match (一场): consecutive hands with dealer continuity, no
 * match-level score/chips/winner. Players choose next hand or end after settlement.
 */
export class MatchSession {
  readonly hand = new PlaySession();
  private status: MatchStatus = 'menu';
  private handIndex = 0;
  private matchSeed: number | null = null;
  private listeners = new Set<() => void>();
  private unsubHand: (() => void) | null = null;

  constructor() {
    this.unsubHand = this.hand.subscribe(() => this.onHandChanged());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private onHandChanged(): void {
    if (this.status === 'menu') {
      this.emit();
      return;
    }
    const handStatus = this.hand.snapshot().status;
    if (handStatus === 'exhaustive_draw' || handStatus === 'hand_won') {
      this.status = 'hand_settled';
    } else if (handStatus !== 'idle') {
      this.status = 'in_hand';
    }
    this.emit();
  }

  snapshot(): MatchSnapshot {
    return {
      status: this.status,
      handIndex: this.handIndex,
      matchSeed: this.matchSeed,
      hand: this.hand.snapshot(),
    };
  }

  /** Start a new match from the main menu. First dealer is random from `seed`. */
  startMatch(seed: number): void {
    this.hand.reset();
    this.matchSeed = seed >>> 0;
    this.handIndex = 1;
    this.status = 'in_hand';
    this.hand.start(seed);
    this.emit();
  }

  /**
   * Continue from an active 存档 snapshot (recovery source).
   * Does not re-invoke DecisionProvider.
   */
  restoreFromSave(save: ActiveSave): void {
    this.matchSeed = save.match.matchSeed >>> 0;
    this.handIndex = save.match.handIndex;
    this.status = save.match.status;
    this.hand.restore({
      state: save.handState,
      status: save.sessionStatus,
      seed: save.handState.seed,
      selectedTileId: save.selectedTileId,
      actionLog: save.actionLog,
    });
    this.emit();
  }

  /** Build the persistence payload for the current in-progress match. */
  toActiveSave(): ActiveSave | null {
    const hand = this.hand.snapshot();
    if (this.status === 'menu' || !hand.state || this.matchSeed === null) {
      return null;
    }
    return {
      schemaVersion: 1,
      kind: 'active_save',
      savedAt: Date.now(),
      match: {
        status: this.status,
        handIndex: this.handIndex,
        matchSeed: this.matchSeed,
      },
      sessionStatus: hand.status,
      handState: structuredClone(hand.state) as HandState,
      selectedTileId: hand.selectedTileId,
      actionLog: structuredClone(this.hand.getActionLog() as Command[]),
    };
  }

  /** Archive metadata helpers for ending a match. */
  archiveMeta(): {
    matchSeed: number;
    handCount: number;
    actionLog: readonly Command[];
    finalHandState: HandState | null;
    sessionStatus: SessionStatus;
  } | null {
    if (this.matchSeed === null) return null;
    const hand = this.hand.snapshot();
    return {
      matchSeed: this.matchSeed,
      handCount: this.handIndex,
      actionLog: this.hand.getActionLog(),
      finalHandState: hand.state,
      sessionStatus: hand.status,
    };
  }

  /** After settlement: deal the next hand with dealer continuity rules. */
  nextHand(): void {
    if (this.status !== 'hand_settled') {
      throw new Error('next hand is only available after settlement');
    }
    const prevSeed = this.hand.snapshot().seed ?? this.matchSeed ?? 0;
    const nextSeed = (prevSeed + 1) >>> 0;
    this.handIndex += 1;
    this.status = 'in_hand';
    this.hand.startNextHand(nextSeed);
    this.emit();
  }

  /** End the match voluntarily and return to the main menu (no match score). */
  endMatch(): void {
    this.status = 'menu';
    this.handIndex = 0;
    this.matchSeed = null;
    this.hand.reset();
    this.emit();
  }

  dispose(): void {
    this.unsubHand?.();
    this.unsubHand = null;
    this.listeners.clear();
  }
}

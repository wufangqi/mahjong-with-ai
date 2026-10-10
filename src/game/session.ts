import {
  applyCommand,
  canWinOnDiscard,
  ensureDrawn,
  legalDiscardTileIds,
  PLAYER_SEAT,
  type DomainEvent,
  type ExhaustiveDrawSettlement,
  type HandState,
  type Seat,
} from '../core';

export type SessionStatus =
  | 'idle'
  | 'awaiting_player_discard'
  | 'awaiting_player_win_response'
  | 'exhaustive_draw'
  | 'hand_won';

export interface PlaySessionSnapshot {
  status: SessionStatus;
  state: HandState | null;
  selectedTileId: string | null;
  events: DomainEvent[];
  seed: number | null;
  settlement: ExhaustiveDrawSettlement | null;
  /** True when the player may claim 胡 on the final discard. */
  playerCanWin: boolean;
}

/**
 * Coordinates a no-response full hand: seeded deal, first-legal opponent
 * discards, player discards, final win-only window, then 流局 / 胡 settlement.
 */
export class PlaySession {
  private status: SessionStatus = 'idle';
  private state: HandState | null = null;
  private selectedTileId: string | null = null;
  private events: DomainEvent[] = [];
  private seed: number | null = null;
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  snapshot(): PlaySessionSnapshot {
    const playerCanWin =
      this.state?.phase === 'awaiting_win_response' &&
      this.state.responseWindow !== null &&
      this.state.responseWindow.pending.includes(PLAYER_SEAT) &&
      canWinOnDiscard(this.state, PLAYER_SEAT, this.state.responseWindow.tile.code);

    return {
      status: this.status,
      state: this.state,
      selectedTileId: this.selectedTileId,
      events: [...this.events],
      seed: this.seed,
      settlement: this.state?.settlement ?? null,
      playerCanWin,
    };
  }

  start(seed: number, dealer?: Seat): void {
    const started = applyCommand(null, {
      type: 'StartHand',
      seed,
      ...(dealer !== undefined ? { dealer } : {}),
    });
    this.seed = seed >>> 0;
    this.state = started.state;
    this.events = [...started.events];
    this.selectedTileId = null;
    this.advance();
    this.emit();
  }

  /** After 流局, start the next hand with the same dealer. */
  startNextHand(seed: number): void {
    if (!this.state || this.state.phase !== 'exhaustive_draw') {
      throw new Error('next hand is only available after exhaustive draw');
    }
    this.start(seed, this.state.dealer);
  }

  /**
   * Auto-advance non-player seats (and resolve AI win responses) until the
   * player must act or the hand ends.
   */
  private advance(): void {
    if (!this.state) return;

    for (let guard = 0; guard < 400; guard++) {
      if (!this.state) return;

      if (this.state.phase === 'exhaustive_draw') {
        this.status = 'exhaustive_draw';
        this.selectedTileId = null;
        return;
      }
      if (this.state.phase === 'hand_won') {
        this.status = 'hand_won';
        this.selectedTileId = null;
        return;
      }

      if (this.state.phase === 'awaiting_win_response') {
        this.resolveOpponentWinResponses();
        if (!this.state) return;
        if (this.state.phase !== 'awaiting_win_response' || !this.state.responseWindow) {
          continue;
        }
        const pending = this.state.responseWindow.pending;
        if (!pending.includes(PLAYER_SEAT)) {
          continue;
        }
        const tileCode = this.state.responseWindow.tile.code;
        if (!canWinOnDiscard(this.state, PLAYER_SEAT, tileCode)) {
          const result = applyCommand(this.state, { type: 'Pass', seat: PLAYER_SEAT });
          this.state = result.state;
          this.events.push(...result.events);
          continue;
        }
        this.status = 'awaiting_player_win_response';
        return;
      }

      if (this.state.phase === 'awaiting_discard') {
        if (this.state.turn === PLAYER_SEAT) {
          const drawn = ensureDrawn(this.state);
          this.state = drawn.state;
          this.events.push(...drawn.events);
          this.status = 'awaiting_player_discard';
          return;
        }

        const drawn = ensureDrawn(this.state);
        this.state = drawn.state;
        this.events.push(...drawn.events);
        const seat = this.state.turn;
        const tileId = pickAutoDiscard(this.state, seat);
        const result = applyCommand(this.state, { type: 'Discard', seat, tileId });
        this.state = result.state;
        this.events.push(...result.events);
        continue;
      }

      throw new Error(`unexpected phase ${this.state.phase}`);
    }

    throw new Error('session deadlock: advance exceeded guard');
  }

  private resolveOpponentWinResponses(): void {
    if (!this.state || this.state.phase !== 'awaiting_win_response' || !this.state.responseWindow) {
      return;
    }

    const pending = [...this.state.responseWindow.pending];
    for (const seat of pending) {
      if (seat === PLAYER_SEAT) continue;
      const window = this.state.responseWindow;
      if (!window || !window.pending.includes(seat)) continue;
      const tileCode = window.tile.code;
      const command = canWinOnDiscard(this.state, seat, tileCode)
        ? ({ type: 'ClaimWin' as const, seat })
        : ({ type: 'Pass' as const, seat });
      const result = applyCommand(this.state, command);
      this.state = result.state;
      this.events.push(...result.events);
      if (!this.state || this.state.phase !== 'awaiting_win_response') return;
    }
  }

  selectTile(tileId: string): void {
    if (this.status !== 'awaiting_player_discard' || !this.state) return;
    const legal = legalDiscardTileIds(this.state, PLAYER_SEAT);
    if (!legal.includes(tileId)) return;
    this.selectedTileId = tileId;
    this.emit();
  }

  /** Second click on the selected tile confirms discard. */
  clickTile(tileId: string): void {
    if (this.status !== 'awaiting_player_discard' || !this.state) return;
    const legal = legalDiscardTileIds(this.state, PLAYER_SEAT);
    if (!legal.includes(tileId)) return;

    if (this.selectedTileId === tileId) {
      this.confirmDiscard(tileId);
      return;
    }
    this.selectedTileId = tileId;
    this.emit();
  }

  /** Drag-into-river confirmation. */
  discardByDrag(tileId: string): void {
    this.confirmDiscard(tileId);
  }

  private confirmDiscard(tileId: string): void {
    if (this.status !== 'awaiting_player_discard' || !this.state) return;
    const legal = legalDiscardTileIds(this.state, PLAYER_SEAT);
    if (!legal.includes(tileId)) return;

    const result = applyCommand(this.state, {
      type: 'Discard',
      seat: PLAYER_SEAT,
      tileId,
    });
    this.state = result.state;
    this.events.push(...result.events);
    this.selectedTileId = null;
    this.advance();
    this.emit();
  }

  claimWin(): void {
    if (this.status !== 'awaiting_player_win_response' || !this.state) return;
    const result = applyCommand(this.state, { type: 'ClaimWin', seat: PLAYER_SEAT });
    this.state = result.state;
    this.events.push(...result.events);
    this.advance();
    this.emit();
  }

  passWin(): void {
    if (this.status !== 'awaiting_player_win_response' || !this.state) return;
    const result = applyCommand(this.state, { type: 'Pass', seat: PLAYER_SEAT });
    this.state = result.state;
    this.events.push(...result.events);
    this.advance();
    this.emit();
  }

  /**
   * Test / e2e helper: discard the player's first legal tile repeatedly until
   * the hand reaches settlement (or a win-response the player must answer).
   */
  autoPlayPlayerFirstLegal(maxSteps = 200): void {
    for (let i = 0; i < maxSteps; i++) {
      if (this.status === 'awaiting_player_discard' && this.state) {
        const tileId = pickAutoDiscard(this.state, PLAYER_SEAT);
        this.confirmDiscard(tileId);
        continue;
      }
      if (this.status === 'awaiting_player_win_response') {
        // Prefer 流局 path for automated demos unless the player can win and we claim.
        if (this.snapshot().playerCanWin) this.passWin();
        else this.passWin();
        continue;
      }
      return;
    }
    throw new Error('autoPlayPlayerFirstLegal exceeded max steps');
  }
}

function pickAutoDiscard(state: HandState, seat: Seat): string {
  const ids = legalDiscardTileIds(state, seat);
  const drawn = state.seats[seat].drawn;
  if (drawn && ids.includes(drawn.id)) return drawn.id;
  const first = ids[0];
  if (!first) throw new Error(`no legal discard for seat ${seat}`);
  return first;
}

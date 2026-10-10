import {
  applyCommand,
  canWinOnDiscard,
  ensureDrawn,
  legalClaims,
  legalDiscardTileIds,
  PLAYER_SEAT,
  type ChowOption,
  type DomainEvent,
  type ExhaustiveDrawSettlement,
  type HandState,
  type Seat,
} from '../core';

export type SessionStatus =
  | 'idle'
  | 'awaiting_player_discard'
  | 'awaiting_player_win_response'
  | 'awaiting_player_claim_response'
  | 'exhaustive_draw'
  | 'hand_won';

export interface PlaySessionSnapshot {
  status: SessionStatus;
  state: HandState | null;
  selectedTileId: string | null;
  events: DomainEvent[];
  seed: number | null;
  settlement: ExhaustiveDrawSettlement | null;
  /** True when the player may claim 胡 on the open discard. */
  playerCanWin: boolean;
  playerCanPung: boolean;
  playerChowOptions: ChowOption[];
}

/**
 * Coordinates a full hand: seeded deal, opponent discards, mid-hand claim
 * windows (吃/碰/过), final win-only window, then 流局 / 胡 settlement.
 */
export class PlaySession {
  private status: SessionStatus = 'idle';
  private state: HandState | null = null;
  private selectedTileId: string | null = null;
  private events: DomainEvent[] = [];
  private seed: number | null = null;
  private listeners = new Set<() => void>();
  /** When true, AI always passes meld claims (used by autoplay 流局 demos). */
  private passClaims = false;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  snapshot(): PlaySessionSnapshot {
    const claims =
      this.state?.phase === 'awaiting_claim_response'
        ? legalClaims(this.state, PLAYER_SEAT)
        : { canWin: false, canPung: false, chowOptions: [] as ChowOption[] };

    const playerCanWin =
      (this.state?.phase === 'awaiting_win_response' || this.state?.phase === 'awaiting_claim_response') &&
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
      playerCanWin: Boolean(playerCanWin),
      playerCanPung: claims.canPung,
      playerChowOptions: claims.chowOptions,
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
    this.passClaims = false;
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
   * Auto-advance non-player seats (and lock AI claim/win responses) until the
   * player must act or the hand ends. AI choices are locked without applying
   * melds until every pending seat has answered.
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

      if (this.state.phase === 'awaiting_claim_response') {
        this.lockOpponentClaimResponses();
        if (!this.state) return;
        if (this.state.phase !== 'awaiting_claim_response' || !this.state.responseWindow) {
          continue;
        }
        if (!this.state.responseWindow.pending.includes(PLAYER_SEAT)) {
          continue;
        }
        this.status = 'awaiting_player_claim_response';
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

  /** Lock AI claim choices without revealing them in the UI. */
  private lockOpponentClaimResponses(): void {
    if (!this.state || this.state.phase !== 'awaiting_claim_response' || !this.state.responseWindow) {
      return;
    }

    const pending = [...this.state.responseWindow.pending];
    for (const seat of pending) {
      if (seat === PLAYER_SEAT) continue;
      const window = this.state.responseWindow;
      if (!window || !window.pending.includes(seat)) continue;

      const claims = legalClaims(this.state, seat);
      let command:
        | { type: 'Pass'; seat: Seat }
        | { type: 'ClaimWin'; seat: Seat }
        | { type: 'ClaimPung'; seat: Seat }
        | { type: 'ClaimChow'; seat: Seat; tileIds: [string, string] };

      if (this.passClaims) {
        command = { type: 'Pass', seat };
      } else if (claims.canWin) {
        command = { type: 'ClaimWin', seat };
      } else if (claims.canPung) {
        command = { type: 'ClaimPung', seat };
      } else if (claims.chowOptions[0]) {
        command = { type: 'ClaimChow', seat, tileIds: claims.chowOptions[0].tileIds };
      } else {
        command = { type: 'Pass', seat };
      }

      const result = applyCommand(this.state, command);
      this.state = result.state;
      this.events.push(...result.events);
      if (!this.state || this.state.phase !== 'awaiting_claim_response') return;
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
    if (
      (this.status !== 'awaiting_player_win_response' &&
        this.status !== 'awaiting_player_claim_response') ||
      !this.state
    ) {
      return;
    }
    const result = applyCommand(this.state, { type: 'ClaimWin', seat: PLAYER_SEAT });
    this.state = result.state;
    this.events.push(...result.events);
    this.advance();
    this.emit();
  }

  claimPung(): void {
    if (this.status !== 'awaiting_player_claim_response' || !this.state) return;
    const result = applyCommand(this.state, { type: 'ClaimPung', seat: PLAYER_SEAT });
    this.state = result.state;
    this.events.push(...result.events);
    this.advance();
    this.emit();
  }

  claimChow(tileIds: [string, string]): void {
    if (this.status !== 'awaiting_player_claim_response' || !this.state) return;
    const result = applyCommand(this.state, {
      type: 'ClaimChow',
      seat: PLAYER_SEAT,
      tileIds,
    });
    this.state = result.state;
    this.events.push(...result.events);
    this.advance();
    this.emit();
  }

  passResponse(): void {
    if (
      (this.status !== 'awaiting_player_win_response' &&
        this.status !== 'awaiting_player_claim_response') ||
      !this.state
    ) {
      return;
    }
    const result = applyCommand(this.state, { type: 'Pass', seat: PLAYER_SEAT });
    this.state = result.state;
    this.events.push(...result.events);
    this.advance();
    this.emit();
  }

  /** @deprecated use passResponse */
  passWin(): void {
    this.passResponse();
  }

  /**
   * Test / e2e helper: discard the player's first legal tile and pass all claim
   * windows until the hand reaches settlement (or a win the player must answer).
   */
  autoPlayPlayerFirstLegal(maxSteps = 400): void {
    this.passClaims = true;
    for (let i = 0; i < maxSteps; i++) {
      if (this.status === 'awaiting_player_discard' && this.state) {
        const tileId = pickAutoDiscard(this.state, PLAYER_SEAT);
        this.confirmDiscard(tileId);
        continue;
      }
      if (this.status === 'awaiting_player_claim_response') {
        this.passResponse();
        continue;
      }
      if (this.status === 'awaiting_player_win_response') {
        this.passResponse();
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

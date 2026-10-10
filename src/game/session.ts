import {
  applyCommand,
  ensureDrawn,
  legalDiscardTileIds,
  PLAYER_SEAT,
  type DomainEvent,
  type HandState,
  type Seat,
} from '../core';

export type SessionStatus = 'idle' | 'awaiting_player_discard' | 'complete';

export interface PlaySessionSnapshot {
  status: SessionStatus;
  state: HandState | null;
  selectedTileId: string | null;
  events: DomainEvent[];
  seed: number | null;
}

/**
 * Coordinates the WUF-51 vertical slice: seeded deal, auto-advance non-player
 * seats to the player's discard turn, then one irreversible player discard.
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
    return {
      status: this.status,
      state: this.state,
      selectedTileId: this.selectedTileId,
      events: [...this.events],
      seed: this.seed,
    };
  }

  start(seed: number): void {
    const started = applyCommand(null, { type: 'StartHand', seed });
    this.seed = seed >>> 0;
    this.state = started.state;
    this.events = [...started.events];
    this.selectedTileId = null;
    this.advanceToPlayer();
    this.emit();
  }

  /** Auto-play non-player seats until the player must discard (or slice ends). */
  private advanceToPlayer(): void {
    if (!this.state) return;

    while (this.state.phase === 'awaiting_discard' && this.state.turn !== PLAYER_SEAT) {
      const drawn = ensureDrawn(this.state);
      this.state = drawn.state;
      this.events.push(...drawn.events);

      const seat = this.state.turn;
      const tileId = pickAutoDiscard(this.state, seat);
      const result = applyCommand(this.state, { type: 'Discard', seat, tileId });
      // Opponents discard as part of reaching the player; reopen the loop locally
      // because the core marks discard_complete after any discard in this slice.
      this.state = {
        ...result.state,
        phase: 'awaiting_discard',
        turn: nextSeat(seat),
      };
      this.events.push(...result.events);
    }

    if (!this.state) return;

    if (this.state.phase === 'awaiting_discard' && this.state.turn === PLAYER_SEAT) {
      const drawn = ensureDrawn(this.state);
      this.state = drawn.state;
      this.events.push(...drawn.events);
      this.status = 'awaiting_player_discard';
      return;
    }

    this.status = 'complete';
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
    this.status = 'complete';
    this.emit();
  }
}

function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}

function pickAutoDiscard(state: HandState, seat: Seat): string {
  const ids = legalDiscardTileIds(state, seat);
  const drawn = state.seats[seat].drawn;
  if (drawn && ids.includes(drawn.id)) return drawn.id;
  const first = ids[0];
  if (!first) throw new Error(`no legal discard for seat ${seat}`);
  return first;
}

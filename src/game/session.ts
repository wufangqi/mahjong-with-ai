import {
  buildSeatView,
  createEasyDecisionProvider,
  createSharedDeadline,
  decisionEquals,
  EXTERNAL_AI_DEADLINE_MS,
  listLegalActions,
  type DecisionAction,
  type DecisionProvider,
} from '../ai';
import {
  applyCommand,
  canWinOnDiscard,
  canWinOnDraw,
  createFullSet,
  ensureDrawn,
  legalClaims,
  legalDiscardTileIds,
  legalSelfActions,
  nextDealerAfterWin,
  PLAYER_SEAT,
  type ChowOption,
  type DomainEvent,
  type ExhaustiveDrawSettlement,
  type HandState,
  type PhysicalTile,
  type Seat,
  type TileCode,
  type WinSettlement,
} from '../core';

export type SessionStatus =
  | 'idle'
  | 'awaiting_player_discard'
  | 'awaiting_player_win_response'
  | 'awaiting_player_claim_response'
  | 'awaiting_ai'
  | 'exhaustive_draw'
  | 'hand_won';

export interface PlaySessionSnapshot {
  status: SessionStatus;
  state: HandState | null;
  selectedTileId: string | null;
  events: DomainEvent[];
  seed: number | null;
  settlement: ExhaustiveDrawSettlement | null;
  winSettlement: WinSettlement | null;
  /** True when the player may claim 胡 on the open discard, or self-draw 胡. */
  playerCanWin: boolean;
  playerCanKong: boolean;
  playerCanPung: boolean;
  playerChowOptions: ChowOption[];
  playerConcealedKongCodes: TileCode[];
  playerAddedKongCodes: TileCode[];
}

/**
 * Coordinates a full hand: seeded deal, opponent discards, mid-hand claim
 * windows (吃/碰/过/胡), final win-only window, then 流局 / 平胡 settlement.
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
  /** When true, every seat passes win responses (流局 auto-play helper). */
  private forcePassWins = false;
  private ai: DecisionProvider;
  private busy = false;
  private deadlineMs = EXTERNAL_AI_DEADLINE_MS;

  constructor(
    ai: DecisionProvider = createEasyDecisionProvider(),
    opts?: { deadlineMs?: number },
  ) {
    this.ai = ai;
    if (opts?.deadlineMs !== undefined) this.deadlineMs = opts.deadlineMs;
  }

  /** Replace the opponent DecisionProvider (e.g. after settings change). */
  setDecisionProvider(ai: DecisionProvider): void {
    this.ai = ai;
  }

  /** Clear the active hand (e.g. after ending a match). */
  reset(): void {
    this.status = 'idle';
    this.state = null;
    this.selectedTileId = null;
    this.events = [];
    this.seed = null;
    this.passClaims = false;
    this.forcePassWins = false;
    this.busy = false;
    this.emit();
  }

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
        : { canWin: false, canKong: false, canPung: false, chowOptions: [] as ChowOption[] };

    const self =
      this.state?.phase === 'awaiting_discard' && this.state.turn === PLAYER_SEAT
        ? legalSelfActions(this.state, PLAYER_SEAT)
        : { concealedKongCodes: [] as TileCode[], addedKongCodes: [] as TileCode[], canWin: false };

    const playerCanWinOnDiscard =
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
      winSettlement: this.state?.winSettlement ?? null,
      playerCanWin: Boolean(playerCanWinOnDiscard) || self.canWin,
      playerCanKong: claims.canKong,
      playerCanPung: claims.canPung,
      playerChowOptions: claims.chowOptions,
      playerConcealedKongCodes: self.concealedKongCodes,
      playerAddedKongCodes: self.addedKongCodes,
    };
  }

  async start(seed: number, dealer?: Seat): Promise<void> {
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
    this.forcePassWins = false;
    await this.advance();
    this.emit();
  }

  /** After 流局, start the next hand with the same dealer. */
  async startNextHand(seed: number): Promise<void> {
    if (!this.state) throw new Error('no hand in progress');

    if (this.state.phase === 'exhaustive_draw') {
      await this.start(seed, this.state.dealer);
      return;
    }

    if (this.state.phase === 'hand_won' && this.state.winSettlement) {
      const nextDealer = nextDealerFromSettlement(this.state.winSettlement);
      await this.start(seed, nextDealer);
      return;
    }

    throw new Error('next hand is only available after settlement');
  }

  /**
   * Auto-advance non-player seats (and lock AI claim/win responses) until the
   * player must act or the hand ends. AI choices are locked without applying
   * melds until every pending seat has answered.
   */
  private async advance(): Promise<void> {
    if (!this.state || this.busy) return;
    this.busy = true;
    try {
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
          await this.resolveOpponentWinResponses();
          if (!this.state) return;
          if (this.state.phase !== 'awaiting_win_response' || !this.state.responseWindow) {
            continue;
          }
          const pending = this.state.responseWindow.pending;
          if (!pending.includes(PLAYER_SEAT)) {
            continue;
          }
          const tileCode = this.state.responseWindow.tile.code;
          if (this.forcePassWins || !canWinOnDiscard(this.state, PLAYER_SEAT, tileCode)) {
            const result = applyCommand(this.state, { type: 'Pass', seat: PLAYER_SEAT });
            this.state = result.state;
            this.events.push(...result.events);
            continue;
          }
          this.status = 'awaiting_player_win_response';
          return;
        }

        if (this.state.phase === 'awaiting_claim_response') {
          await this.lockOpponentClaimResponses();
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
          this.status = 'awaiting_ai';
          this.emit();
          const { signal, cancel } = createSharedDeadline(this.deadlineMs);
          try {
            const action = await this.chooseAiAction(seat, signal);
            this.applyAiAction(seat, action);
          } finally {
            cancel();
          }
          continue;
        }

        throw new Error(`unexpected phase ${this.state.phase}`);
      }

      throw new Error('session deadlock: advance exceeded guard');
    } finally {
      this.busy = false;
    }
  }

  private async resolveOpponentWinResponses(): Promise<void> {
    if (!this.state || this.state.phase !== 'awaiting_win_response' || !this.state.responseWindow) {
      return;
    }

    const pending = [...this.state.responseWindow.pending].filter((seat) => seat !== PLAYER_SEAT);
    if (pending.length === 0) return;

    this.status = 'awaiting_ai';
    this.emit();

    const choices: Array<{ seat: Seat; action: DecisionAction }> = [];
    if (this.forcePassWins) {
      for (const seat of pending) {
        choices.push({ seat, action: { type: 'Pass' } });
      }
    } else {
      const { signal, cancel } = createSharedDeadline(this.deadlineMs);
      try {
        const settled = await Promise.all(
          pending.map(async (seat) => ({
            seat,
            action: await this.chooseAiAction(seat, signal),
          })),
        );
        choices.push(...settled);
      } finally {
        cancel();
      }
    }

    for (const { seat, action } of choices) {
      if (!this.state || this.state.phase !== 'awaiting_win_response') return;
      const window = this.state.responseWindow;
      if (!window || !window.pending.includes(seat)) continue;
      this.applyAiAction(seat, action);
    }
  }

  /** Lock AI claim choices without revealing them in the UI. */
  private async lockOpponentClaimResponses(): Promise<void> {
    if (!this.state || this.state.phase !== 'awaiting_claim_response' || !this.state.responseWindow) {
      return;
    }

    const pending = [...this.state.responseWindow.pending].filter((seat) => seat !== PLAYER_SEAT);
    if (pending.length === 0) return;

    this.status = 'awaiting_ai';
    this.emit();

    const choices: Array<{ seat: Seat; action: DecisionAction }> = [];
    if (this.passClaims) {
      for (const seat of pending) {
        choices.push({ seat, action: { type: 'Pass' } });
      }
    } else {
      const { signal, cancel } = createSharedDeadline(this.deadlineMs);
      try {
        const settled = await Promise.all(
          pending.map(async (seat) => ({
            seat,
            action: await this.chooseAiAction(seat, signal),
          })),
        );
        choices.push(...settled);
      } finally {
        cancel();
      }
    }

    for (const { seat, action } of choices) {
      if (!this.state || this.state.phase !== 'awaiting_claim_response') return;
      const window = this.state.responseWindow;
      if (!window || !window.pending.includes(seat)) continue;
      this.applyAiAction(seat, action);
    }
  }

  private async chooseAiAction(seat: Seat, signal?: AbortSignal): Promise<DecisionAction> {
    if (!this.state) throw new Error('no hand');
    let legal = listLegalActions(this.state, seat);
    if (this.forcePassWins) {
      legal = legal.filter((a) => a.type !== 'ClaimWin' && a.type !== 'DeclareWin');
    }
    if (this.passClaims) {
      legal = legal.filter(
        (a) =>
          a.type !== 'ClaimKong' &&
          a.type !== 'ClaimPung' &&
          a.type !== 'ClaimChow' &&
          a.type !== 'DeclareConcealedKong' &&
          a.type !== 'DeclareAddedKong',
      );
    }
    if (legal.length === 0) {
      legal = [{ type: 'Pass' }];
    }
    return this.ai.choose(buildSeatView(this.state, seat), legal, { signal });
  }

  private applyAiAction(seat: Seat, action: DecisionAction): void {
    if (!this.state) return;
    const legal = listLegalActions(this.state, seat);
    if (!legal.some((a) => decisionEquals(a, action))) {
      throw new Error(`AI returned illegal action for seat ${seat}: ${action.type}`);
    }

    let result;
    switch (action.type) {
      case 'Discard':
        result = applyCommand(this.state, { type: 'Discard', seat, tileId: action.tileId });
        break;
      case 'DeclareWin':
        result = applyCommand(this.state, { type: 'DeclareWin', seat });
        break;
      case 'DeclareConcealedKong':
        result = applyCommand(this.state, {
          type: 'DeclareConcealedKong',
          seat,
          code: action.code,
        });
        break;
      case 'DeclareAddedKong':
        result = applyCommand(this.state, { type: 'DeclareAddedKong', seat, code: action.code });
        break;
      case 'ClaimWin':
        result = applyCommand(this.state, { type: 'ClaimWin', seat });
        break;
      case 'ClaimKong':
        result = applyCommand(this.state, { type: 'ClaimKong', seat });
        break;
      case 'ClaimPung':
        result = applyCommand(this.state, { type: 'ClaimPung', seat });
        break;
      case 'ClaimChow':
        result = applyCommand(this.state, { type: 'ClaimChow', seat, tileIds: action.tileIds });
        break;
      case 'Pass':
        result = applyCommand(this.state, { type: 'Pass', seat });
        break;
      default: {
        const _exhaustive: never = action;
        throw new Error(`unhandled AI action ${JSON.stringify(_exhaustive)}`);
      }
    }
    this.state = result.state;
    this.events.push(...result.events);
  }

  selectTile(tileId: string): void {
    if (this.busy || this.status !== 'awaiting_player_discard' || !this.state) return;
    const legal = legalDiscardTileIds(this.state, PLAYER_SEAT);
    if (!legal.includes(tileId)) return;
    this.selectedTileId = tileId;
    this.emit();
  }

  /** Second click on the selected tile confirms discard. */
  async clickTile(tileId: string): Promise<void> {
    if (this.busy || this.status !== 'awaiting_player_discard' || !this.state) return;
    const legal = legalDiscardTileIds(this.state, PLAYER_SEAT);
    if (!legal.includes(tileId)) return;

    if (this.selectedTileId === tileId) {
      await this.confirmDiscard(tileId);
      return;
    }
    this.selectedTileId = tileId;
    this.emit();
  }

  /** Drag-into-river confirmation. */
  async discardByDrag(tileId: string): Promise<void> {
    await this.confirmDiscard(tileId);
  }

  private async confirmDiscard(tileId: string): Promise<void> {
    if (this.busy || this.status !== 'awaiting_player_discard' || !this.state) return;
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
    await this.advance();
    this.emit();
  }

  async claimWin(): Promise<void> {
    if (this.busy || !this.state) return;

    if (this.status === 'awaiting_player_discard' && canWinOnDraw(this.state, PLAYER_SEAT)) {
      const result = applyCommand(this.state, { type: 'DeclareWin', seat: PLAYER_SEAT });
      this.state = result.state;
      this.events.push(...result.events);
      this.selectedTileId = null;
      await this.advance();
      this.emit();
      return;
    }

    if (
      this.status !== 'awaiting_player_win_response' &&
      this.status !== 'awaiting_player_claim_response'
    ) {
      return;
    }
    const result = applyCommand(this.state, { type: 'ClaimWin', seat: PLAYER_SEAT });
    this.state = result.state;
    this.events.push(...result.events);
    await this.advance();
    this.emit();
  }

  async claimKong(): Promise<void> {
    if (this.busy || this.status !== 'awaiting_player_claim_response' || !this.state) return;
    const result = applyCommand(this.state, { type: 'ClaimKong', seat: PLAYER_SEAT });
    this.state = result.state;
    this.events.push(...result.events);
    await this.advance();
    this.emit();
  }

  async declareConcealedKong(code: TileCode): Promise<void> {
    if (this.busy || this.status !== 'awaiting_player_discard' || !this.state) return;
    const result = applyCommand(this.state, {
      type: 'DeclareConcealedKong',
      seat: PLAYER_SEAT,
      code,
    });
    this.state = result.state;
    this.events.push(...result.events);
    this.selectedTileId = null;
    await this.advance();
    this.emit();
  }

  async declareAddedKong(code: TileCode): Promise<void> {
    if (this.busy || this.status !== 'awaiting_player_discard' || !this.state) return;
    const result = applyCommand(this.state, {
      type: 'DeclareAddedKong',
      seat: PLAYER_SEAT,
      code,
    });
    this.state = result.state;
    this.events.push(...result.events);
    this.selectedTileId = null;
    await this.advance();
    this.emit();
  }

  async claimPung(): Promise<void> {
    if (this.busy || this.status !== 'awaiting_player_claim_response' || !this.state) return;
    const result = applyCommand(this.state, { type: 'ClaimPung', seat: PLAYER_SEAT });
    this.state = result.state;
    this.events.push(...result.events);
    await this.advance();
    this.emit();
  }

  async claimChow(tileIds: [string, string]): Promise<void> {
    if (this.busy || this.status !== 'awaiting_player_claim_response' || !this.state) return;
    const result = applyCommand(this.state, {
      type: 'ClaimChow',
      seat: PLAYER_SEAT,
      tileIds,
    });
    this.state = result.state;
    this.events.push(...result.events);
    await this.advance();
    this.emit();
  }

  async passResponse(): Promise<void> {
    if (
      this.busy ||
      (this.status !== 'awaiting_player_win_response' &&
        this.status !== 'awaiting_player_claim_response') ||
      !this.state
    ) {
      return;
    }
    const result = applyCommand(this.state, { type: 'Pass', seat: PLAYER_SEAT });
    this.state = result.state;
    this.events.push(...result.events);
    await this.advance();
    this.emit();
  }

  /** @deprecated use passResponse */
  async passWin(): Promise<void> {
    await this.passResponse();
  }

  /**
   * Test / e2e helper: discard the player's first legal tile and pass all claim
   * / win windows until 流局 (mid-hand 胡 must not end the demo).
   */
  async autoPlayPlayerFirstLegal(maxSteps = 400): Promise<void> {
    this.passClaims = true;
    this.forcePassWins = true;
    try {
      for (let i = 0; i < maxSteps; i++) {
        if (this.status === 'awaiting_player_discard' && this.state) {
          const tileId = pickAutoDiscard(this.state, PLAYER_SEAT);
          await this.confirmDiscard(tileId);
          continue;
        }
        if (this.status === 'awaiting_player_claim_response') {
          await this.passResponse();
          continue;
        }
        if (this.status === 'awaiting_player_win_response') {
          await this.passResponse();
          continue;
        }
        return;
      }
      throw new Error('autoPlayPlayerFirstLegal exceeded max steps');
    } finally {
      this.passClaims = false;
      this.forcePassWins = false;
    }
  }

  /**
   * Demo / e2e: load a mid-hand position where the player can 平胡 on the open
   * discard (seat 1 just discarded m1).
   */
  loadPinghuWinDemo(): void {
    const state = buildPlayerPinghuResponseState();
    this.seed = state.seed;
    this.state = state;
    this.events = [{ type: 'WinResponseOpened', discarder: state.responseWindow!.discarder, tile: state.responseWindow!.tile }];
    this.selectedTileId = null;
    this.status = 'awaiting_player_win_response';
    this.emit();
  }
}

function nextDealerFromSettlement(settlement: WinSettlement): Seat {
  return nextDealerAfterWin(
    settlement.winners.map((w) => w.seat),
    settlement.discarder,
  );
}

function takeFromPool(pool: PhysicalTile[], code: TileCode): PhysicalTile {
  const index = pool.findIndex((t) => t.code === code);
  if (index < 0) throw new Error(`missing ${code} in pool`);
  return pool.splice(index, 1)[0]!;
}

/** Player (seat 0) is ready on m1; seat 1 has just discarded it. */
function buildPlayerPinghuResponseState(): HandState {
  const pool = createFullSet();
  const winning = takeFromPool(pool, 'm1');
  const seat0Hand = (
    ['m2', 'm3', 'm4', 'm5', 'm6', 'p2', 'p2', 'p2', 's7', 's8', 's9', 'E', 'E'] as TileCode[]
  ).map((code) => takeFromPool(pool, code));

  const seats: HandState['seats'] = [
    { hand: seat0Hand, drawn: null, river: [], melds: [] },
    { hand: pool.splice(0, 13), drawn: null, river: [winning], melds: [] },
    { hand: pool.splice(0, 13), drawn: null, river: [], melds: [] },
    { hand: pool.splice(0, 13), drawn: null, river: [], melds: [] },
  ];

  return {
    schemaVersion: 1,
    ruleSetId: 'shuanghu-v1',
    seed: 5301,
    rngState: 1,
    dealer: 1,
    turn: 1,
    phase: 'awaiting_win_response',
    wall: pool,
    seats,
    responseWindow: {
      mode: 'win_only',
      discarder: 1,
      tile: winning,
      // Demo only needs the player seat; other seats are not pending responders.
      pending: [0],
      locked: {},
      winners: [],
    },
    settlement: null,
    winSettlement: null,
    lastDrawKind: null,
  };
}

function pickAutoDiscard(state: HandState, seat: Seat): string {
  const ids = legalDiscardTileIds(state, seat);
  const drawn = state.seats[seat].drawn;
  if (drawn && ids.includes(drawn.id)) return drawn.id;
  const first = ids[0];
  if (!first) throw new Error(`no legal discard for seat ${seat}`);
  return first;
}

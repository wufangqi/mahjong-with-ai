import {
  buildSeatView,
  createEasyDecisionProvider,
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
  type Command,
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
  /** Final legal commands applied this match (player + AI); used for 存档 / replay. */
  private actionLog: Command[] = [];
  private listeners = new Set<() => void>();
  /** When true, AI always passes meld claims (used by autoplay 流局 demos). */
  private passClaims = false;
  /** When true, every seat passes win responses (流局 auto-play helper). */
  private forcePassWins = false;
  private readonly ai: DecisionProvider;

  constructor(ai: DecisionProvider = createEasyDecisionProvider()) {
    this.ai = ai;
  }

  /** Clear the active hand (e.g. after ending a match). */
  reset(): void {
    this.status = 'idle';
    this.state = null;
    this.selectedTileId = null;
    this.events = [];
    this.seed = null;
    this.actionLog = [];
    this.passClaims = false;
    this.forcePassWins = false;
    this.emit();
  }

  getActionLog(): readonly Command[] {
    return this.actionLog;
  }

  /**
   * Restore a persisted hand without re-running AI (continue 存档).
   * Caller must supply a stable post-action status.
   */
  restore(input: {
    state: HandState;
    status: SessionStatus;
    seed: number;
    selectedTileId?: string | null;
    actionLog?: readonly Command[];
    events?: readonly DomainEvent[];
  }): void {
    this.state = structuredClone(input.state);
    this.status = input.status;
    this.seed = input.seed >>> 0;
    this.selectedTileId = input.selectedTileId ?? null;
    this.actionLog = input.actionLog ? structuredClone(input.actionLog as Command[]) : [];
    this.events = input.events ? structuredClone(input.events as DomainEvent[]) : [];
    this.passClaims = false;
    this.forcePassWins = false;
    this.emit();
  }

  /** Apply a core command, append to the action log, and return domain events. */
  private commit(command: Command): DomainEvent[] {
    const result = applyCommand(this.state, command);
    this.state = result.state;
    this.events.push(...result.events);
    this.actionLog.push(structuredClone(command));
    return result.events;
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

  start(seed: number, dealer?: Seat): void {
    const command: Command = {
      type: 'StartHand',
      seed: seed >>> 0,
      ...(dealer !== undefined ? { dealer } : {}),
    };
    const started = applyCommand(null, command);
    this.seed = seed >>> 0;
    this.state = started.state;
    this.events = [...started.events];
    // Log the same StartHand shape used at runtime: omit dealer when it was
    // rolled from the seed so replay consumes the same RNG draw.
    this.actionLog.push(
      dealer !== undefined
        ? { type: 'StartHand', seed: seed >>> 0, dealer }
        : { type: 'StartHand', seed: seed >>> 0 },
    );
    this.selectedTileId = null;
    this.passClaims = false;
    this.forcePassWins = false;
    this.advance();
    this.emit();
  }

  /** After 流局, start the next hand with the same dealer. */
  startNextHand(seed: number): void {
    if (!this.state) throw new Error('no hand in progress');

    if (this.state.phase === 'exhaustive_draw') {
      this.start(seed, this.state.dealer);
      return;
    }

    if (this.state.phase === 'hand_won' && this.state.winSettlement) {
      const nextDealer = nextDealerFromSettlement(this.state.winSettlement);
      this.start(seed, nextDealer);
      return;
    }

    throw new Error('next hand is only available after settlement');
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
        if (this.forcePassWins || !canWinOnDiscard(this.state, PLAYER_SEAT, tileCode)) {
          this.commit({ type: 'Pass', seat: PLAYER_SEAT });
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
        const action = this.chooseAiAction(seat);
        this.applyAiAction(seat, action);
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
      const action = this.forcePassWins
        ? ({ type: 'Pass' } as const)
        : this.chooseAiAction(seat);
      this.applyAiAction(seat, action);
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

      const action = this.passClaims ? ({ type: 'Pass' } as const) : this.chooseAiAction(seat);
      this.applyAiAction(seat, action);
      if (!this.state || this.state.phase !== 'awaiting_claim_response') return;
    }
  }

  private chooseAiAction(seat: Seat): DecisionAction {
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
    return this.ai.choose(buildSeatView(this.state, seat), legal);
  }

  private applyAiAction(seat: Seat, action: DecisionAction): void {
    if (!this.state) return;
    const legal = listLegalActions(this.state, seat);
    if (!legal.some((a) => decisionEquals(a, action))) {
      throw new Error(`AI returned illegal action for seat ${seat}: ${action.type}`);
    }

    switch (action.type) {
      case 'Discard':
        this.commit({ type: 'Discard', seat, tileId: action.tileId });
        break;
      case 'DeclareWin':
        this.commit({ type: 'DeclareWin', seat });
        break;
      case 'DeclareConcealedKong':
        this.commit({ type: 'DeclareConcealedKong', seat, code: action.code });
        break;
      case 'DeclareAddedKong':
        this.commit({ type: 'DeclareAddedKong', seat, code: action.code });
        break;
      case 'ClaimWin':
        this.commit({ type: 'ClaimWin', seat });
        break;
      case 'ClaimKong':
        this.commit({ type: 'ClaimKong', seat });
        break;
      case 'ClaimPung':
        this.commit({ type: 'ClaimPung', seat });
        break;
      case 'ClaimChow':
        this.commit({ type: 'ClaimChow', seat, tileIds: action.tileIds });
        break;
      case 'Pass':
        this.commit({ type: 'Pass', seat });
        break;
      default: {
        const _exhaustive: never = action;
        throw new Error(`unhandled AI action ${JSON.stringify(_exhaustive)}`);
      }
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

    this.commit({ type: 'Discard', seat: PLAYER_SEAT, tileId });
    this.selectedTileId = null;
    this.advance();
    this.emit();
  }

  claimWin(): void {
    if (!this.state) return;

    if (this.status === 'awaiting_player_discard' && canWinOnDraw(this.state, PLAYER_SEAT)) {
      this.commit({ type: 'DeclareWin', seat: PLAYER_SEAT });
      this.selectedTileId = null;
      this.advance();
      this.emit();
      return;
    }

    if (
      this.status !== 'awaiting_player_win_response' &&
      this.status !== 'awaiting_player_claim_response'
    ) {
      return;
    }
    this.commit({ type: 'ClaimWin', seat: PLAYER_SEAT });
    this.advance();
    this.emit();
  }

  claimKong(): void {
    if (this.status !== 'awaiting_player_claim_response' || !this.state) return;
    this.commit({ type: 'ClaimKong', seat: PLAYER_SEAT });
    this.advance();
    this.emit();
  }

  declareConcealedKong(code: TileCode): void {
    if (this.status !== 'awaiting_player_discard' || !this.state) return;
    this.commit({ type: 'DeclareConcealedKong', seat: PLAYER_SEAT, code });
    this.selectedTileId = null;
    this.advance();
    this.emit();
  }

  declareAddedKong(code: TileCode): void {
    if (this.status !== 'awaiting_player_discard' || !this.state) return;
    this.commit({ type: 'DeclareAddedKong', seat: PLAYER_SEAT, code });
    this.selectedTileId = null;
    this.advance();
    this.emit();
  }

  claimPung(): void {
    if (this.status !== 'awaiting_player_claim_response' || !this.state) return;
    this.commit({ type: 'ClaimPung', seat: PLAYER_SEAT });
    this.advance();
    this.emit();
  }

  claimChow(tileIds: [string, string]): void {
    if (this.status !== 'awaiting_player_claim_response' || !this.state) return;
    this.commit({ type: 'ClaimChow', seat: PLAYER_SEAT, tileIds });
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
    this.commit({ type: 'Pass', seat: PLAYER_SEAT });
    this.advance();
    this.emit();
  }

  /** @deprecated use passResponse */
  passWin(): void {
    this.passResponse();
  }

  /**
   * Test / e2e helper: discard the player's first legal tile and pass all claim
   * / win windows until 流局 (mid-hand 胡 must not end the demo).
   */
  autoPlayPlayerFirstLegal(maxSteps = 400): void {
    this.passClaims = true;
    this.forcePassWins = true;
    try {
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

function decisionEquals(a: DecisionAction, b: DecisionAction): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'Discard':
      return b.type === 'Discard' && a.tileId === b.tileId;
    case 'DeclareConcealedKong':
    case 'DeclareAddedKong':
      return (
        (b.type === 'DeclareConcealedKong' || b.type === 'DeclareAddedKong') &&
        b.type === a.type &&
        a.code === b.code
      );
    case 'ClaimChow':
      return (
        b.type === 'ClaimChow' && a.tileIds[0] === b.tileIds[0] && a.tileIds[1] === b.tileIds[1]
      );
    default:
      return true;
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

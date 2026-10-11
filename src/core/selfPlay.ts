import { buildSeatView, decisionEquals, listLegalActions } from '../ai';
import type { DecisionAction, SeatVisibleState } from '../ai';
import { applyCommand, ensureDrawn, totalTileCount } from './hand';
import { FULL_SET_SIZE } from './tiles';
import type { Command, HandState, Seat } from './types';

export type SelfPlayTerminal = 'hand_won' | 'exhaustive_draw';

export type SelfPlayHandOk = {
  ok: true;
  seed: number;
  terminal: SelfPlayTerminal;
  steps: number;
  tileCount: number;
  actionLog: Command[];
};

export type SelfPlayHandFail = {
  ok: false;
  seed: number;
  reason: string;
  actionLog: Command[];
};

export type SelfPlayHandResult = SelfPlayHandOk | SelfPlayHandFail;

const MAX_STEPS = 800;

/** Sync mirror of built-in easy priorities (wins → kong → pung/chow → discard). */
function chooseEasy(view: SeatVisibleState, legalActions: readonly DecisionAction[]): DecisionAction {
  if (legalActions.length === 0) {
    throw new Error(`easy: no legal actions for seat ${view.seat}`);
  }
  const win = legalActions.find((a) => a.type === 'ClaimWin' || a.type === 'DeclareWin');
  if (win) return win;
  const concealed = legalActions.find((a) => a.type === 'DeclareConcealedKong');
  if (concealed) return concealed;
  const added = legalActions.find((a) => a.type === 'DeclareAddedKong');
  if (added) return added;
  const kong = legalActions.find((a) => a.type === 'ClaimKong');
  if (kong) return kong;
  const pung = legalActions.find((a) => a.type === 'ClaimPung');
  if (pung) return pung;
  const chow = legalActions.find((a) => a.type === 'ClaimChow');
  if (chow) return chow;
  if (view.drawn) {
    const drawnDiscard = legalActions.find(
      (a) => a.type === 'Discard' && a.tileId === view.drawn!.id,
    );
    if (drawnDiscard) return drawnDiscard;
  }
  const discard = legalActions.find((a) => a.type === 'Discard');
  if (discard) return discard;
  const pass = legalActions.find((a) => a.type === 'Pass');
  if (pass) return pass;
  return legalActions[0]!;
}

function uniqueTileIds(state: HandState): boolean {
  const ids = new Set<string>();
  const push = (tile: { id: string } | null | undefined): boolean => {
    if (!tile) return true;
    if (ids.has(tile.id)) return false;
    ids.add(tile.id);
    return true;
  };
  for (const tile of state.wall) {
    if (!push(tile)) return false;
  }
  for (const seat of state.seats) {
    for (const tile of seat.hand) {
      if (!push(tile)) return false;
    }
    if (!push(seat.drawn)) return false;
    for (const tile of seat.river) {
      if (!push(tile)) return false;
    }
    for (const meld of seat.melds) {
      for (const tile of meld.tiles) {
        if (!push(tile)) return false;
      }
    }
  }
  return ids.size === FULL_SET_SIZE;
}

function assertInvariants(state: HandState): string | null {
  const count = totalTileCount(state);
  if (count !== FULL_SET_SIZE) {
    return `tile conservation broken: ${count} !== ${FULL_SET_SIZE}`;
  }
  if (!uniqueTileIds(state)) {
    return 'physical tile ids are not unique / complete';
  }
  return null;
}

function decisionToCommand(seat: Seat, action: DecisionAction): Command {
  switch (action.type) {
    case 'Discard':
      return { type: 'Discard', seat, tileId: action.tileId };
    case 'DeclareWin':
      return { type: 'DeclareWin', seat };
    case 'DeclareConcealedKong':
      return { type: 'DeclareConcealedKong', seat, code: action.code };
    case 'DeclareAddedKong':
      return { type: 'DeclareAddedKong', seat, code: action.code };
    case 'ClaimWin':
      return { type: 'ClaimWin', seat };
    case 'ClaimKong':
      return { type: 'ClaimKong', seat };
    case 'ClaimPung':
      return { type: 'ClaimPung', seat };
    case 'ClaimChow':
      return { type: 'ClaimChow', seat, tileIds: action.tileIds };
    case 'Pass':
      return { type: 'Pass', seat };
    default: {
      const _exhaustive: never = action;
      throw new Error(`unhandled action ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Seeded all-AI self-play for one hand. Uses the built-in easy DecisionProvider
 * against `listLegalActions` and checks conservation / unique tiles / terminal.
 */
export function runSelfPlayHand(seed: number): SelfPlayHandResult {
  const actionLog: Command[] = [{ type: 'StartHand', seed: seed >>> 0 }];
  let state: HandState;
  try {
    state = applyCommand(null, actionLog[0]!).state;
  } catch (err) {
    return {
      ok: false,
      seed: seed >>> 0,
      reason: err instanceof Error ? err.message : String(err),
      actionLog,
    };
  }

  const invariant = assertInvariants(state);
  if (invariant) {
    return { ok: false, seed: seed >>> 0, reason: invariant, actionLog };
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    if (state.phase === 'hand_won' || state.phase === 'exhaustive_draw') {
      const terminals = [state.phase === 'hand_won', state.phase === 'exhaustive_draw'].filter(
        Boolean,
      ).length;
      if (terminals !== 1) {
        return {
          ok: false,
          seed: seed >>> 0,
          reason: `expected exactly one terminal, phase=${state.phase}`,
          actionLog,
        };
      }
      const endInvariant = assertInvariants(state);
      if (endInvariant) {
        return { ok: false, seed: seed >>> 0, reason: endInvariant, actionLog };
      }
      return {
        ok: true,
        seed: seed >>> 0,
        terminal: state.phase,
        steps: step,
        tileCount: totalTileCount(state),
        actionLog,
      };
    }

    try {
      if (state.phase === 'awaiting_discard') {
        const drawn = ensureDrawn(state);
        state = drawn.state;
        const seat = state.turn;
        const legal = listLegalActions(state, seat);
        if (legal.length === 0) {
          return {
            ok: false,
            seed: seed >>> 0,
            reason: `no legal actions for seat ${seat} in awaiting_discard`,
            actionLog,
          };
        }
        const chosen = chooseEasy(buildSeatView(state, seat), legal);
        const command = decisionToCommand(seat, chosen);
        const result = applyCommand(state, command);
        state = result.state;
        actionLog.push(command);
      } else if (
        state.phase === 'awaiting_win_response' ||
        state.phase === 'awaiting_claim_response'
      ) {
        const pending = state.responseWindow?.pending ?? [];
        if (pending.length === 0) {
          return {
            ok: false,
            seed: seed >>> 0,
            reason: `empty pending in ${state.phase}`,
            actionLog,
          };
        }
        // Resolve every currently pending seat once (parallel choice, serial apply).
        const seats = [...pending];
        const choices: Array<{ seat: Seat; action: DecisionAction }> = [];
        for (const seat of seats) {
          const legal = listLegalActions(state, seat);
          if (legal.length === 0) {
            return {
              ok: false,
              seed: seed >>> 0,
              reason: `no legal actions for seat ${seat} in ${state.phase}`,
              actionLog,
            };
          }
          choices.push({ seat, action: chooseEasy(buildSeatView(state, seat), legal) });
        }
        for (const { seat, action } of choices) {
          if (
            state.phase !== 'awaiting_win_response' &&
            state.phase !== 'awaiting_claim_response'
          ) {
            break;
          }
          if (!state.responseWindow?.pending.includes(seat)) continue;
          const legal = listLegalActions(state, seat);
          if (!legal.some((a) => decisionEquals(a, action))) continue;
          const command = decisionToCommand(seat, action);
          const result = applyCommand(state, command);
          state = result.state;
          actionLog.push(command);
        }
      } else {
        return {
          ok: false,
          seed: seed >>> 0,
          reason: `unexpected phase ${state.phase}`,
          actionLog,
        };
      }
    } catch (err) {
      return {
        ok: false,
        seed: seed >>> 0,
        reason: err instanceof Error ? err.message : String(err),
        actionLog,
      };
    }

    const midInvariant = assertInvariants(state);
    if (midInvariant) {
      return { ok: false, seed: seed >>> 0, reason: midInvariant, actionLog };
    }
  }

  return {
    ok: false,
    seed: seed >>> 0,
    reason: `deadlock: exceeded ${MAX_STEPS} steps (phase=${state.phase})`,
    actionLog,
  };
}

export type SelfPlayBatchOk = {
  ok: true;
  completed: number;
  wins: number;
  draws: number;
};

export type SelfPlayBatchFail = {
  ok: false;
  completed: number;
  failure: SelfPlayHandFail;
};

export type SelfPlayBatchResult = SelfPlayBatchOk | SelfPlayBatchFail;

/** Run `hands` consecutive seeds starting at `startSeed`. */
export function runSelfPlayBatch(opts: {
  hands: number;
  startSeed: number;
}): SelfPlayBatchResult {
  let wins = 0;
  let draws = 0;
  for (let i = 0; i < opts.hands; i++) {
    const seed = (opts.startSeed + i) >>> 0;
    const result = runSelfPlayHand(seed);
    if (!result.ok) {
      return { ok: false, completed: i, failure: result };
    }
    if (result.terminal === 'hand_won') wins += 1;
    else draws += 1;
  }
  return { ok: true, completed: opts.hands, wins, draws };
}

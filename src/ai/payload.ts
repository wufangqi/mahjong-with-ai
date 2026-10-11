import type { DecisionAction, SeatVisibleState } from './types';

/** Fields an external AI request may include (ADR-0005). */
export const EXTERNAL_AI_SENT_FIELDS = [
  'seat',
  'dealer',
  'turn',
  'phase',
  'wallRemaining',
  'hand',
  'drawn',
  'publicSeats',
  'responseTile',
  'discarder',
  'legalActions',
] as const;

/** Fields that must never leave the client in an external AI request. */
export const EXTERNAL_AI_WITHHELD_FIELDS = [
  'otherHands',
  'wall',
  'wallOrder',
  'seed',
  'rngState',
  'providerApiKey',
] as const;

export type ExternalAiRequestPayload = {
  seat: SeatVisibleState['seat'];
  dealer: SeatVisibleState['dealer'];
  turn: SeatVisibleState['turn'];
  phase: SeatVisibleState['phase'];
  wallRemaining: number;
  hand: SeatVisibleState['hand'];
  drawn: SeatVisibleState['drawn'];
  publicSeats: SeatVisibleState['publicSeats'];
  responseTile: SeatVisibleState['responseTile'];
  discarder: SeatVisibleState['discarder'];
  legalActions: DecisionAction[];
};

/** Build the only JSON body sent to an OpenAI-compatible proxy. */
export function buildExternalPayload(
  view: SeatVisibleState,
  legalActions: readonly DecisionAction[],
): ExternalAiRequestPayload {
  return {
    seat: view.seat,
    dealer: view.dealer,
    turn: view.turn,
    phase: view.phase,
    wallRemaining: view.wallRemaining,
    hand: view.hand.map((t) => ({ ...t })),
    drawn: view.drawn ? { ...view.drawn } : null,
    publicSeats: {
      0: clonePublic(view.publicSeats[0]),
      1: clonePublic(view.publicSeats[1]),
      2: clonePublic(view.publicSeats[2]),
      3: clonePublic(view.publicSeats[3]),
    },
    responseTile: view.responseTile ? { ...view.responseTile } : null,
    discarder: view.discarder,
    legalActions: legalActions.map((a) => ({ ...a })),
  };
}

function clonePublic(info: SeatVisibleState['publicSeats'][0]): SeatVisibleState['publicSeats'][0] {
  return {
    river: info.river.map((t) => ({ ...t })),
    melds: info.melds.map((m) => ({
      ...m,
      tiles: m.tiles.map((t) => ({ ...t })),
    })),
    concealedCount: info.concealedCount,
  };
}

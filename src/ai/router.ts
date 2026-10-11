import type { Seat } from '../core';
import type { OpponentSource } from './config';
import { isOpponentSeat } from './config';
import { createEasyDecisionProvider } from './easy';
import type { DecisionProvider } from './types';

export interface SeatRoutedDecisionProviderOptions {
  seatSources: Record<1 | 2 | 3, OpponentSource>;
  easy?: DecisionProvider;
  external: DecisionProvider;
}

/**
 * Routes each opponent seat to built-in easy or the shared external provider.
 * Player seat (0) should not be queried; if it is, easy is used as a safe default.
 */
export function createSeatRoutedDecisionProvider(
  options: SeatRoutedDecisionProviderOptions,
): DecisionProvider {
  const easy = options.easy ?? createEasyDecisionProvider();
  return {
    choose(view, legalActions, opts) {
      const seat = view.seat as Seat;
      if (!isOpponentSeat(seat) || options.seatSources[seat] !== 'external') {
        return easy.choose(view, legalActions, opts);
      }
      return options.external.choose(view, legalActions, opts);
    },
  };
}

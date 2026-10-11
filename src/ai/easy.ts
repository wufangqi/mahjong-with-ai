import type { DecisionAction, DecisionProvider, SeatVisibleState } from './types';

/**
 * Built-in easy opponent: always wins when legal, otherwise prefers kongs,
 * then pung/chow, then discards the drawn tile (or first legal discard).
 * Chooses only from the provided legal-action list.
 */
export function createEasyDecisionProvider(): DecisionProvider {
  return {
    async choose(
      view: SeatVisibleState,
      legalActions: readonly DecisionAction[],
    ): Promise<DecisionAction> {
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
    },
  };
}

import { describe, expect, it, vi } from 'vitest';
import { applyCommand, type Seat } from '../core';
import { createEasyDecisionProvider } from './easy';
import { createSeatRoutedDecisionProvider } from './router';
import { buildSeatView, listLegalActions } from './seatView';
import type { DecisionProvider } from './types';

describe('seat-routed DecisionProvider', () => {
  it('uses easy for seats set to easy and external for seats set to external', async () => {
    const { state } = applyCommand(null, { type: 'StartHand', seed: 11, dealer: 2 as Seat });
    const view = buildSeatView(state, 2);
    const legal = listLegalActions(state, 2);
    const easyChoice = await createEasyDecisionProvider().choose(view, legal);

    const external: DecisionProvider = {
      choose: vi.fn(async () => ({ type: 'Pass' as const })),
    };
    const routed = createSeatRoutedDecisionProvider({
      seatSources: { 1: 'easy', 2: 'external', 3: 'easy' },
      external,
    });

    const fromExternalSeat = await routed.choose(view, legal);
    expect(external.choose).toHaveBeenCalledOnce();
    expect(fromExternalSeat).toEqual({ type: 'Pass' });

    const seat1View = buildSeatView(state, 1);
    const seat1Legal = [{ type: 'Pass' as const }];
    const fromEasySeat = await routed.choose(seat1View, seat1Legal);
    expect(fromEasySeat).toEqual({ type: 'Pass' });
    // External not called again for easy seat.
    expect(external.choose).toHaveBeenCalledOnce();

    // Sanity: easy path still matches built-in for a discard seat when routed to easy.
    const easyRouted = createSeatRoutedDecisionProvider({
      seatSources: { 1: 'easy', 2: 'easy', 3: 'easy' },
      external,
    });
    expect(await easyRouted.choose(view, legal)).toEqual(easyChoice);
  });
});

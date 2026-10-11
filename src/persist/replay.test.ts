import { describe, expect, it, vi } from 'vitest';
import { createEasyDecisionProvider, type DecisionProvider } from '../ai';
import { MatchSession } from '../game/match';
import { PlaySession } from '../game/session';
import { replayCommands } from './replay';

describe('replayCommands', () => {
  it('replays recorded final actions to the same terminal state without calling AI', async () => {
    const match = new MatchSession();
    await match.startMatch(42);
    await match.hand.autoPlayPlayerFirstLegal();
    const log = match.hand.getActionLog();
    expect(log.length).toBeGreaterThan(1);
    expect(log[0]).toEqual({ type: 'StartHand', seed: 42 });

    const choose = vi.fn(() => {
      throw new Error('AI must not be called during replay');
    });
    const ai: DecisionProvider = { choose };
    // Constructing a session with throwing AI must not be used by replayCommands.
    void new PlaySession(ai);

    const replayed = replayCommands(log);
    const live = match.hand.snapshot();
    expect(replayed.state.phase).toBe('exhaustive_draw');
    expect(replayed.state.phase).toBe(live.state!.phase);
    expect(replayed.state.wall.length).toBe(live.state!.wall.length);
    expect(replayed.state.rngState).toBe(live.state!.rngState);
    expect(replayed.state.dealer).toBe(live.state!.dealer);
    expect(choose).not.toHaveBeenCalled();
  });

  it('does not invoke easy DecisionProvider during command replay', async () => {
    const easy = createEasyDecisionProvider();
    const spy = vi.spyOn(easy, 'choose');
    const session = new PlaySession(easy);
    await session.start(99);
    const tileId = session.snapshot().state!.seats[0].drawn!.id;
    await session.clickTile(tileId);
    await session.clickTile(tileId);
    const log = session.getActionLog();
    spy.mockClear();

    replayCommands(log);
    expect(spy).not.toHaveBeenCalled();
  });
});

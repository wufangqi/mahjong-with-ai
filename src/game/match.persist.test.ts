import { describe, expect, it } from 'vitest';
import { MemoryPersistBackend, PersistStore } from '../persist';
import { MatchSession } from './match';

describe('MatchSession persistence', () => {
  it('saves after a completed action and continues with the same rngState', async () => {
    const store = new PersistStore({ backend: new MemoryPersistBackend() });
    const match = new MatchSession();
    match.startMatch(42);

    const before = match.snapshot();
    expect(before.hand.state?.rngState).toEqual(expect.any(Number));
    const save = match.toActiveSave();
    expect(save).not.toBeNull();
    await store.saveActive(save!);

    const loaded = await store.loadActive();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;

    const resumed = new MatchSession();
    resumed.restoreFromSave(loaded.save);
    const after = resumed.snapshot();
    expect(after.status).toBe('in_hand');
    expect(after.handIndex).toBe(1);
    expect(after.hand.state!.rngState).toBe(before.hand.state!.rngState);
    expect(after.hand.state!.seats[0].hand.map((t) => t.id)).toEqual(
      before.hand.state!.seats[0].hand.map((t) => t.id),
    );
    expect(after.hand.status).toBe(before.hand.status);
  });

  it('clears the active save when the match ends and archives the action log', async () => {
    const store = new PersistStore({
      backend: new MemoryPersistBackend(),
      now: () => 123,
      randomId: () => 'log-1',
    });
    const match = new MatchSession();
    match.startMatch(42);
    match.hand.autoPlayPlayerFirstLegal();
    const meta = match.archiveMeta();
    expect(meta?.actionLog.length).toBeGreaterThan(1);

    await store.archiveGameLog({
      matchSeed: meta!.matchSeed,
      handCount: meta!.handCount,
      actionLog: [...meta!.actionLog],
      finalHandState: meta!.finalHandState,
    });
    await store.clearActive();
    match.endMatch();

    expect((await store.loadActive()).status).toBe('empty');
    expect(match.snapshot().status).toBe('menu');
    const logs = await store.listGameLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]!.actionLog[0]).toEqual({ type: 'StartHand', seed: 42 });
  });
});

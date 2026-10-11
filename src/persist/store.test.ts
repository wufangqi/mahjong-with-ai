import { describe, expect, it } from 'vitest';
import { applyCommand } from '../core';
import { MemoryPersistBackend } from './backend';
import { PersistStore } from './store';
import { MAX_GAME_LOGS } from './types';

function handState(seed = 42) {
  return applyCommand(null, { type: 'StartHand', seed }).state;
}

describe('PersistStore', () => {
  it('saves and reloads an active snapshot with schemaVersion and rngState', async () => {
    const store = new PersistStore({ backend: new MemoryPersistBackend(), now: () => 1000 });
    const state = handState(42);
    await store.saveActive({
      match: { status: 'in_hand', handIndex: 1, matchSeed: 42 },
      sessionStatus: 'awaiting_player_discard',
      handState: state,
      selectedTileId: null,
      actionLog: [{ type: 'StartHand', seed: 42 }],
    });

    const loaded = await store.loadActive();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.save.schemaVersion).toBe(1);
    expect(loaded.save.handState.schemaVersion).toBe(1);
    expect(loaded.save.handState.rngState).toBe(state.rngState);
    expect(loaded.save.handState.seed).toBe(42);
  });

  it('clears the active save', async () => {
    const store = new PersistStore({ backend: new MemoryPersistBackend() });
    await store.saveActive({
      match: { status: 'in_hand', handIndex: 1, matchSeed: 1 },
      sessionStatus: 'awaiting_player_discard',
      handState: handState(1),
      selectedTileId: null,
      actionLog: [{ type: 'StartHand', seed: 1 }],
    });
    await store.clearActive();
    expect((await store.loadActive()).status).toBe('empty');
  });

  it('retains only the most recent 20 game logs', async () => {
    let t = 0;
    let n = 0;
    const store = new PersistStore({
      backend: new MemoryPersistBackend(),
      now: () => ++t,
      randomId: () => `id-${++n}`,
    });

    for (let i = 0; i < MAX_GAME_LOGS + 5; i++) {
      await store.archiveGameLog({
        matchSeed: i,
        handCount: 1,
        actionLog: [{ type: 'StartHand', seed: i }],
        finalHandState: null,
      });
    }

    const logs = await store.listGameLogs();
    expect(logs).toHaveLength(MAX_GAME_LOGS);
    expect(logs[0]!.matchSeed).toBe(MAX_GAME_LOGS + 4);
    expect(logs[logs.length - 1]!.matchSeed).toBe(5);
  });

  it('exports active save and logs; keeps incompatible raw for export', async () => {
    const backend = new MemoryPersistBackend();
    await backend.set('activeSave', { schemaVersion: 0, kind: 'active_save', broken: true });
    const store = new PersistStore({ backend, now: () => 50 });

    const loaded = await store.loadActive();
    expect(loaded.status).toBe('incompatible');

    const json = await store.exportJson();
    const parsed = JSON.parse(json) as {
      schemaVersion: number;
      incompatibleActiveRaw?: { schemaVersion: number };
      gameLogs: unknown[];
    };
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.incompatibleActiveRaw?.schemaVersion).toBe(0);
    expect(parsed.gameLogs).toEqual([]);
  });

  it('clearAllGameData wipes saves and logs', async () => {
    const store = new PersistStore({ backend: new MemoryPersistBackend() });
    await store.saveActive({
      match: { status: 'in_hand', handIndex: 1, matchSeed: 1 },
      sessionStatus: 'awaiting_player_discard',
      handState: handState(1),
      selectedTileId: null,
      actionLog: [{ type: 'StartHand', seed: 1 }],
    });
    await store.archiveGameLog({
      matchSeed: 1,
      handCount: 1,
      actionLog: [{ type: 'StartHand', seed: 1 }],
      finalHandState: null,
    });
    await store.clearAllGameData();
    expect((await store.loadActive()).status).toBe('empty');
    expect(await store.listGameLogs()).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../core';
import { ACTIVE_SAVE_MIGRATORS, resolveActiveSave } from './migrate';
import type { ActiveSave } from './types';

function sampleSave(overrides: Partial<ActiveSave> = {}): ActiveSave {
  const hand = applyCommand(null, { type: 'StartHand', seed: 7 }).state;
  return {
    schemaVersion: 1,
    kind: 'active_save',
    savedAt: 1,
    match: { status: 'in_hand', handIndex: 1, matchSeed: 7 },
    sessionStatus: 'awaiting_player_discard',
    handState: hand,
    selectedTileId: null,
    actionLog: [{ type: 'StartHand', seed: 7 }],
    ...overrides,
  };
}

describe('resolveActiveSave', () => {
  it('accepts a valid v1 save that includes rngState', () => {
    const save = sampleSave();
    expect(save.handState.rngState).toEqual(expect.any(Number));
    const result = resolveActiveSave(save);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.save.handState.seed).toBe(7);
      expect(result.save.handState.schemaVersion).toBe(1);
    }
  });

  it('returns empty for null', () => {
    expect(resolveActiveSave(null).status).toBe('empty');
  });

  it('refuses unknown old schema when no migrator exists', () => {
    const raw = { schemaVersion: 0, kind: 'active_save', handState: {} };
    const result = resolveActiveSave(raw);
    expect(result.status).toBe('incompatible');
    if (result.status === 'incompatible') {
      expect(result.reason).toMatch(/无可用迁移器/);
      expect(result.raw).toBe(raw);
    }
  });

  it('refuses future schema versions', () => {
    const raw = { ...sampleSave(), schemaVersion: 99 };
    const result = resolveActiveSave(raw);
    expect(result.status).toBe('incompatible');
    if (result.status === 'incompatible') {
      expect(result.reason).toMatch(/存档更新/);
    }
  });

  it('runs an explicit migrator when registered', () => {
    const migrator = (raw: Record<string, unknown>) => {
      const base = sampleSave();
      return { ...base, savedAt: Number(raw.savedAt ?? 0) + 1 };
    };
    ACTIVE_SAVE_MIGRATORS[0] = migrator;
    try {
      const result = resolveActiveSave({
        schemaVersion: 0,
        kind: 'active_save',
        savedAt: 10,
      });
      expect(result.status).toBe('ok');
      if (result.status === 'ok') {
        expect(result.save.savedAt).toBe(11);
        expect(result.save.schemaVersion).toBe(1);
      }
    } finally {
      delete ACTIVE_SAVE_MIGRATORS[0];
    }
  });
});

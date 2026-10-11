import type { PersistBackend } from './backend';
import { createDefaultBackend } from './backend';
import { resolveActiveSave } from './migrate';
import type {
  ActiveSave,
  ExportBundle,
  GameLog,
  LoadActiveResult,
  LoggedCommand,
} from './types';
import {
  ACTIVE_SAVE_SCHEMA_VERSION,
  EXPORT_BUNDLE_SCHEMA_VERSION,
  GAME_LOG_SCHEMA_VERSION,
  MAX_GAME_LOGS,
} from './types';

const ACTIVE_KEY = 'activeSave';
const LOG_PREFIX = 'gameLog:';
const RAW_INCOMPATIBLE_KEY = 'activeSave.incompatible';

export interface PersistStoreDeps {
  backend?: PersistBackend;
  now?: () => number;
  randomId?: () => string;
}

/**
 * Local-first persistence: active 存档 + last 20 game logs (IndexedDB).
 * Theme/settings stay on localStorage and are cleared via clearLocalData.
 */
export class PersistStore {
  private readonly backend: PersistBackend;
  private readonly now: () => number;
  private readonly randomId: () => string;

  constructor(deps: PersistStoreDeps = {}) {
    this.backend = deps.backend ?? createDefaultBackend();
    this.now = deps.now ?? (() => Date.now());
    this.randomId =
      deps.randomId ??
      (() => `log-${this.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  }

  async loadActive(): Promise<LoadActiveResult> {
    const raw = await this.backend.get(ACTIVE_KEY);
    if (raw === undefined) return { status: 'empty' };
    const resolved = resolveActiveSave(raw);
    if (resolved.status === 'incompatible') {
      await this.backend.set(RAW_INCOMPATIBLE_KEY, raw);
    }
    return resolved;
  }

  async saveActive(save: Omit<ActiveSave, 'schemaVersion' | 'kind' | 'savedAt'> & {
    savedAt?: number;
  }): Promise<ActiveSave> {
    const full: ActiveSave = {
      schemaVersion: ACTIVE_SAVE_SCHEMA_VERSION,
      kind: 'active_save',
      savedAt: save.savedAt ?? this.now(),
      match: save.match,
      sessionStatus: save.sessionStatus,
      handState: structuredClone(save.handState),
      selectedTileId: save.selectedTileId,
      actionLog: structuredClone(save.actionLog),
    };
    await this.backend.set(ACTIVE_KEY, full);
    await this.backend.delete(RAW_INCOMPATIBLE_KEY);
    return full;
  }

  async clearActive(): Promise<void> {
    await this.backend.delete(ACTIVE_KEY);
  }

  async peekIncompatibleRaw(): Promise<unknown | undefined> {
    return this.backend.get(RAW_INCOMPATIBLE_KEY);
  }

  async listGameLogs(): Promise<GameLog[]> {
    const keys = await this.backend.listKeys(LOG_PREFIX);
    const logs: GameLog[] = [];
    for (const key of keys) {
      const value = await this.backend.get(key);
      if (isGameLog(value)) logs.push(value);
    }
    logs.sort((a, b) => b.savedAt - a.savedAt);
    return logs;
  }

  async archiveGameLog(input: {
    matchSeed: number;
    handCount: number;
    actionLog: LoggedCommand[];
    finalHandState: ActiveSave['handState'] | null;
  }): Promise<GameLog> {
    const log: GameLog = {
      schemaVersion: GAME_LOG_SCHEMA_VERSION,
      kind: 'game_log',
      id: this.randomId(),
      savedAt: this.now(),
      matchSeed: input.matchSeed,
      handCount: input.handCount,
      actionLog: structuredClone(input.actionLog),
      finalHandState: input.finalHandState ? structuredClone(input.finalHandState) : null,
    };
    await this.backend.set(`${LOG_PREFIX}${log.id}`, log);
    await this.trimLogs();
    return log;
  }

  private async trimLogs(): Promise<void> {
    const logs = await this.listGameLogs();
    if (logs.length <= MAX_GAME_LOGS) return;
    const drop = logs.slice(MAX_GAME_LOGS);
    for (const log of drop) {
      await this.backend.delete(`${LOG_PREFIX}${log.id}`);
    }
  }

  async exportBundle(): Promise<ExportBundle> {
    const active = await this.loadActive();
    const incompatible = await this.peekIncompatibleRaw();
    const activeSave = active.status === 'ok' ? active.save : null;

    const bundle: ExportBundle = {
      schemaVersion: EXPORT_BUNDLE_SCHEMA_VERSION,
      kind: 'export_bundle',
      exportedAt: this.now(),
      activeSave,
      gameLogs: await this.listGameLogs(),
    };
    if (incompatible !== undefined) {
      bundle.incompatibleActiveRaw = incompatible;
    }
    return bundle;
  }

  /** Export JSON text (includes incompatible raw blob when present). */
  async exportJson(): Promise<string> {
    return JSON.stringify(await this.exportBundle(), null, 2);
  }

  async clearAllGameData(): Promise<void> {
    await this.backend.clear();
  }
}

function isGameLog(value: unknown): value is GameLog {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as GameLog).kind === 'game_log' &&
    (value as GameLog).schemaVersion === GAME_LOG_SCHEMA_VERSION &&
    Array.isArray((value as GameLog).actionLog)
  );
}

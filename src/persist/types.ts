import type { Command, HandState } from '../core';
import type { MatchStatus } from '../game/match';
import type { SessionStatus } from '../game/session';

/** Envelope schema for active 存档 and game logs (IndexedDB). */
export const ACTIVE_SAVE_SCHEMA_VERSION = 1 as const;
export const GAME_LOG_SCHEMA_VERSION = 1 as const;
export const EXPORT_BUNDLE_SCHEMA_VERSION = 1 as const;
export const MAX_GAME_LOGS = 20;

/** Final legal commands applied to the rule core (player + AI). */
export type LoggedCommand = Command;

export interface ActiveSaveV1 {
  schemaVersion: typeof ACTIVE_SAVE_SCHEMA_VERSION;
  kind: 'active_save';
  savedAt: number;
  match: {
    status: Exclude<MatchStatus, 'menu'>;
    handIndex: number;
    matchSeed: number;
  };
  sessionStatus: SessionStatus;
  /** Authoritative hand snapshot including schemaVersion + rngState. */
  handState: HandState;
  selectedTileId: string | null;
  actionLog: LoggedCommand[];
}

export type ActiveSave = ActiveSaveV1;

export interface GameLogV1 {
  schemaVersion: typeof GAME_LOG_SCHEMA_VERSION;
  kind: 'game_log';
  id: string;
  savedAt: number;
  matchSeed: number;
  handCount: number;
  actionLog: LoggedCommand[];
  finalHandState: HandState | null;
}

export type GameLog = GameLogV1;

export interface ExportBundleV1 {
  schemaVersion: typeof EXPORT_BUNDLE_SCHEMA_VERSION;
  kind: 'export_bundle';
  exportedAt: number;
  activeSave: ActiveSave | null;
  gameLogs: GameLog[];
  /** Present when an incompatible active save was refused and kept for export. */
  incompatibleActiveRaw?: unknown;
}

export type ExportBundle = ExportBundleV1;

export type LoadActiveResult =
  | { status: 'ok'; save: ActiveSave }
  | { status: 'empty' }
  | { status: 'incompatible'; reason: string; raw: unknown };

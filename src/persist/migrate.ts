import type { ActiveSave, LoadActiveResult } from './types';
import { ACTIVE_SAVE_SCHEMA_VERSION } from './types';

/**
 * Explicit migrators keyed by source schemaVersion.
 * Missing migrator ⇒ refuse (never silently reinterpret).
 */
export type ActiveSaveMigrator = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Registry is empty at v1; add `n → n+1` entries when the envelope bumps. */
export const ACTIVE_SAVE_MIGRATORS: Record<number, ActiveSaveMigrator> = {};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSchemaVersion(raw: unknown): number | null {
  if (!isRecord(raw)) return null;
  const v = raw.schemaVersion;
  return typeof v === 'number' && Number.isInteger(v) ? v : null;
}

function looksLikeActiveSaveV1(raw: unknown): raw is ActiveSave {
  if (!isRecord(raw)) return false;
  if (raw.schemaVersion !== 1 || raw.kind !== 'active_save') return false;
  if (!isRecord(raw.match) || !isRecord(raw.handState)) return false;
  if (typeof raw.sessionStatus !== 'string') return false;
  if (!Array.isArray(raw.actionLog)) return false;
  const hand = raw.handState;
  if (hand.schemaVersion !== 1) return false;
  if (typeof hand.rngState !== 'number' || typeof hand.seed !== 'number') return false;
  return true;
}

/**
 * Migrate a stored active-save blob to the current envelope, or refuse.
 */
export function resolveActiveSave(raw: unknown): LoadActiveResult {
  if (raw == null) return { status: 'empty' };

  let current: unknown = raw;
  let version = readSchemaVersion(current);
  if (version === null) {
    return { status: 'incompatible', reason: '缺少 schemaVersion', raw };
  }

  while (version < ACTIVE_SAVE_SCHEMA_VERSION) {
    const migrator = ACTIVE_SAVE_MIGRATORS[version];
    if (!migrator) {
      return {
        status: 'incompatible',
        reason: `无可用迁移器：存档 schemaVersion=${version} → ${ACTIVE_SAVE_SCHEMA_VERSION}`,
        raw,
      };
    }
    if (!isRecord(current)) {
      return { status: 'incompatible', reason: '存档格式无效', raw };
    }
    current = migrator(current);
    version = readSchemaVersion(current);
    if (version === null) {
      return { status: 'incompatible', reason: '迁移后缺少 schemaVersion', raw };
    }
  }

  if (version > ACTIVE_SAVE_SCHEMA_VERSION) {
    return {
      status: 'incompatible',
      reason: `存档更新（schemaVersion=${version}），当前应用仅支持 ${ACTIVE_SAVE_SCHEMA_VERSION}`,
      raw,
    };
  }

  if (!looksLikeActiveSaveV1(current)) {
    return { status: 'incompatible', reason: '存档结构无效或手牌缺少 rngState', raw };
  }

  return { status: 'ok', save: current };
}

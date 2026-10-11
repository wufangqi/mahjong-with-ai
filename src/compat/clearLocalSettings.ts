import { EXTERNAL_AI_STORAGE_KEY } from '../ai/config';
import { MASTER_VOLUME_STORAGE_KEY, SFX_VOLUME_STORAGE_KEY } from '../audio/types';
import { REDUCED_MOTION_STORAGE_KEY } from '../motion/types';
import { QUALITY_MODE_STORAGE_KEY, QUALITY_STORAGE_KEY } from '../quality/types';
import { THEME_STORAGE_KEY } from '../theme/types';

/** Scene preference key (also cleared with local settings). */
export const AUTO_SKIP_STORAGE_KEY = 'mahjong.scene.autoSkipOpponent';

const LOCAL_SETTING_KEYS = [
  THEME_STORAGE_KEY,
  QUALITY_STORAGE_KEY,
  QUALITY_MODE_STORAGE_KEY,
  MASTER_VOLUME_STORAGE_KEY,
  SFX_VOLUME_STORAGE_KEY,
  REDUCED_MOTION_STORAGE_KEY,
  AUTO_SKIP_STORAGE_KEY,
  EXTERNAL_AI_STORAGE_KEY,
] as const;

/** Remove persisted preference keys from localStorage (IndexedDB cleared separately). */
export function clearLocalSettingsKeys(storage: Storage): void {
  for (const key of LOCAL_SETTING_KEYS) {
    storage.removeItem(key);
  }
}

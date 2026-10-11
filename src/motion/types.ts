export type ReducedMotionMode = 'system' | 'on' | 'off';

export const REDUCED_MOTION_STORAGE_KEY = 'mahjong.motion.reduced';

export interface MotionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function isReducedMotionMode(value: string): value is ReducedMotionMode {
  return value === 'system' || value === 'on' || value === 'off';
}

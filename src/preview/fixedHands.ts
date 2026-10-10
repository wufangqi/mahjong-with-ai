/** Fixed hand layouts mirrored from the read-only Demo for effect preview. */
export type TileCode = string;

export type HandName = 'idle' | 'basic' | 'big' | 'top';

export const FIXED_HANDS: Record<HandName, readonly TileCode[]> = {
  idle: ['m2', 'm3', 'm4', 'p5', 'p6', 'p7', 's3', 's4', 's5', 'E', 'E', 'E', 'P', 'P'],
  basic: ['m2', 'm3', 'm4', 'p5', 'p6', 'p7', 's3', 's4', 's5', 'E', 'E', 'E', 'P', 'P'],
  big: ['m1', 'm1', 'm2', 'm3', 'm4', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm9', 'm9', 'm9'],
  top: ['m1', 'm9', 'p1', 'p9', 's1', 's9', 'E', 'S', 'W', 'N', 'P', 'F', 'C', 'C'],
} as const;

/** Fixed basic-win preview input used by the production effect entry. */
export const FIXED_BASIC_HAND = FIXED_HANDS.basic;

export function isFixedHand(name: string): name is HandName {
  return Object.prototype.hasOwnProperty.call(FIXED_HANDS, name);
}

/** Camera / effect motion channels that reduced-motion must mute. */
export interface CameraMotionChannels {
  shake: number;
  dolly: number;
  /** Optional look-turn rate multiplier (1 = normal). */
  turnRate?: number;
}

/**
 * Strip shake, aggressive pushes (large |dolly|), and fast turns.
 * Tile / banner / particle channels are intentionally untouched by callers.
 */
export function dampenCameraMotion(channels: CameraMotionChannels): CameraMotionChannels {
  const softDolly = Math.max(-0.25, Math.min(0.25, channels.dolly * 0.12));
  return {
    shake: 0,
    dolly: softDolly,
    turnRate: Math.min(channels.turnRate ?? 1, 0.25),
  };
}

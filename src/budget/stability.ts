/**
 * Detect sustained growth across soak samples.
 * Uses a linear slope over the last half of samples; growth is sustained when
 * the slope exceeds `maxBytesPerStep` and the last sample exceeds the first
 * by more than `minDeltaBytes`.
 */
export function hasSustainedGrowth(
  samples: readonly number[],
  opts?: { maxBytesPerStep?: number; minDeltaBytes?: number },
): boolean {
  if (samples.length < 4) return false;
  const maxBytesPerStep = opts?.maxBytesPerStep ?? 64 * 1024;
  const minDeltaBytes = opts?.minDeltaBytes ?? 2 * 1024 * 1024;
  const start = Math.floor(samples.length / 2);
  const window = samples.slice(start);
  const first = window[0]!;
  const last = window[window.length - 1]!;
  if (last - first <= minDeltaBytes) return false;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  const n = window.length;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = window[i]!;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return false;
  const slope = (n * sumXY - sumX * sumY) / denom;
  return slope > maxBytesPerStep;
}

export type StabilityReport = {
  samples: number[];
  sustainedGrowth: boolean;
};

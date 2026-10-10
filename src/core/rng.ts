/**
 * Serializable mulberry32 PRNG for gameplay randomness.
 * Visual effects must not use this source (ADR-0009).
 */
export interface SeededRng {
  readonly seed: number;
  state: number;
  next(): number;
  nextInt(maxExclusive: number): number;
}

export function createRng(seed: number, state = seed >>> 0): SeededRng {
  let s = state >>> 0;
  return {
    seed: seed >>> 0,
    get state() {
      return s;
    },
    set state(value: number) {
      s = value >>> 0;
    },
    next(): number {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(maxExclusive: number): number {
      if (maxExclusive <= 0) throw new Error('nextInt maxExclusive must be > 0');
      return Math.floor(this.next() * maxExclusive);
    },
  };
}

/** Fisher–Yates shuffle using the gameplay RNG. */
export function shuffleInPlace<T>(items: T[], rng: SeededRng): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
}

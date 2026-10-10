/**
 * Visual-only seeded PRNG (mulberry32). Must stay isolated from gameplay RNG (ADR-0009).
 */
export type VisualRng = {
  readonly seed: number;
  next(): number;
  nextInt(maxExclusive: number): number;
};

export function createVisualRng(seed: number): VisualRng {
  let s = seed >>> 0;
  return {
    seed: seed >>> 0,
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

let active: VisualRng | null = null;

/** Install visual RNG used by preview/effect randomness. */
export function installVisualRng(seed: number): VisualRng {
  active = createVisualRng(seed);
  return active;
}

export function getVisualRng(): VisualRng | null {
  return active;
}

/** Prefer installed visual RNG; fall back to Math.random outside visual mode. */
export function visualRandom(): number {
  return active ? active.next() : Math.random();
}

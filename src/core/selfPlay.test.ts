import { describe, expect, it } from 'vitest';
import { runSelfPlayHand, runSelfPlayBatch } from './selfPlay';

describe('seeded self-play', () => {
  it('completes a single hand with conservation and one terminal', () => {
    const result = runSelfPlayHand(7);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.terminal).toMatch(/^(hand_won|exhaustive_draw)$/);
    expect(result.steps).toBeGreaterThan(0);
    expect(result.tileCount).toBe(136);
  });

  it('runs at least 10,000 seeded hands without deadlock or conservation breaks', () => {
    const batch = runSelfPlayBatch({
      hands: 10_000,
      startSeed: 1,
    });
    expect(batch.ok).toBe(true);
    if (!batch.ok) {
      throw new Error(
        `self-play failed at seed=${batch.failure.seed}: ${batch.failure.reason}\n` +
          `actions=${JSON.stringify(batch.failure.actionLog)}`,
      );
    }
    expect(batch.completed).toBe(10_000);
    expect(batch.wins + batch.draws).toBe(10_000);
  });
});

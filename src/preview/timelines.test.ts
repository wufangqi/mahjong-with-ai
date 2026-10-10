import { describe, expect, it } from 'vitest';
import { FIXED_HANDS, isFixedHand } from './fixedHands';
import { validateTimeline, type WinTimelineConfig } from './timelineSchema';
import { assertShippedTimelinesValid, timelineFor, WIN_TIMELINES } from './timelines';

describe('win timeline schema', () => {
  it('accepts shipped basic / big / top timelines', () => {
    expect(() => assertShippedTimelinesValid()).not.toThrow();
    for (const tier of ['basic', 'big', 'top'] as const) {
      expect(validateTimeline(WIN_TIMELINES[tier])).toBe(true);
      expect(timelineFor(tier).tier).toBe(tier);
    }
  });

  it('rejects malformed timeline configs', () => {
    const bad: WinTimelineConfig = {
      ...WIN_TIMELINES.basic,
      durationMs: 100,
      tracks: [{ id: 'late', kind: 'banner', startMs: 50, durationMs: 200 }],
    };
    expect(validateTimeline(bad)).toBe(false);
    expect(validateTimeline({ ...WIN_TIMELINES.basic, bannerMain: '' })).toBe(false);
    expect(validateTimeline({ ...WIN_TIMELINES.basic, tracks: [] })).toBe(false);
    expect(validateTimeline({ ...WIN_TIMELINES.basic, tier: 'basic', hand: 'top' })).toBe(false);
  });

  it('maps each tier to a fixed preview hand that can be played', () => {
    for (const tier of ['basic', 'big', 'top'] as const) {
      const cfg = timelineFor(tier);
      expect(isFixedHand(cfg.hand)).toBe(true);
      expect(FIXED_HANDS[cfg.hand]).toHaveLength(14);
      expect(cfg.durationMs).toBeGreaterThan(0);
      expect(cfg.tracks.some((t) => t.kind === 'banner')).toBe(true);
    }
  });
});

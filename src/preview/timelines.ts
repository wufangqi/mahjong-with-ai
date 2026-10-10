import {
  validateTimeline,
  type TimelineTier,
  type WinTimelineConfig,
} from './timelineSchema';

/** Shipped win-scene timelines used by the fixed effect preview. */
export const WIN_TIMELINES: Record<TimelineTier, WinTimelineConfig> = {
  basic: {
    tier: 'basic',
    hand: 'basic',
    durationMs: 2600,
    bannerMain: '胡',
    bannerSub: '平胡 · 基础胡',
    tracks: [
      { id: 'banner', kind: 'banner', startMs: 200, durationMs: 2400 },
      { id: 'tiles-lift', kind: 'tiles', startMs: 0, durationMs: 1900 },
      { id: 'sparks', kind: 'particles', startMs: 220, durationMs: 1100 },
      { id: 'sfx', kind: 'audio', startMs: 0, durationMs: 800 },
    ],
  },
  big: {
    tier: 'big',
    hand: 'big',
    durationMs: 3800,
    bannerMain: '清一色',
    bannerSub: '大牌胡',
    tracks: [
      { id: 'camera-pull', kind: 'camera', startMs: 0, durationMs: 850 },
      { id: 'ring-gather', kind: 'tiles', startMs: 0, durationMs: 2700 },
      { id: 'pillar', kind: 'particles', startMs: 850, durationMs: 1950 },
      { id: 'banner', kind: 'banner', startMs: 900, durationMs: 2900 },
      { id: 'sfx', kind: 'audio', startMs: 0, durationMs: 1200 },
    ],
  },
  top: {
    tier: 'top',
    hand: 'top',
    durationMs: 4600,
    bannerMain: '十三幺',
    bannerSub: '顶级胡',
    tracks: [
      { id: 'slow-mo', kind: 'camera', startMs: 0, durationMs: 1200 },
      { id: 'shatter', kind: 'particles', startMs: 900, durationMs: 1800 },
      { id: 'glyph', kind: 'tiles', startMs: 2450, durationMs: 2000 },
      { id: 'banner', kind: 'banner', startMs: 2450, durationMs: 2150 },
      { id: 'sfx', kind: 'audio', startMs: 0, durationMs: 1600 },
    ],
  },
};

/** All shipped timelines; throws if any fail schema validation. */
export function assertShippedTimelinesValid(): void {
  for (const tier of Object.keys(WIN_TIMELINES) as TimelineTier[]) {
    const cfg = WIN_TIMELINES[tier];
    if (!validateTimeline(cfg)) {
      throw new Error(`invalid win timeline config for tier "${tier}"`);
    }
  }
}

export function timelineFor(tier: TimelineTier): WinTimelineConfig {
  const cfg = WIN_TIMELINES[tier];
  if (!validateTimeline(cfg)) {
    throw new Error(`invalid win timeline config for tier "${tier}"`);
  }
  return cfg;
}

// Validate at module load so malformed shipped configs fail fast in preview/build.
assertShippedTimelinesValid();

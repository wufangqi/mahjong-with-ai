import { describe, expect, it } from 'vitest';
import { WIN_TIMELINES } from '../preview/timelines';
import {
  playWinTimelineTracks,
  resolveWinTimelinePlayback,
  sceneDurationForTier,
} from './winTimeline';
import type { WinScenePlan } from './winPresentation';

const basicPlan: WinScenePlan = {
  seat: 2,
  tier: 'basic',
  patterns: ['pinghu'],
  fan: 1,
  bannerMain: '胡',
  bannerSub: '平胡 · 1 番',
};

describe('resolveWinTimelinePlayback', () => {
  it('uses shipped WIN_TIMELINES duration and track windows for each tier', () => {
    for (const tier of ['basic', 'big', 'top'] as const) {
      const shipped = WIN_TIMELINES[tier];
      const playback = resolveWinTimelinePlayback({ ...basicPlan, tier });
      expect(playback.durationMs).toBe(shipped.durationMs);
      expect(playback.durationMs).toBe(sceneDurationForTier(tier));

      const banner = shipped.tracks.find((t) => t.kind === 'banner')!;
      expect(playback.banner.startMs).toBe(banner.startMs);
      expect(playback.banner.durationMs).toBe(banner.durationMs);

      const audio = shipped.tracks.find((t) => t.kind === 'audio')!;
      expect(playback.audio.startMs).toBe(audio.startMs);

      const cameras = shipped.tracks.filter((t) => t.kind === 'camera');
      expect(playback.camera).toEqual(
        cameras.map((t) => ({ startMs: t.startMs, durationMs: t.durationMs })),
      );
    }
  });

  it('keeps match banner copy from the plan (timeline owns rhythm, not wording)', () => {
    const playback = resolveWinTimelinePlayback(basicPlan);
    expect(playback.bannerMain).toBe('胡');
    expect(playback.bannerSub).toBe('平胡 · 1 番');
    expect(playback.seat).toBe(2);
  });
});

describe('playWinTimelineTracks', () => {
  it('fires banner, audio, and camera cues on the controlled clock', () => {
    const deferred: Array<{ fn: () => void; ms: number; id: number }> = [];
    let nextId = 1;
    const events: string[] = [];

    const handle = playWinTimelineTracks({
      plan: { ...basicPlan, tier: 'big' },
      defer: (fn, ms) => {
        const id = nextId++;
        deferred.push({ fn, ms, id });
        return id;
      },
      cancelDefer: (h) => {
        const id = h as number;
        const idx = deferred.findIndex((d) => d.id === id);
        if (idx >= 0) deferred.splice(idx, 1);
      },
      onBannerShow: () => events.push('banner-show'),
      onBannerHide: () => events.push('banner-hide'),
      onAudio: () => events.push('audio'),
      onCameraStart: (seat, durationMs) => events.push(`camera-start:${seat}:${durationMs}`),
      onCameraEnd: () => events.push('camera-end'),
    });

    expect(handle.durationMs).toBe(WIN_TIMELINES.big.durationMs);

    const flushAt = (atMs: number): void => {
      const due = deferred.filter((d) => d.ms <= atMs).sort((a, b) => a.ms - b.ms || a.id - b.id);
      for (const item of due) {
        const idx = deferred.indexOf(item);
        if (idx < 0) continue;
        deferred.splice(idx, 1);
        item.fn();
      }
    };

    flushAt(0);
    expect(events).toContain('audio');
    const cameraTrack = WIN_TIMELINES.big.tracks.find((t) => t.kind === 'camera')!;
    expect(events).toContain(`camera-start:2:${cameraTrack.durationMs}`);

    const bannerStart = WIN_TIMELINES.big.tracks.find((t) => t.kind === 'banner')!.startMs;
    flushAt(bannerStart);
    expect(events).toContain('banner-show');

    flushAt(handle.durationMs);
    expect(events).toContain('banner-hide');
    expect(events).toContain('camera-end');
  });
});

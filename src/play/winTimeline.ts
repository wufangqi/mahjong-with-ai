import { timelineFor } from '../preview/timelines';
import type { Seat } from '../core';
import type { SceneTier, WinScenePlan } from './winPresentation';

export interface TimelineWindow {
  startMs: number;
  durationMs: number;
}

/** Match-path playback derived from shipped WIN_TIMELINES (rhythm) + plan (copy/seat). */
export interface WinTimelinePlayback {
  tier: SceneTier;
  seat: Seat;
  durationMs: number;
  bannerMain: string;
  bannerSub: string;
  banner: TimelineWindow;
  audio: TimelineWindow;
  camera: TimelineWindow[];
}

/** Scene length for a presentation tier — sourced from validated WIN_TIMELINES. */
export function sceneDurationForTier(tier: SceneTier): number {
  return timelineFor(tier).durationMs;
}

/** Resolve data-driven track windows for a planned win scene. */
export function resolveWinTimelinePlayback(plan: WinScenePlan): WinTimelinePlayback {
  const cfg = timelineFor(plan.tier);
  const bannerTrack = cfg.tracks.find((t) => t.kind === 'banner');
  const audioTrack = cfg.tracks.find((t) => t.kind === 'audio');
  if (!bannerTrack || !audioTrack) {
    throw new Error(`win timeline for tier "${plan.tier}" missing banner/audio track`);
  }
  return {
    tier: plan.tier,
    seat: plan.seat,
    durationMs: cfg.durationMs,
    bannerMain: plan.bannerMain,
    bannerSub: plan.bannerSub,
    banner: { startMs: bannerTrack.startMs, durationMs: bannerTrack.durationMs },
    audio: { startMs: audioTrack.startMs, durationMs: audioTrack.durationMs },
    camera: cfg.tracks
      .filter((t) => t.kind === 'camera')
      .map((t) => ({ startMs: t.startMs, durationMs: t.durationMs })),
  };
}

export interface PlayWinTimelineDeps {
  plan: WinScenePlan;
  defer: (fn: () => void, delayMs: number) => unknown;
  cancelDefer?: (handle: unknown) => void;
  onBannerShow: () => void;
  onBannerHide: () => void;
  onAudio: () => void;
  onCameraStart: (seat: Seat, durationMs: number) => void;
  onCameraEnd: () => void;
}

export interface PlayWinTimelineHandle {
  durationMs: number;
  cancel: () => void;
}

/**
 * Drive lifecycle-managed WIN_TIMELINES tracks for a match win scene.
 * Banner wording comes from the plan; timing comes from the shipped timeline.
 */
export function playWinTimelineTracks(deps: PlayWinTimelineDeps): PlayWinTimelineHandle {
  const playback = resolveWinTimelinePlayback(deps.plan);
  const handles: unknown[] = [];
  let cancelled = false;

  const schedule = (fn: () => void, delayMs: number): void => {
    const handle = deps.defer(() => {
      if (cancelled) return;
      fn();
    }, delayMs);
    handles.push(handle);
  };

  schedule(() => deps.onAudio(), playback.audio.startMs);
  schedule(() => deps.onBannerShow(), playback.banner.startMs);
  schedule(
    () => deps.onBannerHide(),
    Math.min(playback.durationMs, playback.banner.startMs + playback.banner.durationMs),
  );

  for (const cam of playback.camera) {
    schedule(() => deps.onCameraStart(playback.seat, cam.durationMs), cam.startMs);
    schedule(() => deps.onCameraEnd(), cam.startMs + cam.durationMs);
  }

  // Tiers without an explicit camera track still get a brief winner focus (US78).
  if (playback.camera.length === 0) {
    const fallbackMs = Math.min(900, playback.durationMs);
    schedule(() => deps.onCameraStart(playback.seat, fallbackMs), 0);
    schedule(() => deps.onCameraEnd(), fallbackMs);
  }

  return {
    durationMs: playback.durationMs,
    cancel: () => {
      cancelled = true;
      if (!deps.cancelDefer) return;
      for (const handle of handles) deps.cancelDefer(handle);
      handles.length = 0;
    },
  };
}

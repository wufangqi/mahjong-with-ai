/** Validated win-scene timeline configs for fixed effect preview (basic / big / top). */

export type TimelineTier = 'basic' | 'big' | 'top';

export type TimelineTrackKind = 'banner' | 'camera' | 'particles' | 'audio' | 'tiles';

export interface TimelineTrack {
  id: string;
  kind: TimelineTrackKind;
  startMs: number;
  durationMs: number;
}

export interface WinTimelineConfig {
  tier: TimelineTier;
  /** Fixed preview hand layout to load before playback. */
  hand: TimelineTier;
  durationMs: number;
  bannerMain: string;
  bannerSub: string;
  tracks: TimelineTrack[];
}

const TIERS = new Set<TimelineTier>(['basic', 'big', 'top']);
const TRACK_KINDS = new Set<TimelineTrackKind>(['banner', 'camera', 'particles', 'audio', 'tiles']);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNonNegFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isTrack(value: unknown): value is TimelineTrack {
  if (!value || typeof value !== 'object') return false;
  const t = value as TimelineTrack;
  return (
    isNonEmptyString(t.id) &&
    TRACK_KINDS.has(t.kind) &&
    isNonNegFinite(t.startMs) &&
    isNonNegFinite(t.durationMs) &&
    t.durationMs > 0
  );
}

/** Schema validation for a single shipped win-scene timeline. */
export function validateTimeline(raw: unknown): raw is WinTimelineConfig {
  if (!raw || typeof raw !== 'object') return false;
  const cfg = raw as WinTimelineConfig;
  if (!TIERS.has(cfg.tier)) return false;
  if (!TIERS.has(cfg.hand)) return false;
  if (cfg.tier !== cfg.hand) return false;
  if (!isNonNegFinite(cfg.durationMs) || cfg.durationMs <= 0) return false;
  if (!isNonEmptyString(cfg.bannerMain) || !isNonEmptyString(cfg.bannerSub)) return false;
  if (!Array.isArray(cfg.tracks) || cfg.tracks.length === 0) return false;
  if (!cfg.tracks.every(isTrack)) return false;
  // Tracks must finish within the timeline duration.
  for (const track of cfg.tracks) {
    if (track.startMs + track.durationMs > cfg.durationMs + 1e-6) return false;
  }
  return true;
}

export function isTimelineTier(value: string): value is TimelineTier {
  return TIERS.has(value as TimelineTier);
}

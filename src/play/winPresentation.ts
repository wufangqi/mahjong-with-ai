import { PLAYER_SEAT, seatsAfter, type FanPatternId, type Seat, type WinnerResult } from '../core';

/** Presentation-only scene tier (never appears on core HandWon). */
export type SceneTier = 'basic' | 'big' | 'top';

export interface WinScenePlan {
  seat: Seat;
  tier: SceneTier;
  patterns: FanPatternId[];
  fan: number;
  bannerMain: string;
  bannerSub: string;
}

export interface WinScenePlayInfo {
  index: number;
  total: number;
}

const PATTERN_TIER: Record<FanPatternId, SceneTier> = {
  pinghu: 'basic',
  pengpenghu: 'big',
  qingyise: 'big',
  qidui: 'big',
  shisanyao: 'top',
  gangshangkaihua: 'big',
};

const PATTERN_LABEL: Record<FanPatternId, string> = {
  pinghu: '平胡',
  pengpenghu: '碰碰胡',
  qingyise: '清一色',
  qidui: '七对',
  shisanyao: '十三幺',
  gangshangkaihua: '杠上开花',
};

const TIER_RANK: Record<SceneTier, number> = { basic: 0, big: 1, top: 2 };

const DEFAULT_SCENE_DURATION_MS = 2400;

/** Map domain patterns to the highest presentation tier (not total fan). */
export function sceneTierForPatterns(patterns: readonly FanPatternId[]): SceneTier {
  let best: SceneTier = 'basic';
  for (const pattern of patterns) {
    const tier = PATTERN_TIER[pattern];
    if (TIER_RANK[tier] > TIER_RANK[best]) best = tier;
  }
  return best;
}

export function patternLabels(patterns: readonly FanPatternId[]): string[] {
  return patterns.map((p) => PATTERN_LABEL[p]);
}

export function planWinScene(winner: WinnerResult): WinScenePlan {
  const tier = sceneTierForPatterns(winner.patterns);
  const labels = patternLabels(winner.patterns);
  const primary = labels[0] ?? '胡';
  return {
    seat: winner.seat,
    tier,
    patterns: [...winner.patterns],
    fan: winner.fan,
    bannerMain: '胡',
    bannerSub: `${primary} · ${winner.fan} 番`,
  };
}

/**
 * Presentation order for 一炮多响: top → big → basic, then same-tier seats
 * from the discarder's next seat.
 */
export function orderWinnersForScenes(
  winners: readonly WinnerResult[],
  discarder: Seat,
): WinnerResult[] {
  const seatOrder = seatsAfter(discarder);
  return [...winners].sort((a, b) => {
    const tierDiff = TIER_RANK[sceneTierForPatterns(b.patterns)] - TIER_RANK[sceneTierForPatterns(a.patterns)];
    if (tierDiff !== 0) return tierDiff;
    return seatOrder.indexOf(a.seat) - seatOrder.indexOf(b.seat);
  });
}

export interface WinSceneSchedulerDeps {
  now: () => number;
  /** Schedule a callback after `delayMs` (injectable for tests). */
  defer: (fn: () => void, delayMs: number) => unknown;
  /** Cancel a handle returned by `defer`. */
  cancelDefer?: (handle: unknown) => void;
  sceneDurationMs?: number;
  playerSeat?: Seat;
}

/**
 * Presentation seam: map HandWon winners to scene plans and enter scheduling
 * within 100 ms (ADR-0003 / ADR-0007 — tier lives only here).
 * Supports skip, auto-skip opponents, replay one / replay all.
 */
export class WinSceneScheduler {
  private readonly now: () => number;
  private readonly defer: (fn: () => void, delayMs: number) => unknown;
  private readonly cancelDefer: ((handle: unknown) => void) | null;
  private readonly sceneDurationMs: number;
  private readonly playerSeat: Seat;

  private lastPlans: WinScenePlan[] = [];
  private lastDiscarder: Seat = 0;
  private queue: WinScenePlan[] = [];
  private index = 0;
  private playing = false;
  /** True from scheduleWinners until beginQueue — hides settlement before the first frame. */
  private pending = false;
  private autoSkipOpponent = false;
  private timer: unknown = null;
  private lastScheduledAt: number | null = null;

  private queueHandler: ((plans: WinScenePlan[]) => void) | null = null;
  private sceneHandler: ((plan: WinScenePlan, info: WinScenePlayInfo) => void) | null = null;
  private idleHandler: (() => void) | null = null;

  constructor(
    deps: WinSceneSchedulerDeps = {
      now: () => performance.now(),
      defer: (fn, ms) => setTimeout(fn, ms),
      cancelDefer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    },
  ) {
    this.now = deps.now;
    this.defer = deps.defer;
    this.cancelDefer = deps.cancelDefer ?? null;
    this.sceneDurationMs = deps.sceneDurationMs ?? DEFAULT_SCENE_DURATION_MS;
    this.playerSeat = deps.playerSeat ?? PLAYER_SEAT;
  }

  /** Fired once when a queue enters scheduling (full ordered plan list). */
  onPlay(handler: (plans: WinScenePlan[]) => void): void {
    this.queueHandler = handler;
  }

  /** Fired when each individual winner scene starts. */
  onScene(handler: (plan: WinScenePlan, info: WinScenePlayInfo) => void): void {
    this.sceneHandler = handler;
  }

  /** Fired when the queue finishes or is cleared. */
  onIdle(handler: () => void): void {
    this.idleHandler = handler;
  }

  setAutoSkipOpponent(enabled: boolean): void {
    this.autoSkipOpponent = enabled;
  }

  getAutoSkipOpponent(): boolean {
    return this.autoSkipOpponent;
  }

  isPlaying(): boolean {
    return this.playing || this.pending;
  }

  getCurrentPlan(): WinScenePlan | null {
    if (!this.playing) return null;
    return this.queue[this.index] ?? null;
  }

  /** Enter scene scheduling for the given winners; must start within 100 ms. */
  scheduleWinners(winners: readonly WinnerResult[], discarder: Seat): void {
    this.lastDiscarder = discarder;
    const plans = orderWinnersForScenes(winners, discarder).map(planWinScene);
    this.lastPlans = plans;
    const scheduledAt = this.now();
    this.lastScheduledAt = scheduledAt;
    this.pending = plans.length > 0;
    this.defer(() => {
      this.beginQueue(plans);
    }, 0);
  }

  /** Skip the current winner scene and advance. */
  skip(): void {
    if (!this.playing) return;
    this.clearTimer();
    this.advance();
  }

  /** Re-enter scheduling for the last win scenes (settlement replay all). */
  replay(): void {
    this.replayAll();
  }

  /** Replay every winner scene in original presentation order. */
  replayAll(): void {
    if (this.lastPlans.length === 0) return;
    this.scheduleWinners(
      this.lastPlans.map((plan) => ({
        seat: plan.seat,
        patterns: plan.patterns,
        fan: plan.fan,
        hand: [],
      })),
      this.lastDiscarder,
    );
  }

  /** Replay a single winner's scene from settlement. */
  replaySeat(seat: Seat): void {
    const plan = this.lastPlans.find((p) => p.seat === seat);
    if (!plan) return;
    this.lastScheduledAt = this.now();
    this.pending = true;
    this.defer(() => {
      this.beginQueue([plan]);
    }, 0);
  }

  /** Test seam: when scheduleWinners was last entered. */
  getLastScheduledAt(): number | null {
    return this.lastScheduledAt;
  }

  getLastPlans(): WinScenePlan[] {
    return [...this.lastPlans];
  }

  private beginQueue(plans: WinScenePlan[]): void {
    this.clearTimer();
    this.pending = false;
    this.queue = [...plans];
    this.index = 0;
    this.playing = plans.length > 0;
    this.queueHandler?.(plans);
    if (plans.length === 0) {
      this.finish();
      return;
    }
    this.playCurrent();
  }

  private playCurrent(): void {
    const plan = this.queue[this.index];
    if (!plan) {
      this.finish();
      return;
    }
    this.sceneHandler?.(plan, { index: this.index, total: this.queue.length });

    if (this.autoSkipOpponent && plan.seat !== this.playerSeat) {
      this.timer = this.defer(() => this.advance(), 0);
      return;
    }

    this.timer = this.defer(() => this.advance(), this.sceneDurationMs);
  }

  private advance(): void {
    this.index += 1;
    if (this.index >= this.queue.length) {
      this.finish();
      return;
    }
    this.playCurrent();
  }

  private finish(): void {
    this.clearTimer();
    this.pending = false;
    this.playing = false;
    this.queue = [];
    this.index = 0;
    this.idleHandler?.();
  }

  private clearTimer(): void {
    if (this.timer != null && this.cancelDefer) {
      this.cancelDefer(this.timer);
    }
    this.timer = null;
  }
}

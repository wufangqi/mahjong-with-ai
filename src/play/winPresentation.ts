import type { FanPatternId, Seat, WinnerResult } from '../core';

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

const PATTERN_TIER: Record<FanPatternId, SceneTier> = {
  pinghu: 'basic',
  qidui: 'big',
  shisanyao: 'top',
  gangshangkaihua: 'big',
};

const PATTERN_LABEL: Record<FanPatternId, string> = {
  pinghu: '平胡',
  qidui: '七对',
  shisanyao: '十三幺',
  gangshangkaihua: '杠上开花',
};

const TIER_RANK: Record<SceneTier, number> = { basic: 0, big: 1, top: 2 };

/** Map domain patterns to the highest presentation tier. */
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

export interface WinSceneSchedulerDeps {
  now: () => number;
  /** Schedule a callback after `delayMs` (injectable for tests). */
  defer: (fn: () => void, delayMs: number) => void;
}

/**
 * Presentation seam: map HandWon winners to scene plans and enter scheduling
 * within 100 ms (ADR-0003 / ADR-0007 — tier lives only here).
 */
export class WinSceneScheduler {
  private readonly now: () => number;
  private readonly defer: (fn: () => void, delayMs: number) => void;
  private lastPlans: WinScenePlan[] = [];
  private playHandler: ((plans: WinScenePlan[]) => void) | null = null;
  private lastScheduledAt: number | null = null;

  constructor(deps: WinSceneSchedulerDeps = { now: () => performance.now(), defer: (fn, ms) => setTimeout(fn, ms) }) {
    this.now = deps.now;
    this.defer = deps.defer;
  }

  onPlay(handler: (plans: WinScenePlan[]) => void): void {
    this.playHandler = handler;
  }

  /** Enter scene scheduling for the given winners; must start within 100 ms. */
  scheduleWinners(winners: readonly WinnerResult[]): void {
    const plans = winners.map(planWinScene);
    this.lastPlans = plans;
    const scheduledAt = this.now();
    this.lastScheduledAt = scheduledAt;
    this.defer(() => {
      this.playHandler?.(plans);
    }, 0);
  }

  /** Re-enter scheduling for the last win scenes (settlement replay). */
  replay(): void {
    if (this.lastPlans.length === 0) return;
    this.scheduleWinners(
      this.lastPlans.map((plan) => ({
        seat: plan.seat,
        patterns: plan.patterns,
        fan: plan.fan,
        hand: [],
      })),
    );
  }

  /** Test seam: when scheduleWinners was last entered. */
  getLastScheduledAt(): number | null {
    return this.lastScheduledAt;
  }

  getLastPlans(): WinScenePlan[] {
    return [...this.lastPlans];
  }
}

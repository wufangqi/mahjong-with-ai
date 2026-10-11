import { describe, expect, it } from 'vitest';
import type { Seat, WinnerResult } from '../core';
import {
  orderWinnersForScenes,
  planWinScene,
  sceneTierForPatterns,
  type WinScenePlan,
  WinSceneScheduler,
} from './winPresentation';

const pinghuWinner: WinnerResult = {
  seat: 0,
  patterns: ['pinghu'],
  fan: 1,
  hand: [],
};

function deferredScheduler() {
  const deferred: Array<{ fn: () => void; ms: number; id: number }> = [];
  let nextId = 1;
  const cancelled = new Set<number>();
  const scheduler = new WinSceneScheduler({
    now: () => 0,
    defer: (fn, ms) => {
      const id = nextId++;
      deferred.push({ fn, ms, id });
      return id;
    },
    cancelDefer: (h) => {
      cancelled.add(h as number);
    },
    sceneDurationMs: 1000,
  });
  const flush = (predicate?: (item: { ms: number }) => boolean): void => {
    const idx = deferred.findIndex((d) => !cancelled.has(d.id) && (predicate ? predicate(d) : true));
    if (idx < 0) return;
    const [item] = deferred.splice(idx, 1);
    if (!item || cancelled.has(item.id)) return;
    item.fn();
  };
  const flushAll = (): void => {
    while (deferred.some((d) => !cancelled.has(d.id))) flush();
  };
  return { scheduler, deferred, flush, flushAll, cancelled };
}

describe('sceneTierForPatterns', () => {
  it('maps 平胡 to basic', () => {
    expect(sceneTierForPatterns(['pinghu'])).toBe('basic');
  });

  it('maps 碰碰胡、清一色、七对、杠上开花 to big and 十三幺 to top', () => {
    expect(sceneTierForPatterns(['pengpenghu'])).toBe('big');
    expect(sceneTierForPatterns(['qingyise'])).toBe('big');
    expect(sceneTierForPatterns(['qidui'])).toBe('big');
    expect(sceneTierForPatterns(['gangshangkaihua'])).toBe('big');
    expect(sceneTierForPatterns(['shisanyao'])).toBe('top');
  });

  it('picks the highest matched pattern tier, not total fan', () => {
    expect(sceneTierForPatterns(['qingyise', 'gangshangkaihua'])).toBe('big');
    expect(sceneTierForPatterns(['pengpenghu', 'qingyise'])).toBe('big');
    expect(sceneTierForPatterns(['qingyise', 'pengpenghu', 'shisanyao'])).toBe('top');
  });
});

describe('planWinScene', () => {
  it('builds a basic plan for 平胡 without leaking into core event shape', () => {
    const plan = planWinScene(pinghuWinner);
    expect(plan.tier).toBe('basic');
    expect(plan.bannerSub).toBe('平胡 · 1 番');
    expect(plan.patterns).toEqual(['pinghu']);
  });

  it('labels stacked 清一色 + 碰碰胡 and keeps big tier', () => {
    const plan = planWinScene({
      seat: 0,
      patterns: ['pengpenghu', 'qingyise'],
      fan: 2,
      hand: [],
    });
    expect(plan.tier).toBe('big');
    expect(plan.bannerSub).toBe('碰碰胡 · 2 番');
  });
});

describe('orderWinnersForScenes', () => {
  it('orders by top → big → basic, then same tier from discarder next seat', () => {
    const winners: WinnerResult[] = [
      { seat: 0, patterns: ['pinghu'], fan: 1, hand: [] },
      { seat: 2, patterns: ['qidui'], fan: 1, hand: [] },
      { seat: 3, patterns: ['shisanyao'], fan: 1, hand: [] },
      { seat: 1, patterns: ['qingyise'], fan: 1, hand: [] },
    ];
    expect(orderWinnersForScenes(winners, 0).map((w) => w.seat)).toEqual([3, 1, 2, 0]);
  });
});

describe('WinSceneScheduler', () => {
  it('maps 平胡 to basic and enters scheduling within 100 ms', () => {
    let clock = 0;
    const deferred: Array<{ fn: () => void; ms: number }> = [];
    const queued: unknown[] = [];

    const scheduler = new WinSceneScheduler({
      now: () => clock,
      defer: (fn, ms) => deferred.push({ fn, ms }),
      sceneDurationMs: 1000,
    });
    scheduler.onPlay((plans) => queued.push(plans));

    const requestAt = clock;
    scheduler.scheduleWinners([pinghuWinner], 1);
    expect(scheduler.getLastScheduledAt()).toBe(requestAt);
    expect((scheduler.getLastScheduledAt() ?? 0) - requestAt).toBeLessThan(100);

    clock += 16;
    expect(deferred[0]!.ms).toBeLessThan(100);
    deferred[0]!.fn();

    expect(queued).toEqual([
      [expect.objectContaining({ tier: 'basic', patterns: ['pinghu'], fan: 1 })],
    ]);
  });

  it('schedules multi-win scenes in presentation order', () => {
    const { scheduler, flush } = deferredScheduler();
    const queued: WinScenePlan[][] = [];
    const scenes: Seat[] = [];
    scheduler.onPlay((plans) => queued.push(plans));
    scheduler.onScene((plan) => scenes.push(plan.seat));

    scheduler.scheduleWinners(
      [
        { seat: 0, patterns: ['pinghu'], fan: 1, hand: [] },
        { seat: 2, patterns: ['qidui'], fan: 1, hand: [] },
        { seat: 3, patterns: ['shisanyao'], fan: 1, hand: [] },
      ],
      1,
    );
    flush((d) => d.ms === 0);

    expect(queued[0]!.map((p) => p.seat)).toEqual([3, 2, 0]);
    expect(queued[0]!.map((p) => p.tier)).toEqual(['top', 'big', 'basic']);
    expect(scenes).toEqual([3]);
  });

  it('plays scenes sequentially and skips the current one', () => {
    const { scheduler, flush } = deferredScheduler();
    const scenes: number[] = [];
    let idle = 0;
    scheduler.onScene((plan) => scenes.push(plan.seat));
    scheduler.onIdle(() => {
      idle += 1;
    });

    scheduler.scheduleWinners(
      [
        { seat: 3, patterns: ['shisanyao'], fan: 1, hand: [] },
        { seat: 2, patterns: ['qidui'], fan: 1, hand: [] },
        { seat: 0, patterns: ['pinghu'], fan: 1, hand: [] },
      ],
      1,
    );
    flush((d) => d.ms === 0);
    expect(scenes).toEqual([3]);
    expect(scheduler.isPlaying()).toBe(true);

    scheduler.skip();
    expect(scenes).toEqual([3, 2]);
    scheduler.skip();
    expect(scenes).toEqual([3, 2, 0]);
    scheduler.skip();
    expect(scheduler.isPlaying()).toBe(false);
    expect(idle).toBe(1);
  });

  it('auto-skips opponent scenes but keeps the player scene', () => {
    const { scheduler, flush, deferred } = deferredScheduler();
    const scenes: number[] = [];
    scheduler.setAutoSkipOpponent(true);
    scheduler.onScene((plan) => scenes.push(plan.seat));

    scheduler.scheduleWinners(
      [
        { seat: 3, patterns: ['shisanyao'], fan: 1, hand: [] },
        { seat: 0, patterns: ['pinghu'], fan: 1, hand: [] },
      ],
      1,
    );
    flush((d) => d.ms === 0); // begin queue → play seat 3
    flush((d) => d.ms === 0); // auto-skip opponent
    expect(scenes).toEqual([3, 0]);
    // player scene uses full duration
    expect(deferred.some((d) => d.ms === 1000)).toBe(true);
  });

  it('replays the last planned scenes and a single seat', () => {
    const { scheduler, flush } = deferredScheduler();
    const queued: unknown[] = [];
    const scenes: number[] = [];
    scheduler.onPlay((plans) => queued.push(plans));
    scheduler.onScene((plan) => scenes.push(plan.seat));

    scheduler.scheduleWinners(
      [
        { seat: 2, patterns: ['qidui'], fan: 1, hand: [] },
        { seat: 0, patterns: ['pinghu'], fan: 1, hand: [] },
      ],
      1,
    );
    flush((d) => d.ms === 0);
    scheduler.skip();
    scheduler.skip();
    expect(scheduler.isPlaying()).toBe(false);

    scheduler.replay();
    flush((d) => d.ms === 0);
    expect(queued).toHaveLength(2);
    expect(queued[1]).toEqual([
      expect.objectContaining({ seat: 2, tier: 'big' }),
      expect.objectContaining({ seat: 0, tier: 'basic' }),
    ]);

    scenes.length = 0;
    scheduler.replaySeat(0);
    flush((d) => d.ms === 0);
    expect(scenes).toEqual([0]);
  });
});

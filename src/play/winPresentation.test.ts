import { describe, expect, it } from 'vitest';
import type { WinnerResult } from '../core';
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
    // 2 fan of big patterns stay big — fan count never promotes to top
    expect(sceneTierForPatterns(['qingyise', 'gangshangkaihua'])).toBe('big');
    expect(sceneTierForPatterns(['pengpenghu', 'qingyise'])).toBe('big');
    // A top pattern still wins over stacked big fans
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
    // Discarder 0 → seat order after: 1, 2, 3. Tiers: 3 top, 1+2 big (1 before 2), 0 basic.
    expect(orderWinnersForScenes(winners, 0).map((w) => w.seat)).toEqual([3, 1, 2, 0]);
  });
});

describe('WinSceneScheduler', () => {
  it('maps 平胡 to basic and enters scheduling within 100 ms', () => {
    let clock = 0;
    const deferred: Array<{ fn: () => void; ms: number }> = [];
    const played: unknown[] = [];

    const scheduler = new WinSceneScheduler({
      now: () => clock,
      defer: (fn, ms) => deferred.push({ fn, ms }),
    });
    scheduler.onPlay((plans) => played.push(plans));

    const requestAt = clock;
    scheduler.scheduleWinners([pinghuWinner], 1);
    expect(scheduler.getLastScheduledAt()).toBe(requestAt);
    expect((scheduler.getLastScheduledAt() ?? 0) - requestAt).toBeLessThan(100);

    clock += 16;
    expect(deferred).toHaveLength(1);
    expect(deferred[0]!.ms).toBeLessThan(100);
    deferred[0]!.fn();

    expect(played).toEqual([
      [expect.objectContaining({ tier: 'basic', patterns: ['pinghu'], fan: 1 })],
    ]);
  });

  it('schedules multi-win scenes in presentation order', () => {
    const deferred: Array<() => void> = [];
    const played: WinScenePlan[][] = [];
    const scheduler = new WinSceneScheduler({
      now: () => 0,
      defer: (fn) => deferred.push(fn),
    });
    scheduler.onPlay((plans) => played.push(plans));

    scheduler.scheduleWinners(
      [
        { seat: 0, patterns: ['pinghu'], fan: 1, hand: [] },
        { seat: 2, patterns: ['qidui'], fan: 1, hand: [] },
        { seat: 3, patterns: ['shisanyao'], fan: 1, hand: [] },
      ],
      1,
    );
    deferred.shift()?.();

    // Discarder 1 → after: 2,3,0. Order: top(3), big(2), basic(0).
    expect(played[0]!.map((p) => p.seat)).toEqual([3, 2, 0]);
    expect(played[0]!.map((p) => p.tier)).toEqual(['top', 'big', 'basic']);
  });

  it('replays the last planned scene', () => {
    const deferred: Array<() => void> = [];
    const played: unknown[] = [];
    const scheduler = new WinSceneScheduler({
      now: () => 0,
      defer: (fn) => deferred.push(fn),
    });
    scheduler.onPlay((plans) => played.push(plans));

    scheduler.scheduleWinners([pinghuWinner], 1);
    deferred.shift()?.();
    scheduler.replay();
    deferred.shift()?.();

    expect(played).toHaveLength(2);
    expect(played[1]).toEqual([expect.objectContaining({ tier: 'basic' })]);
  });
});

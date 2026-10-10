import { describe, expect, it } from 'vitest';
import type { WinnerResult } from '../core';
import {
  planWinScene,
  sceneTierForPatterns,
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

  it('maps 七对 to big and 十三幺 to top', () => {
    expect(sceneTierForPatterns(['qidui'])).toBe('big');
    expect(sceneTierForPatterns(['shisanyao'])).toBe('top');
  });
});

describe('planWinScene', () => {
  it('builds a basic plan for 平胡 without leaking into core event shape', () => {
    const plan = planWinScene(pinghuWinner);
    expect(plan.tier).toBe('basic');
    expect(plan.bannerSub).toBe('平胡 · 1 番');
    expect(plan.patterns).toEqual(['pinghu']);
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
    scheduler.scheduleWinners([pinghuWinner]);
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

  it('replays the last planned scene', () => {
    const deferred: Array<() => void> = [];
    const played: unknown[] = [];
    const scheduler = new WinSceneScheduler({
      now: () => 0,
      defer: (fn) => deferred.push(fn),
    });
    scheduler.onPlay((plans) => played.push(plans));

    scheduler.scheduleWinners([pinghuWinner]);
    deferred.shift()?.();
    scheduler.replay();
    deferred.shift()?.();

    expect(played).toHaveLength(2);
    expect(played[1]).toEqual([expect.objectContaining({ tier: 'basic' })]);
  });
});

import { describe, expect, it } from 'vitest';
import { LoadProgressTracker, LOAD_STAGES } from './loadProgress';

describe('LoadProgressTracker', () => {
  it('starts at fonts stage with zero progress', () => {
    const t = new LoadProgressTracker();
    const snap = t.snapshot();
    expect(snap.fraction).toBe(0);
    expect(snap.label).toBe('加载字体');
    expect(snap.done).toBe(false);
    expect(snap.completed).toEqual([]);
  });

  it('advances only when real stages complete and reaches 1 at menu', () => {
    const t = new LoadProgressTracker();
    const afterFonts = t.complete('fonts');
    expect(afterFonts.fraction).toBeCloseTo(0.35, 5);
    expect(afterFonts.completed).toEqual(['fonts']);

    t.complete('default-theme');
    t.complete('renderer');
    const ready = t.complete('menu');
    expect(ready.done).toBe(true);
    expect(ready.fraction).toBe(1);
    expect(ready.label).toBe('就绪');
    expect(ready.completed).toEqual(LOAD_STAGES.map((s) => s.id));
  });
});

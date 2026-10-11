export type LoadStageId = 'fonts' | 'default-theme' | 'renderer' | 'menu';

export type LoadStage = {
  id: LoadStageId;
  label: string;
  weight: number;
};

/** Ordered boot stages that contribute to the real loading bar (AC15). */
export const LOAD_STAGES: readonly LoadStage[] = [
  { id: 'fonts', label: '加载字体', weight: 0.35 },
  { id: 'default-theme', label: '加载默认主题', weight: 0.25 },
  { id: 'renderer', label: '准备桌面', weight: 0.25 },
  { id: 'menu', label: '进入主菜单', weight: 0.15 },
] as const;

export type LoadProgressSnapshot = {
  fraction: number;
  label: string;
  completed: LoadStageId[];
  done: boolean;
};

/**
 * Tracks weighted boot progress. Fraction only advances when a real stage completes —
 * no fake timers.
 */
export class LoadProgressTracker {
  private completed = new Set<LoadStageId>();

  complete(stage: LoadStageId): LoadProgressSnapshot {
    this.completed.add(stage);
    return this.snapshot();
  }

  snapshot(): LoadProgressSnapshot {
    let fraction = 0;
    let label = LOAD_STAGES[0]!.label;
    for (const stage of LOAD_STAGES) {
      if (this.completed.has(stage.id)) {
        fraction += stage.weight;
        label = stage.label;
      } else {
        label = stage.label;
        break;
      }
    }
    const done = this.completed.size >= LOAD_STAGES.length;
    if (done) {
      fraction = 1;
      label = '就绪';
    }
    return {
      fraction: Math.min(1, fraction),
      label,
      completed: LOAD_STAGES.filter((s) => this.completed.has(s.id)).map((s) => s.id),
      done,
    };
  }
}

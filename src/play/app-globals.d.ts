import type { Command, Seat } from '../core';
import type { MatchSnapshot } from '../game/match';
import type { PlaySessionSnapshot } from '../game/session';
import type { ReducedMotionMode } from '../motion';
import type { GpuProbeInfo, QualityMode, QualitySettings, QualityTier } from '../quality/types';
import type { ThemeId, ThemeModules, ThemePalette, ThemeSelectResult } from '../theme/types';
import type { SceneTier, WinScenePlan } from './winPresentation';

declare global {
  interface Window {
    __play?: {
      ready: boolean;
      start: (seed: number) => Promise<void>;
      startMatch: (seed: number) => Promise<void>;
      continueMatch: () => void;
      endMatch: () => void;
      matchSnapshot: () => MatchSnapshot;
      snapshot: () => PlaySessionSnapshot;
      actionLog: () => Command[];
      exportJson: () => Promise<string>;
      clearLocalData: () => Promise<void>;
      isContextLost: () => boolean;
      loseWebGLContext: () => boolean;
      restoreWebGLContext: () => boolean;
      forceContextRestore: () => void;
      refreshPersistMenu: () => Promise<void>;
      hasContinue: () => boolean;
      incompatibleReason: () => string | null;
      replayActionLog: (commands: Command[]) => void;
      waitPersist: () => Promise<void>;
      clickTile: (tileId: string) => Promise<void>;
      discardByDrag: (tileId: string) => Promise<void>;
      autoPlayToDraw: () => Promise<void>;
      claimWin: () => Promise<void>;
      claimPung: () => Promise<void>;
      claimChow: (tileIds: [string, string]) => Promise<void>;
      passWin: () => Promise<void>;
      passResponse: () => Promise<void>;
      startNextHand: (seed?: number) => Promise<void>;
      loadPinghuWinDemo: () => Promise<void>;
      replayScene: () => void;
      replaySeat: (seat: Seat) => void;
      skipScene: () => void;
      isScenePlaying: () => boolean;
      lastScenePlans: () => WinScenePlan[];
      setMasterVolume: (v: number) => void;
      setSfxVolume: (v: number) => void;
      masterVolume: () => number;
      sfxVolume: () => number;
      setReducedMotion: (mode: ReducedMotionMode) => void;
      reducedMotionMode: () => ReducedMotionMode;
      reducedMotionEnabled: () => boolean;
      setAutoSkipOpponent: (enabled: boolean) => void;
      autoSkipOpponent: () => boolean;
      selectTheme: (id: ThemeId) => Promise<ThemeSelectResult>;
      activeThemeId: () => ThemeId;
      themeApplied: () => ThemeModules;
      scenePalette: () => ThemePalette | null;
      themeNotices: () => string[];
      themeRefCount: (id: ThemeId) => number;
      themeRetained: (id: ThemeId) => boolean;
      ambientParticleKind: () => 'dust' | 'petals' | null;
      ambientParticleBackend: () => 'gpu' | 'cpu' | null;
      tileBackPattern: () => 'solid' | 'cloud';
      qualityTier: () => QualityTier;
      qualityMode: () => QualityMode;
      qualitySettings: () => QualitySettings;
      setQuality: (tier: QualityTier | 'auto') => QualityTier;
      pinAutoQuality: (tier: QualityTier) => QualityTier;
      beginQualityGame: () => void;
      endQualityGame: () => void;
      injectFpsSample: (dtMs: number, fps: number) => QualityTier | null;
      gpuProbe: () => GpuProbeInfo;
      drawCallCount: () => number;
      sampleFps: (ms?: number) => Promise<number>;
      heapUsed: () => number | null;
      gpuResourceSnapshot: () => { geometries: number; textures: number; programs: number };
      hasSustainedGrowth: (
        samples: number[],
        opts?: { maxBytesPerStep?: number; minDeltaBytes?: number },
      ) => boolean;
      playSceneDemo: (tier: SceneTier) => void;
    };
  }
}

export {};

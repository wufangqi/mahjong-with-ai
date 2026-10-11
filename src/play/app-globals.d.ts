import type { Command } from '../core';
import type { MatchSnapshot } from '../game/match';
import type { PlaySessionSnapshot } from '../game/session';
import type { GpuProbeInfo, QualityMode, QualitySettings, QualityTier } from '../quality/types';
import type { ThemeId, ThemeModules, ThemePalette, ThemeSelectResult } from '../theme/types';
import type { WinScenePlan } from './winPresentation';

declare global {
  interface Window {
    __play?: {
      ready: boolean;
      start: (seed: number) => void;
      startMatch: (seed: number) => void;
      continueMatch: () => void;
      endMatch: () => void;
      matchSnapshot: () => MatchSnapshot;
      snapshot: () => PlaySessionSnapshot;
      actionLog: () => Command[];
      exportJson: () => Promise<string>;
      clearLocalData: () => Promise<void>;
      refreshPersistMenu: () => Promise<void>;
      hasContinue: () => boolean;
      incompatibleReason: () => string | null;
      replayActionLog: (commands: Command[]) => void;
      waitPersist: () => Promise<void>;
      clickTile: (tileId: string) => void;
      discardByDrag: (tileId: string) => void;
      autoPlayToDraw: () => void;
      claimWin: () => void;
      claimPung: () => void;
      claimChow: (tileIds: [string, string]) => void;
      passWin: () => void;
      passResponse: () => void;
      startNextHand: (seed?: number) => void;
      loadPinghuWinDemo: () => void;
      replayScene: () => void;
      lastScenePlans: () => WinScenePlan[];
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
    };
  }
}

export {};

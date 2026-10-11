import type { MatchSnapshot } from '../game/match';
import type { PlaySessionSnapshot } from '../game/session';
import type { GpuProbeInfo, QualityMode, QualitySettings, QualityTier } from '../quality/types';
import type { ThemeId, ThemeModules, ThemePalette, ThemeSelectResult } from '../theme/types';
import type { WinScenePlan } from './winPresentation';

declare global {
  interface Window {
    __play?: {
      ready: boolean;
      start: (seed: number) => Promise<void>;
      startMatch: (seed: number) => Promise<void>;
      endMatch: () => void;
      matchSnapshot: () => MatchSnapshot;
      snapshot: () => PlaySessionSnapshot;
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

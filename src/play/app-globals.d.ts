import type { PlaySessionSnapshot } from '../game/session';
import type { WinScenePlan } from './winPresentation';

declare global {
  interface Window {
    __play?: {
      ready: boolean;
      start: (seed: number) => void;
      snapshot: () => PlaySessionSnapshot;
      clickTile: (tileId: string) => void;
      discardByDrag: (tileId: string) => void;
      autoPlayToDraw: () => void;
      claimWin: () => void;
      claimPung: () => void;
      claimChow: (tileIds: [string, string]) => void;
      passWin: () => void;
      passResponse: () => void;
      startNextHand: (seed: number) => void;
      loadPinghuWinDemo: () => void;
      replayScene: () => void;
      lastScenePlans: () => WinScenePlan[];
    };
  }
}

export {};

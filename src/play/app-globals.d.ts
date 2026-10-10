import type { PlaySessionSnapshot } from '../game/session';

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
    };
  }
}

export {};

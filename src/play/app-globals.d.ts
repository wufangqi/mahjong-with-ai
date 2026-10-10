import type { PlaySessionSnapshot } from '../game/session';

declare global {
  interface Window {
    __play?: {
      ready: boolean;
      start: (seed: number) => void;
      snapshot: () => PlaySessionSnapshot;
      clickTile: (tileId: string) => void;
      discardByDrag: (tileId: string) => void;
    };
  }
}

export {};

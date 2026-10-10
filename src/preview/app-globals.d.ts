import type { HandName } from './fixedHands';

type EffectName = Exclude<HandName, 'idle'>;

interface PreviewAppState {
  effect: unknown;
  timeScale: number;
  dolly: number;
  camLift: number;
  shake: number;
  flash: number;
  bloomBoost: number;
  fxLight: number;
}

declare global {
  interface Window {
    __app?: {
      play: (name: EffectName) => void;
      ready: boolean;
      st: PreviewAppState;
      particleBackend: () => 'gpu' | 'cpu';
      gpuParticlesAvailable: () => boolean;
    };
  }
}

export {};

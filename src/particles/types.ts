import type * as THREE from 'three';
import type { ParticleBackend } from '../quality/types';

export type AmbientParticleKind = 'dust' | 'petals';

export interface ParticleEmit {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  color: [number, number, number];
  size?: number;
  life?: number;
  gravity?: number;
  drag?: number;
  twinkle?: number;
}

/** Public seam: GPU or CPU particle pool used by ambient and win scenes. */
export interface ParticleSystem {
  readonly backend: ParticleBackend;
  readonly points: THREE.Points;
  readonly capacity: number;
  emit(p: ParticleEmit): void;
  update(dt: number): void;
  clear(): void;
  setBudget(count: number): void;
  dispose(): void;
}

export interface CreateParticleSystemOptions {
  capacity: number;
  /** Prefer GPU ShaderMaterial path when available. */
  preferGpu: boolean;
  /** Injected for tests; default probes ShaderMaterial compilation. */
  gpuAvailable?: boolean;
}

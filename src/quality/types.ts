/** 画质档 — low / mid / high (domain: 画质档; avoid 特效档). */
export type QualityTier = 'low' | 'mid' | 'high';

export type ShadowQuality = 'off' | 'low' | 'mid' | 'high';
export type BloomQuality = 'off' | 'half' | 'full';
export type SkyQuality = 'simplified' | 'full';
export type ParticleBackend = 'gpu' | 'cpu';

export interface QualitySettings {
  tier: QualityTier;
  /** Cap for `renderer.setPixelRatio`. */
  dprCap: number;
  shadows: ShadowQuality;
  /** Shadow map size when shadows are enabled. */
  shadowMapSize: number;
  bloom: BloomQuality;
  /** Max ambient / scene particles for this tier. */
  particleBudget: number;
  /** Preferred particle path; runtime may still fall back to CPU. */
  preferGpuParticles: boolean;
  sky: SkyQuality;
  /** Gameplay FPS target used by auto-downgrade. */
  targetFps: number;
}

export type QualityMode = 'auto' | 'manual';

export interface GpuProbeInfo {
  /** WEBGL_debug_renderer_info unmasked renderer, or empty. */
  renderer: string;
  /** True when WebGL2 context exists. */
  webgl2: boolean;
  /** True when custom ShaderMaterial points path is believed usable. */
  gpuParticlesAvailable: boolean;
}

export const QUALITY_STORAGE_KEY = 'mahjong.quality.v1';
export const QUALITY_MODE_STORAGE_KEY = 'mahjong.quality.mode.v1';

export const QUALITY_TIERS: readonly QualityTier[] = ['low', 'mid', 'high'] as const;

export function isQualityTier(value: string): value is QualityTier {
  return value === 'low' || value === 'mid' || value === 'high';
}

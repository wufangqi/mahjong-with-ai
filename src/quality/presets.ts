import type { QualitySettings, QualityTier } from './types';

/** Spec §11.1 — low / mid / high control DPR, shadows, Bloom, particles, sky. */
export const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  low: {
    tier: 'low',
    dprCap: 1,
    shadows: 'off',
    shadowMapSize: 512,
    bloom: 'off',
    particleBudget: 32,
    preferGpuParticles: false,
    sky: 'simplified',
    targetFps: 45,
  },
  mid: {
    tier: 'mid',
    dprCap: 1.5,
    shadows: 'mid',
    shadowMapSize: 1024,
    bloom: 'full',
    particleBudget: 96,
    preferGpuParticles: true,
    sky: 'full',
    targetFps: 60,
  },
  high: {
    tier: 'high',
    dprCap: 2,
    shadows: 'high',
    shadowMapSize: 2048,
    bloom: 'full',
    particleBudget: 256,
    preferGpuParticles: true,
    sky: 'full',
    targetFps: 60,
  },
};

export function settingsForTier(tier: QualityTier): QualitySettings {
  return { ...QUALITY_PRESETS[tier] };
}

const TIER_RANK: Record<QualityTier, number> = { low: 0, mid: 1, high: 2 };

export function lowerTier(tier: QualityTier): QualityTier | null {
  if (tier === 'high') return 'mid';
  if (tier === 'mid') return 'low';
  return null;
}

export function tierRank(tier: QualityTier): number {
  return TIER_RANK[tier];
}

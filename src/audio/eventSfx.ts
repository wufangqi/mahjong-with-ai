import type { DomainEvent } from '../core';
import type { SfxId } from './types';

/** Map a domain event to at most one local SFX id (presentation concern). */
export function sfxForDomainEvent(event: DomainEvent): SfxId | null {
  switch (event.type) {
    case 'TileDrawn':
      return 'draw';
    case 'TileDiscarded':
      return 'discard';
    case 'MeldFormed':
      if (event.kind === 'chow') return 'chow';
      if (event.kind === 'pung') return 'pung';
      return 'kong';
    case 'HandWon':
      return 'win';
    default:
      return null;
  }
}

export function sfxForSceneTier(tier: 'basic' | 'big' | 'top'): SfxId {
  if (tier === 'top') return 'scene_top';
  if (tier === 'big') return 'scene_big';
  return 'scene_basic';
}

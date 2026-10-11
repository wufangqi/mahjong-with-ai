import { describe, expect, it } from 'vitest';
import type { DomainEvent, PhysicalTile } from '../core';
import { sfxForDomainEvent, sfxForSceneTier } from './eventSfx';

const tile: PhysicalTile = { id: 'a', code: 'm1' };

describe('sfxForDomainEvent', () => {
  it('maps draw, discard, melds, and win', () => {
    const drawn: DomainEvent = { type: 'TileDrawn', seat: 0, tile, kind: 'normal' };
    const discarded: DomainEvent = { type: 'TileDiscarded', seat: 0, tile };
    expect(sfxForDomainEvent(drawn)).toBe('draw');
    expect(sfxForDomainEvent(discarded)).toBe('discard');
    expect(
      sfxForDomainEvent({
        type: 'MeldFormed',
        seat: 1,
        kind: 'chow',
        tiles: [],
        fromSeat: 0,
        claimedTileId: 'a',
      }),
    ).toBe('chow');
    expect(
      sfxForDomainEvent({
        type: 'MeldFormed',
        seat: 1,
        kind: 'pung',
        tiles: [],
        fromSeat: 0,
        claimedTileId: 'a',
      }),
    ).toBe('pung');
    expect(
      sfxForDomainEvent({
        type: 'MeldFormed',
        seat: 1,
        kind: 'exposed_kong',
        tiles: [],
        fromSeat: 0,
        claimedTileId: 'a',
      }),
    ).toBe('kong');
    expect(
      sfxForDomainEvent({
        type: 'HandWon',
        winners: [],
        discarder: 0,
        tile,
        winKind: 'discard',
      }),
    ).toBe('win');
  });
});

describe('sfxForSceneTier', () => {
  it('maps three win-scene tiers', () => {
    expect(sfxForSceneTier('basic')).toBe('scene_basic');
    expect(sfxForSceneTier('big')).toBe('scene_big');
    expect(sfxForSceneTier('top')).toBe('scene_top');
  });
});

import { describe, expect, it } from 'vitest';
import { READ_ONLY_PROTOTYPE_PATH } from './prototypeIsolation';

describe('prototype isolation', () => {
  it('names the read-only Demo path outside the production src tree', () => {
    expect(READ_ONLY_PROTOTYPE_PATH).toBe('prototype/mahjong-win-demo');
    expect(READ_ONLY_PROTOTYPE_PATH.startsWith('src/')).toBe(false);
  });
});

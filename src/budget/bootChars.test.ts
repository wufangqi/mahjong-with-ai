import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { requiredRuntimeGlyphs } from './requiredGlyphs';

const charsRuntime = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../tools/font-subset/chars-runtime.txt'),
  'utf8',
);

describe('boot loading copy ⊆ font subset (ADR-0006 / story 104)', () => {
  it('covers LOAD_STAGES labels, 就绪, 加载进度, and UI punctuation', () => {
    const missing = [...new Set(requiredRuntimeGlyphs())].filter(
      (ch) => !/\s/.test(ch) && !charsRuntime.includes(ch),
    );
    expect(missing).toEqual([]);
  });
});

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { requiredRuntimeGlyphs } from './requiredGlyphs';

const require = createRequire(import.meta.url);
// fontkit is CJS
const fontkit = require('fontkit') as {
  openSync: (path: string) => { hasGlyphForCodePoint: (cp: number) => boolean };
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function missingFromFont(woff2Path: string, need: string): string[] {
  const font = fontkit.openSync(woff2Path);
  const unique = [...new Set(need)];
  return unique.filter((ch) => {
    if (/\s/.test(ch)) return false;
    const cp = ch.codePointAt(0);
    return cp != null && !font.hasGlyphForCodePoint(cp);
  });
}

describe('shipped WOFF2 cmap covers runtime UI glyphs (ADR-0006)', () => {
  const need = requiredRuntimeGlyphs();

  it('chars-runtime.txt includes boot copy and UI punctuation', () => {
    const charsRuntime = readFileSync(
      resolve(root, 'tools/font-subset/chars-runtime.txt'),
      'utf8',
    );
    const missing = [...new Set(need)].filter(
      (ch) => !/\s/.test(ch) && !charsRuntime.includes(ch),
    );
    expect(missing).toEqual([]);
  });

  it('sans WOFF2 cmap includes required glyphs including 、…。', () => {
    const miss = missingFromFont(
      resolve(root, 'src/fonts/source-han-sans-sc-subset.woff2'),
      need,
    );
    expect(miss).toEqual([]);
  });

  it('serif WOFF2 cmap includes required glyphs including 、…。', () => {
    const miss = missingFromFont(
      resolve(root, 'src/fonts/source-han-serif-sc-subset.woff2'),
      need,
    );
    expect(miss).toEqual([]);
  });
});

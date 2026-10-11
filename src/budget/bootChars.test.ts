import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOAD_STAGES } from './loadProgress';

const charsRuntime = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../tools/font-subset/chars-runtime.txt'),
  'utf8',
);

describe('boot loading copy ⊆ font subset (ADR-0006 / story 104)', () => {
  it('covers LOAD_STAGES labels, 就绪, and 加载进度 aria copy', () => {
    const phrases = [...LOAD_STAGES.map((s) => s.label), '就绪', '加载进度'];
    const missing: string[] = [];
    for (const phrase of phrases) {
      for (const ch of phrase) {
        if (/\s/.test(ch)) continue;
        if (!charsRuntime.includes(ch)) missing.push(`${phrase}:${ch}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

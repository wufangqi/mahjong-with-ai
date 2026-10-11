import { gzipSync } from 'node:zlib';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { FIRST_SCREEN_TRANSFER_BUDGET_BYTES, THEME_ON_DEMAND_BUDGET_BYTES } from './limits';

export type TransferEntry = {
  path: string;
  bytes: number;
  encoding: 'gzip' | 'raw';
};

export type FirstScreenReport = {
  entries: TransferEntry[];
  totalBytes: number;
  budgetBytes: number;
  withinBudget: boolean;
};

export type ThemeChunkReport = {
  themeId: string;
  entries: TransferEntry[];
  totalBytes: number;
  budgetBytes: number;
  withinBudget: boolean;
};

function transferSize(absPath: string): TransferEntry {
  const raw = readFileSync(absPath);
  const encoding = absPath.endsWith('.woff2') || absPath.endsWith('.png') || absPath.endsWith('.jpg')
    ? 'raw'
    : 'gzip';
  const bytes = encoding === 'raw' ? raw.byteLength : gzipSync(raw, { level: 9 }).byteLength;
  return { path: absPath, bytes, encoding };
}

function uniqueResolved(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const abs = resolve(p);
    if (!existsSync(abs) || seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  return out;
}

/** Collect static ES module graph starting from entry script (relative `./` imports only). */
export function collectStaticModuleGraph(entryAbs: string): string[] {
  const queue = [resolve(entryAbs)];
  const seen = new Set<string>();
  const out: string[] = [];
  const importRe = /(?:from|import)\s*["'](\.\/[^"']+)["']/g;

  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    out.push(file);
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(importRe)) {
      const rel = match[1]!;
      queue.push(resolve(dirname(file), rel));
    }
  }
  return out;
}

function cssUrlAssets(cssAbs: string): string[] {
  if (!existsSync(cssAbs)) return [];
  const text = readFileSync(cssAbs, 'utf8');
  const out: string[] = [];
  for (const match of text.matchAll(/url\(([^)]+)\)/g)) {
    const raw = match[1]!.trim().replace(/^['"]|['"]$/g, '');
    out.push(resolve(dirname(cssAbs), raw));
  }
  return out;
}

/**
 * First-screen compressed transfer: index.html + its CSS/JS module graph + font files.
 * Excludes preview entry and on-demand theme chunks (e.g. courtPalace).
 */
export function measureFirstScreenTransfer(distDir: string): FirstScreenReport {
  const root = resolve(distDir);
  const indexPath = join(root, 'index.html');
  const html = readFileSync(indexPath, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="\.?\/?([^"]+)"/g)].map((m) => m[1]!);
  const cssRefs = refs.filter((r) => r.endsWith('.css')).map((r) => join(root, r));
  const jsEntry = refs.find((r) => r.includes('main-') && r.endsWith('.js'));
  if (!jsEntry) {
    throw new Error('index.html missing main-*.js entry');
  }

  const graph = collectStaticModuleGraph(join(root, jsEntry));
  const fontFromCss = cssRefs.flatMap(cssUrlAssets);
  const candidates = uniqueResolved([
    indexPath,
    ...refs.map((r) => join(root, r)),
    ...graph,
    ...fontFromCss,
  ]).filter((p) => !p.includes('preview') && !p.includes('courtPalace'));

  const entries = candidates.map((p) => {
    const e = transferSize(p);
    return { ...e, path: p.slice(root.length + 1).replace(/\\/g, '/') };
  });
  const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);
  return {
    entries,
    totalBytes,
    budgetBytes: FIRST_SCREEN_TRANSFER_BUDGET_BYTES,
    withinBudget: totalBytes <= FIRST_SCREEN_TRANSFER_BUDGET_BYTES,
  };
}

/** On-demand theme chunk size (court-palace dynamic import). */
export function measureThemeOnDemandChunk(distDir: string, themeFileStem = 'courtPalace'): ThemeChunkReport {
  const root = resolve(distDir);
  const assetsDir = join(root, 'assets');
  const files = readdirSync(assetsDir).filter(
    (name: string) =>
      name.startsWith(themeFileStem) && (name.endsWith('.js') || name.endsWith('.css')),
  );
  if (files.length === 0) {
    throw new Error(`no on-demand theme chunk matching ${themeFileStem}-* in dist/assets`);
  }
  const entries = files.map((name: string) => {
    const e = transferSize(join(assetsDir, name));
    return { ...e, path: `assets/${name}` };
  });
  const totalBytes = entries.reduce((sum: number, e: TransferEntry) => sum + e.bytes, 0);
  return {
    themeId: 'court-palace',
    entries,
    totalBytes,
    budgetBytes: THEME_ON_DEMAND_BUDGET_BYTES,
    withinBudget: totalBytes <= THEME_ON_DEMAND_BUDGET_BYTES,
  };
}

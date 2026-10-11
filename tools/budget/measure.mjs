#!/usr/bin/env node
/**
 * Repeatable MVP transfer-budget measurement (WUF-65 / AC14 + theme ≤1 MB).
 *
 * Usage:
 *   npm run build && npm run budget:measure
 *   node tools/budget/measure.mjs --out path/to/report.json
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const distDir = resolve(root, 'dist');

const outArg = process.argv.indexOf('--out');
const outPath =
  outArg >= 0 && process.argv[outArg + 1]
    ? resolve(process.cwd(), process.argv[outArg + 1])
    : resolve(root, '.aidlc/issues/wuf-49-ai-shuanghu-mvp/dev/wuf-65/budget-report.json');

function transferSize(absPath) {
  const raw = readFileSync(absPath);
  const encoding = absPath.endsWith('.woff2') ? 'raw' : 'gzip';
  const bytes = encoding === 'raw' ? raw.byteLength : gzipSync(raw, { level: 9 }).byteLength;
  return { path: absPath, bytes, encoding };
}

function collectStaticModuleGraph(entryAbs) {
  const queue = [entryAbs];
  const seen = new Set();
  const out = [];
  const importRe = /(?:from|import)\s*["'](\.\/[^"']+)["']/g;
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    out.push(file);
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(importRe)) {
      queue.push(resolve(dirname(file), match[1]));
    }
  }
  return out;
}

function measureFirstScreen() {
  const indexPath = join(distDir, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error('dist/ missing — run npm run build first');
  }
  const html = readFileSync(indexPath, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="\.?\/?([^"]+)"/g)].map((m) => m[1]);
  const jsEntry = refs.find((r) => r.includes('main-') && r.endsWith('.js'));
  if (!jsEntry) throw new Error('main-*.js entry missing from index.html');
  const graph = collectStaticModuleGraph(join(distDir, jsEntry));
  const cssRefs = refs.filter((r) => r.endsWith('.css')).map((r) => join(distDir, r));
  const fonts = [];
  for (const css of cssRefs) {
    const text = readFileSync(css, 'utf8');
    for (const m of text.matchAll(/url\(([^)]+)\)/g)) {
      fonts.push(resolve(dirname(css), m[1].trim().replace(/^['"]|['"]$/g, '')));
    }
  }
  const seen = new Set();
  const entries = [];
  for (const p of [indexPath, ...refs.map((r) => join(distDir, r)), ...graph, ...fonts]) {
    const abs = resolve(p);
    if (!existsSync(abs) || seen.has(abs)) continue;
    if (abs.includes('preview') || abs.includes('courtPalace')) continue;
    seen.add(abs);
    const e = transferSize(abs);
    entries.push({ ...e, path: abs.slice(distDir.length + 1).replace(/\\/g, '/') });
  }
  const totalBytes = entries.reduce((s, e) => s + e.bytes, 0);
  const budgetBytes = 3 * 1024 * 1024;
  return {
    entries,
    totalBytes,
    budgetBytes,
    withinBudget: totalBytes <= budgetBytes,
  };
}

function measureThemeOnDemand() {
  const assetsDir = join(distDir, 'assets');
  const themeFiles = readdirSync(assetsDir).filter(
    (n) => n.startsWith('courtPalace') && (n.endsWith('.js') || n.endsWith('.css')),
  );
  if (themeFiles.length === 0) {
    throw new Error('courtPalace-* chunk missing from dist/assets');
  }
  const entries = themeFiles.map((name) => {
    const e = transferSize(join(assetsDir, name));
    return { ...e, path: `assets/${name}` };
  });
  const totalBytes = entries.reduce((s, e) => s + e.bytes, 0);
  const budgetBytes = 1 * 1024 * 1024;
  return {
    themeId: 'court-palace',
    entries,
    totalBytes,
    budgetBytes,
    withinBudget: totalBytes <= budgetBytes,
  };
}

const firstScreen = measureFirstScreen();
const themeOnDemand = measureThemeOnDemand();

const payload = {
  measuredAt: new Date().toISOString(),
  gitHint: process.env.GITHUB_SHA ?? null,
  budgets: {
    firstScreenTransferBytes: 3 * 1024 * 1024,
    themeOnDemandBytes: 1 * 1024 * 1024,
    staticSceneDrawCalls: 100,
    coldStartMenuMs: 3000,
    midGameplayFps: 60,
    topSceneFpsFloor: 30,
  },
  firstScreen,
  themeOnDemand,
  note:
    'Draw-call / FPS / cold-start / stability numbers are collected by e2e/budget.spec.ts; this CLI covers compressed transfer sizes from dist/.',
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
console.log(`\nWrote ${outPath}`);
if (!firstScreen.withinBudget || !themeOnDemand.withinBudget) {
  process.exitCode = 1;
}

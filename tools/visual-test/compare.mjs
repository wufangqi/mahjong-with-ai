#!/usr/bin/env node
/**
 * Pixel-tolerant PNG compare for visual baselines.
 * Exit 0 = within threshold; exit 1 = diff too large (writes *-diff.png beside actual).
 *
 * Baseline updates require UPDATE_VISUAL_BASELINES=1 (human confirmation gate).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);

function usage() {
  console.error('usage: compare.mjs <baseline.png> <actual.png> [maxMeanAbsDiff=8]');
  process.exit(2);
}

function readPngRgba(file) {
  // Prefer sharp if available; otherwise use pngjs via optional dependency.
  try {
    const sharp = require('sharp');
    return sharp(file)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => ({ data, width: info.width, height: info.height }));
  } catch {
    const PNG = require('pngjs').PNG;
    const buf = fs.readFileSync(file);
    const png = PNG.sync.read(buf);
    return Promise.resolve({ data: png.data, width: png.width, height: png.height });
  }
}

async function main() {
  const [, , baselinePath, actualPath, thrArg] = process.argv;
  if (!baselinePath || !actualPath) usage();
  const threshold = Number(thrArg ?? 8);
  if (process.env.UPDATE_VISUAL_BASELINES === '1') {
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.copyFileSync(actualPath, baselinePath);
    console.log(`updated baseline ${baselinePath} (UPDATE_VISUAL_BASELINES=1)`);
    return;
  }
  if (!fs.existsSync(baselinePath)) {
    console.error(`missing baseline ${baselinePath}; generate with UPDATE_VISUAL_BASELINES=1 after human review`);
    process.exit(1);
  }
  const [a, b] = await Promise.all([readPngRgba(baselinePath), readPngRgba(actualPath)]);
  if (a.width !== b.width || a.height !== b.height) {
    console.error(`size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`);
    process.exit(1);
  }
  let sum = 0;
  const n = a.width * a.height;
  const diff = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const dr = Math.abs(a.data[o] - b.data[o]);
    const dg = Math.abs(a.data[o + 1] - b.data[o + 1]);
    const db = Math.abs(a.data[o + 2] - b.data[o + 2]);
    const mean = (dr + dg + db) / 3;
    sum += mean;
    const v = Math.min(255, Math.round(mean * 4));
    diff[o] = v;
    diff[o + 1] = 0;
    diff[o + 2] = 0;
    diff[o + 3] = 255;
  }
  const mad = sum / n;
  console.log(`meanAbsDiff=${mad.toFixed(3)} threshold=${threshold}`);
  if (mad > threshold) {
    const out = actualPath.replace(/\.png$/i, '-diff.png');
    try {
      const sharp = require('sharp');
      await sharp(diff, { raw: { width: a.width, height: a.height, channels: 4 } }).png().toFile(out);
    } catch {
      const PNG = require('pngjs').PNG;
      const png = new PNG({ width: a.width, height: a.height });
      diff.copy(png.data);
      fs.writeFileSync(out, PNG.sync.write(png));
    }
    console.error(`visual diff exceeds threshold; wrote ${out}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

void zlib;

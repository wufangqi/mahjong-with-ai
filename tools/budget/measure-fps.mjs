#!/usr/bin/env node
/**
 * Mid/top FPS measurement for WUF-65 (UHD 620-class baseline).
 *
 * Uses ANGLE/Vulkan so Intel UHD binds instead of SwiftShader when /dev/dri
 * is writable (see ensure-dri-acl.sh).
 *
 * Usage:
 *   bash tools/budget/ensure-dri-acl.sh
 *   npm run build && npm run budget:fps
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { CHROME_UHD_GPU_ARGS } from './chromeGpuArgs.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outPath = resolve(
  root,
  '.aidlc/issues/wuf-49-ai-shuanghu-mvp/dev/wuf-65/budget-fps.json',
);
const baseURL = process.env.BUDGET_FPS_URL ?? 'http://127.0.0.1:4173';
const MID_TARGET = 60;
const TOP_FLOOR = 30;

function isUhd620Class(renderer) {
  const r = String(renderer).toLowerCase();
  return r.includes('uhd graphics') || r.includes('intel(r) uhd') || r.includes('intel uhd');
}

async function waitForServer(url, ms = 60_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 304) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`preview not reachable at ${url}`);
}

let previewChild = null;
async function ensurePreview() {
  try {
    await waitForServer(baseURL, 1500);
    return;
  } catch {
    /* start */
  }
  if (!existsSync(resolve(root, 'dist/index.html'))) {
    throw new Error('dist/ missing — run npm run build first');
  }
  previewChild = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173'], {
    cwd: root,
    stdio: 'ignore',
    detached: true,
  });
  await waitForServer(baseURL, 60_000);
}

async function main() {
  await ensurePreview();

  const browser = await chromium.launch({
    headless: true,
    args: CHROME_UHD_GPU_ARGS,
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 30_000 });

  const probe = await page.evaluate(() => window.__play.gpuProbe());
  await page.evaluate(async () => {
    window.__play.setReducedMotion('on');
    window.__play.setQuality('mid');
    await window.__play.startMatch(42);
  });
  await page.waitForTimeout(400);
  const midFps = await page.evaluate(() => window.__play.sampleFps(1500));

  await page.evaluate(() => {
    window.__play.playSceneDemo('top');
  });
  await page.waitForFunction(() => window.__play.isScenePlaying(), null, { timeout: 5_000 });
  const topTier = await page.evaluate(() => window.__play.lastScenePlans()[0]?.tier);
  const topFps = await page.evaluate(() => window.__play.sampleFps(1500));
  await page.evaluate(() => window.__play.skipScene());

  await browser.close();
  if (previewChild?.pid) {
    try {
      process.kill(-previewChild.pid, 'SIGTERM');
    } catch {
      /* ignore */
    }
  }

  const uhdClass = isUhd620Class(probe.renderer);
  const payload = {
    measuredAt: new Date().toISOString(),
    viewport: { width: 1920, height: 1080 },
    chromeArgs: CHROME_UHD_GPU_ARGS,
    gpuRenderer: probe.renderer,
    uhd620Class: uhdClass,
    midFpsSample: midFps,
    topFpsSample: topFps,
    topSceneTier: topTier,
    midFpsTarget: MID_TARGET,
    topFpsFloor: TOP_FLOOR,
    midWithinBudget: midFps >= MID_TARGET * 0.9,
    topWithinBudget: topFps >= TOP_FLOOR,
    fpsGateApplied: uhdClass,
    note: 'ANGLE/Vulkan path. Absolute 60/30 gate requires UHD-class gpuProbe (ensure-dri-acl.sh if render node is not writable).',
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

  const runtimePath = resolve(
    root,
    '.aidlc/issues/wuf-49-ai-shuanghu-mvp/dev/wuf-65/budget-runtime.json',
  );
  if (existsSync(runtimePath)) {
    const runtime = JSON.parse(readFileSync(runtimePath, 'utf8'));
    runtime.hardwareFps = payload;
    writeFileSync(runtimePath, `${JSON.stringify(runtime, null, 2)}\n`);
  }

  console.log(JSON.stringify(payload, null, 2));
  console.log(`\nWrote ${outPath}`);

  if (!uhdClass || !payload.midWithinBudget || !payload.topWithinBudget) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

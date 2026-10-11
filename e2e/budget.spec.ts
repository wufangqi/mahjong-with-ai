import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COLD_START_MENU_BUDGET_MS,
  MID_GAMEPLAY_FPS_TARGET,
  STABILITY_HAND_COUNT,
  STABILITY_SCENE_COUNT,
  STABILITY_THEME_SWITCH_COUNT,
  STATIC_SCENE_DRAW_CALL_BUDGET,
  TOP_SCENE_FPS_FLOOR,
} from '../src/budget/limits';

function hostPciGpuLines(): string[] {
  try {
    return execSync('lspci', { encoding: 'utf8' })
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /VGA|3D|Display/i.test(l));
  } catch {
    return [];
  }
}

const aidlcReport = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../.aidlc/issues/wuf-49-ai-shuanghu-mvp/dev/wuf-65/budget-runtime.json',
);

/** Chrome DevTools Fast 4G-ish profile: ~1.6 Mbps down, 150 ms RTT. */
async function applyFast4G(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8),
    uploadThroughput: Math.floor((0.75 * 1024 * 1024) / 8),
    connectionType: 'cellular4g',
  });
}

function isUhd620Class(renderer: string): boolean {
  const r = renderer.toLowerCase();
  return (
    r.includes('uhd graphics 620') ||
    r.includes('uhd graphics 630') ||
    r.includes('uhd graphics') ||
    r.includes('intel(r) uhd')
  );
}

test('cold cache boot under Fast 4G throughput reaches main menu within 3s', async ({ page }) => {
  await applyFast4G(page);

  const started = Date.now();
  await page.goto('./', { waitUntil: 'commit' });

  const boot = page.getByTestId('boot-loading');
  await expect(boot).toBeVisible();
  const label = page.getByTestId('boot-loading-label');
  await expect(label).toContainText(/加载|字体|主题|桌面|菜单/);
  await expect
    .poll(async () => page.evaluate(() => document.getElementById('boot-loading-bar')?.style.width ?? ''))
    .not.toBe('0%');

  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });
  const elapsed = Date.now() - started;

  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(boot).toBeHidden();
  expect(elapsed).toBeLessThanOrEqual(COLD_START_MENU_BUDGET_MS);
});

test('static mid-quality table stays at or under draw-call budget', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });

  await page.evaluate(async () => {
    window.__play!.setQuality('mid');
    await window.__play!.startMatch(42);
  });
  await expect(page.getByTestId('main-menu')).toBeHidden();
  await expect(page.getByTestId('status')).toContainText('出牌');

  await page.waitForTimeout(200);
  const drawCalls = await page.evaluate(() => window.__play!.drawCallCount());
  expect(drawCalls).toBeGreaterThan(0);
  expect(drawCalls).toBeLessThanOrEqual(STATIC_SCENE_DRAW_CALL_BUDGET);
});

test.describe.configure({ mode: 'serial' });

test('full 50/100/20 soak and UHD-class mid/top FPS leave runtime report', async ({ page }) => {
  test.setTimeout(600_000);

  await page.goto('./');
  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });

  await page.evaluate(() => {
    window.__play!.setReducedMotion('on');
    window.__play!.setAutoSkipOpponent(true);
    window.__play!.setQuality('mid');
  });

  const probe = await page.evaluate(() => window.__play!.gpuProbe());
  const uhdClass = isUhd620Class(probe.renderer);

  await page.evaluate(async () => {
    await window.__play!.startMatch(42);
  });
  await expect(page.getByTestId('status')).toContainText('出牌');

  const midFps = await page.evaluate(() => window.__play!.sampleFps(1000));

  // --- 50 hands soak ---
  const handSamples: number[] = [];
  const handGpuSamples: number[] = [];
  for (let i = 0; i < STABILITY_HAND_COUNT; i++) {
    await page.evaluate(async () => {
      await window.__play!.autoPlayToDraw();
      await window.__play!.startNextHand();
    });
    const heap = await page.evaluate(() => window.__play!.heapUsed());
    if (heap != null) handSamples.push(heap);
    const gpu = await page.evaluate(() => window.__play!.gpuResourceSnapshot());
    handGpuSamples.push(gpu.textures + gpu.geometries);
  }

  // --- 20 theme switches ---
  const themeSamples: number[] = [];
  const themeGpuSamples: number[] = [];
  for (let i = 0; i < STABILITY_THEME_SWITCH_COUNT; i++) {
    await page.evaluate(async (n) => {
      await window.__play!.selectTheme(n % 2 === 0 ? 'court-palace' : 'classic-green');
    }, i);
    const heap = await page.evaluate(() => window.__play!.heapUsed());
    if (heap != null) themeSamples.push(heap);
    const gpu = await page.evaluate(() => window.__play!.gpuResourceSnapshot());
    themeGpuSamples.push(gpu.textures + gpu.geometries);
  }

  // --- top scene FPS during active top presentation ---
  await page.evaluate(() => {
    window.__play!.playSceneDemo('top');
  });
  await expect
    .poll(async () => page.evaluate(() => window.__play!.isScenePlaying()))
    .toBe(true);
  const topPlans = await page.evaluate(() => window.__play!.lastScenePlans());
  expect(topPlans[0]?.tier).toBe('top');
  const topFps = await page.evaluate(() => window.__play!.sampleFps(1000));
  await page.evaluate(() => window.__play!.skipScene());

  // --- 100 scene replays (basic demo queue, skip each) ---
  await page.evaluate(async () => {
    await window.__play!.loadPinghuWinDemo();
    await window.__play!.claimWin();
  });
  await expect
    .poll(async () => page.evaluate(() => window.__play!.isScenePlaying()))
    .toBe(true);
  await page.evaluate(() => window.__play!.skipScene());

  const sceneSamples: number[] = [];
  const sceneGpuSamples: number[] = [];
  for (let i = 0; i < STABILITY_SCENE_COUNT; i++) {
    await page.evaluate(() => {
      window.__play!.replayScene();
    });
    await expect
      .poll(async () => page.evaluate(() => window.__play!.isScenePlaying()), { timeout: 5_000 })
      .toBe(true);
    await page.evaluate(() => window.__play!.skipScene());
    const heap = await page.evaluate(() => window.__play!.heapUsed());
    if (heap != null) sceneSamples.push(heap);
    const gpu = await page.evaluate(() => window.__play!.gpuResourceSnapshot());
    sceneGpuSamples.push(gpu.textures + gpu.geometries);
  }

  // Hands retain action logs / persist payloads by design — allow modest heap slope.
  // Theme/scene soaks and GPU resource counts must stay flat (leak signal).
  const handGrowth =
    handSamples.length >= 4
      ? await page.evaluate(
          (s) =>
            window.__play!.hasSustainedGrowth(s, {
              maxBytesPerStep: 768 * 1024,
              minDeltaBytes: 8 * 1024 * 1024,
            }),
          handSamples,
        )
      : false;
  const themeGrowth =
    themeSamples.length >= 4
      ? await page.evaluate((s) => window.__play!.hasSustainedGrowth(s), themeSamples)
      : false;
  const sceneGrowth =
    sceneSamples.length >= 4
      ? await page.evaluate((s) => window.__play!.hasSustainedGrowth(s), sceneSamples)
      : false;
  const gpuHandGrowth = await page.evaluate(
    (s) =>
      window.__play!.hasSustainedGrowth(s, {
        maxBytesPerStep: 0.35,
        minDeltaBytes: 6,
      }),
    handGpuSamples,
  );
  const gpuThemeGrowth = await page.evaluate(
    (s) =>
      window.__play!.hasSustainedGrowth(s, {
        maxBytesPerStep: 0.35,
        minDeltaBytes: 6,
      }),
    themeGpuSamples,
  );
  const gpuSceneGrowth = await page.evaluate(
    (s) =>
      window.__play!.hasSustainedGrowth(s, {
        maxBytesPerStep: 0.35,
        minDeltaBytes: 6,
      }),
    sceneGpuSamples,
  );
  const gpuGrowth = gpuHandGrowth || gpuThemeGrowth || gpuSceneGrowth;

  expect(handGpuSamples.length).toBe(STABILITY_HAND_COUNT);
  expect(themeGpuSamples.length).toBe(STABILITY_THEME_SWITCH_COUNT);
  expect(sceneGpuSamples.length).toBe(STABILITY_SCENE_COUNT);
  // Heap samples require Chromium memory flag; when present they must cover full soak.
  if (handSamples.length > 0) {
    expect(handSamples.length).toBe(STABILITY_HAND_COUNT);
    expect(themeSamples.length).toBe(STABILITY_THEME_SWITCH_COUNT);
    expect(sceneSamples.length).toBe(STABILITY_SCENE_COUNT);
  }
  expect(handGrowth).toBe(false);
  expect(themeGrowth).toBe(false);
  expect(sceneGrowth).toBe(false);
  expect(gpuGrowth).toBe(false);

  expect(midFps).toBeGreaterThan(0);
  expect(topFps).toBeGreaterThan(0);

  // Gate absolute FPS on UHD 620-class iGPU (this host is UHD 630 = same class).
  if (uhdClass) {
    expect(midFps).toBeGreaterThanOrEqual(MID_GAMEPLAY_FPS_TARGET * 0.9);
    expect(topFps).toBeGreaterThanOrEqual(TOP_SCENE_FPS_FLOOR);
  }

  const drawCalls = await page.evaluate(() => window.__play!.drawCallCount());
  const hostPciGpu = hostPciGpuLines();
  mkdirSync(dirname(aidlcReport), { recursive: true });
  writeFileSync(
    aidlcReport,
    `${JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        gpuRenderer: probe.renderer,
        uhd620Class: uhdClass,
        hostPciGpu,
        uhd620ClassHost: hostPciGpu.some((l) => /UHD Graphics/i.test(l)),
        midFpsSample: midFps,
        topFpsSample: topFps,
        midFpsTarget: MID_GAMEPLAY_FPS_TARGET,
        topFpsFloor: TOP_SCENE_FPS_FLOOR,
        fpsGateApplied: uhdClass,
        drawCalls,
        handSamples: handSamples.length,
        themeSwitchSamples: themeSamples.length,
        sceneReplaySamples: sceneSamples.length,
        handSustainedGrowth: handGrowth,
        themeSustainedGrowth: themeGrowth,
        sceneSustainedGrowth: sceneGrowth,
        gpuResourceSustainedGrowth: gpuGrowth,
        networkProfile: {
          name: 'Fast 4G (CDP)',
          downloadMbps: 1.6,
          uploadMbps: 0.75,
          latencyMs: 150,
        },
        note: 'Heap via performance.memory; GPU resources via renderer.info.memory (no public VRAM API). Absolute mid/top FPS gate applies only when browser gpuProbe is UHD-class; hostPciGpu records the machine GPU even if Chromium is on SwiftShader.',
      },
      null,
      2,
    )}\n`,
  );
});

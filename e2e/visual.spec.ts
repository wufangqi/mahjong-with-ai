import { expect, test } from '@playwright/test';

const VIEW = { width: 1280, height: 720 } as const;

const TIERS = [
  { tier: 'basic', captureAt: 1200 },
  { tier: 'big', captureAt: 1600 },
  { tier: 'top', captureAt: 2800 },
] as const;

/**
 * Deterministic three-tier visual preview.
 * Baselines live under e2e/visual.spec.ts-snapshots/.
 * Updating requires explicit human confirmation:
 *   UPDATE_VISUAL_BASELINES=1 npm run test:visual -- --update-snapshots
 */
for (const { tier, captureAt } of TIERS) {
  test(`visual ${tier} frame @ ${captureAt}ms`, async ({ page }) => {
    await page.setViewportSize(VIEW);
    const qs = new URLSearchParams({
      visual: '1',
      tier,
      seed: '1',
      width: String(VIEW.width),
      height: String(VIEW.height),
      dpr: '1',
      theme: 'classic-green',
      captureAt: String(captureAt),
      stepMs: '16.666',
    });
    await page.goto(`./preview.html?${qs.toString()}`);
    await page.waitForFunction(() => document.body.dataset.captureReady === '1', null, {
      timeout: 60_000,
    });
    // Full-page capture of the fixed viewport (canvas is edge-to-edge).
    await expect(page).toHaveScreenshot(`${tier}.png`, {
      maxDiffPixelRatio: 0.03,
      animations: 'disabled',
      timeout: 15_000,
    });
  });
}

test('visual harness exposes fixed config on window.__visual', async ({ page }) => {
  await page.setViewportSize(VIEW);
  await page.goto(
    './preview.html?visual=1&tier=basic&seed=9&width=1280&height=720&dpr=1&theme=classic-green&captureAt=500',
  );
  await page.waitForFunction(() => window.__visual?.ready === true, null, { timeout: 30_000 });
  const cfg = await page.evaluate(() => window.__visual!.config);
  expect(cfg?.enabled).toBe(true);
  expect(cfg?.seed).toBe(9);
  expect(cfg?.tier).toBe('basic');
  expect(cfg?.dpr).toBe(1);
  expect(cfg?.theme).toBe('classic-green');
  expect(cfg?.captureAt).toBe(500);
});

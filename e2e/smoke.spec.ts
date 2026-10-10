import { expect, test } from '@playwright/test';

test('play mode deals a seeded hand and continues after a player discard', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('header h1')).toHaveText('AI 爽胡麻将');
  await expect(page.locator('#c')).toBeVisible();

  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });

  await page.getByTestId('seed-input').fill('42');
  await page.getByTestId('start-hand').click();

  await expect(page.getByTestId('status')).toContainText('出牌');
  await expect(page.getByTestId('meta')).toContainText('实体牌 136/136');

  const discarded = await page.evaluate(() => {
    const snap = window.__play!.snapshot();
    const drawn = snap.state!.seats[0].drawn!;
    window.__play!.clickTile(drawn.id);
    window.__play!.clickTile(drawn.id);
    return { id: drawn.id, status: window.__play!.snapshot().status };
  });

  expect(discarded.id).toBeTruthy();
  expect([
    'awaiting_player_discard',
    'awaiting_player_claim_response',
    'awaiting_player_win_response',
    'exhaustive_draw',
    'hand_won',
  ]).toContain(discarded.status);

  const riverTail = await page.evaluate(() => {
    const river = window.__play!.snapshot().state!.seats[0].river;
    return river[river.length - 1]?.id ?? null;
  });
  expect(riverTail).toBe(discarded.id);
});

test('auto-play reaches 流局 settlement with revealed hands', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });

  await page.getByTestId('seed-input').fill('42');
  await page.getByTestId('start-hand').click();

  await page.evaluate(() => window.__play!.autoPlayToDraw());

  await expect(page.getByTestId('draw-panel')).toBeVisible();
  await expect(page.getByTestId('draw-panel')).toContainText('流局');
  await expect(page.getByTestId('draw-panel')).toContainText('不计番');
  await expect(page.getByTestId('draw-seats').locator('.draw-seat')).toHaveCount(4);
  await expect(page.getByTestId('status')).toContainText('流局');

  const settlement = await page.evaluate(() => {
    const snap = window.__play!.snapshot();
    return {
      status: snap.status,
      wall: snap.state!.wall.length,
      fan: snap.settlement!.fanBySeat,
      dealer: snap.state!.dealer,
      concealedPlusMelds: snap.settlement!.seats.map((s) => {
        const melds = snap.state!.seats[s.seat].melds.length;
        return s.hand.length + melds * 3;
      }),
    };
  });
  expect(settlement.status).toBe('exhaustive_draw');
  expect(settlement.wall).toBe(0);
  expect(settlement.fan).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0 });
  expect(settlement.concealedPlusMelds).toEqual([13, 13, 13, 13]);

  const dealerBefore = settlement.dealer;
  await page.getByTestId('next-hand').click();
  const dealerAfter = await page.evaluate(() => window.__play!.snapshot().state!.dealer);
  expect(dealerAfter).toBe(dealerBefore);
});

test('平胡 claim plays basic scene and shows settlement with replay', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });

  await page.evaluate(() => window.__play!.loadPinghuWinDemo());
  await expect(page.getByTestId('response-bar')).toBeVisible();
  await expect(page.getByTestId('claim-win')).toBeVisible();

  await page.getByTestId('claim-win').click();

  await expect(page.getByTestId('win-panel')).toBeVisible();
  await expect(page.getByTestId('win-summary')).toContainText('平胡');
  await expect(page.getByTestId('win-summary')).toContainText('1 番');
  await expect(page.getByTestId('status')).toContainText('平胡');

  const plans = await page.evaluate(() => window.__play!.lastScenePlans());
  expect(plans[0]?.tier).toBe('basic');
  await expect(page.getByTestId('win-banner')).toHaveClass(/basic/);

  await page.getByTestId('replay-scene').click();
  await expect(page.getByTestId('win-banner')).toHaveClass(/basic/);
});

test('theme hot-switch persists, keeps mid-scene palette, and retains prior theme', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });

  await expect(page.getByTestId('theme-select')).toBeVisible();
  await expect(page.getByTestId('theme-select')).toHaveValue('classic-green');

  const first = await page.evaluate(async () => {
    const before = window.__play!.themeApplied().table.felt;
    const result = await window.__play!.selectTheme('court-palace');
    return {
      before,
      after: window.__play!.themeApplied().table.felt,
      id: window.__play!.activeThemeId(),
      transitionMs: result.transitionMs,
      glyph: window.__play!.themeApplied().mark.glyph,
      classicRetained: window.__play!.themeRetained('classic-green'),
      classicRefs: window.__play!.themeRefCount('classic-green'),
    };
  });
  expect(first.id).toBe('court-palace');
  expect(first.glyph).toBe('福');
  expect(first.after).not.toBe(first.before);
  expect(first.transitionMs).toBeGreaterThanOrEqual(300);
  expect(first.transitionMs).toBeLessThanOrEqual(600);
  expect(first.classicRetained).toBe(true);
  expect(first.classicRefs).toBeGreaterThanOrEqual(1);
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'court-palace');

  await page.evaluate(() => window.__play!.loadPinghuWinDemo());
  await page.getByTestId('claim-win').click();
  await expect(page.getByTestId('win-banner')).toHaveClass(/basic/);

  const midScene = await page.evaluate(async () => {
    const captured = window.__play!.scenePalette();
    await window.__play!.selectTheme('classic-green');
    return {
      capturedBanner: captured?.bannerBasic ?? null,
      sceneAfterSwitch: window.__play!.scenePalette()?.bannerBasic ?? null,
      appliedBanner: window.__play!.themeApplied().palette.bannerBasic,
      active: window.__play!.activeThemeId(),
    };
  });
  expect(midScene.capturedBanner).toBeTruthy();
  expect(midScene.sceneAfterSwitch).toBe(midScene.capturedBanner);
  expect(midScene.appliedBanner).not.toBe(midScene.capturedBanner);
  expect(midScene.active).toBe('classic-green');

  // Persistence: reload restores last selection
  await page.reload();
  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });
  await expect(page.getByTestId('theme-select')).toHaveValue('classic-green');

  await page.evaluate(async () => {
    await window.__play!.selectTheme('court-palace');
  });
  await page.reload();
  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });
  await expect(page.getByTestId('theme-select')).toHaveValue('court-palace');
  const restored = await page.evaluate(() => window.__play!.themeApplied().mark.glyph);
  expect(restored).toBe('福');
});

test('effect preview still boots and plays fixed basic win', async ({ page }) => {
  await page.goto('./preview.html');
  await expect(page.locator('header h1')).toHaveText('AI 爽胡麻将');
  await expect(page.locator('#c')).toBeVisible();

  await page.waitForFunction(() => window.__app?.ready === true, null, { timeout: 15_000 });

  await page.getByTestId('play-basic').click();
  await expect(page.locator('#banner')).toHaveClass(/basic/);
  await expect(page.locator('#banner .main')).toHaveText('胡');

  const playing = await page.evaluate(() => Boolean(window.__app?.st && (window.__app.st as { effect: unknown }).effect));
  expect(playing).toBe(true);
});

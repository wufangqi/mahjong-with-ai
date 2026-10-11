import { expect, test } from '@playwright/test';

test('play mode deals a seeded hand and continues after a player discard', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('header h1')).toHaveText('AI 爽胡麻将');
  await expect(page.locator('#c')).toBeVisible();

  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });

  await expect(page.getByTestId('main-menu')).toBeVisible();
  await page.getByTestId('seed-input').fill('42');
  await page.getByTestId('start-match').click();

  await expect(page.getByTestId('main-menu')).toBeHidden();
  await expect(page.getByTestId('status')).toContainText('出牌');
  await expect(page.getByTestId('meta')).toContainText('实体牌 136/136');
  await expect(page.getByTestId('hand-index')).toContainText('第 1 局');

  const discarded = await page.evaluate(async () => {
    const snap = window.__play!.snapshot();
    const drawn = snap.state!.seats[0].drawn!;
    await window.__play!.clickTile(drawn.id);
    await window.__play!.clickTile(drawn.id);
    return { id: drawn.id, status: window.__play!.snapshot().status };
  });

  expect(discarded.id).toBeTruthy();
  expect([
    'awaiting_player_discard',
    'awaiting_player_claim_response',
    'awaiting_player_win_response',
    'awaiting_ai',
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
  await page.evaluate(async () => {
    await window.__play!.startMatch(42);
  });
  await expect(page.getByTestId('main-menu')).toBeHidden();
  await expect(page.getByTestId('status')).toContainText('出牌');

  await page.evaluate(async () => {
    await window.__play!.autoPlayToDraw();
  });

  await expect(page.getByTestId('draw-panel')).toBeVisible();
  await expect(page.getByTestId('draw-panel')).toContainText('流局');
  await expect(page.getByTestId('draw-panel')).toContainText('不计番');
  await expect(page.getByTestId('draw-seats').locator('.draw-seat')).toHaveCount(4);
  await expect(page.getByTestId('status')).toContainText('流局');
  await expect(page.getByTestId('end-match')).toBeVisible();

  const settlement = await page.evaluate(() => {
    const snap = window.__play!.snapshot();
    return {
      status: snap.status,
      wall: snap.state!.wall.length,
      fan: snap.settlement!.fanBySeat,
      dealer: snap.state!.dealer,
      matchStatus: window.__play!.matchSnapshot().status,
      handIndex: window.__play!.matchSnapshot().handIndex,
      concealedPlusMelds: snap.settlement!.seats.map((s) => {
        const melds = snap.state!.seats[s.seat].melds.length;
        return s.hand.length + melds * 3;
      }),
    };
  });
  expect(settlement.status).toBe('exhaustive_draw');
  expect(settlement.matchStatus).toBe('hand_settled');
  expect(settlement.wall).toBe(0);
  expect(settlement.fan).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0 });
  expect(settlement.concealedPlusMelds).toEqual([13, 13, 13, 13]);

  const dealerBefore = settlement.dealer;
  await page.evaluate(async () => {
    await window.__play!.startNextHand();
  });
  const afterNext = await page.evaluate(() => ({
    dealer: window.__play!.snapshot().state!.dealer,
    handIndex: window.__play!.matchSnapshot().handIndex,
  }));
  expect(afterNext.dealer).toBe(dealerBefore);
  expect(afterNext.handIndex).toBe(2);
  await expect(page.getByTestId('hand-index')).toContainText('第 2 局');

  await page.evaluate(async () => {
    await window.__play!.autoPlayToDraw();
  });
  await page.getByTestId('end-match').click();
  await expect(page.getByTestId('main-menu')).toBeVisible();
  const ended = await page.evaluate(() => window.__play!.matchSnapshot());
  expect(ended.status).toBe('menu');
  expect(ended.handIndex).toBe(0);
  expect(ended.hand.state).toBeNull();
});

test('平胡 claim plays basic scene and shows settlement with replay', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });

  await page.evaluate(async () => {
    await window.__play!.loadPinghuWinDemo();
  });
  await expect(page.getByTestId('response-bar')).toBeVisible();
  await expect(page.getByTestId('claim-win')).toBeVisible();

  await page.evaluate(async () => {
    await window.__play!.claimWin();
  });

  await expect(page.getByTestId('scene-bar')).toBeVisible();
  await expect(page.getByTestId('win-banner')).toHaveClass(/basic/);
  const duringScene = await page.evaluate(() => ({
    playing: window.__play!.isScenePlaying(),
    tier: window.__play!.lastScenePlans()[0]?.tier,
    masterVisible: !document.querySelector('[data-testid="master-volume"]')?.closest('[hidden]'),
    qualityHidden: getComputedStyle(document.querySelector('[data-testid="quality-select"]')!.closest('.quality-field')!).display === 'none',
    themeOk: document.querySelector('[data-testid="theme-select"]') != null,
    reducedOk: document.querySelector('[data-testid="reduced-motion"]') != null,
  }));
  expect(duringScene.playing).toBe(true);
  expect(duringScene.tier).toBe('basic');
  expect(duringScene.qualityHidden).toBe(true);
  expect(duringScene.themeOk).toBe(true);
  expect(duringScene.reducedOk).toBe(true);

  await page.evaluate(() => window.__play!.skipScene());
  await expect(page.getByTestId('win-panel')).toBeVisible();
  await expect(page.getByTestId('win-summary')).toContainText('平胡');
  await expect(page.getByTestId('win-summary')).toContainText('1 番');
  await expect(page.getByTestId('status')).toContainText('平胡');
  await expect(page.getByTestId('replay-seat-0')).toBeVisible();

  await page.getByTestId('replay-scene').click();
  await expect(page.getByTestId('scene-bar')).toBeVisible();
  await expect(page.getByTestId('win-banner')).toHaveClass(/basic/);
  await page.evaluate(() => window.__play!.skipScene());
  await expect(page.getByTestId('win-panel')).toBeVisible();
});

test('audio volumes and reduced motion persist; auto-skip is available', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });

  await page.evaluate(() => {
    window.__play!.setMasterVolume(0.35);
    window.__play!.setSfxVolume(0.55);
    window.__play!.setReducedMotion('on');
    window.__play!.setAutoSkipOpponent(true);
  });
  expect(await page.evaluate(() => window.__play!.masterVolume())).toBeCloseTo(0.35);
  expect(await page.evaluate(() => window.__play!.sfxVolume())).toBeCloseTo(0.55);
  expect(await page.evaluate(() => window.__play!.reducedMotionEnabled())).toBe(true);
  expect(await page.evaluate(() => window.__play!.autoSkipOpponent())).toBe(true);

  await page.reload();
  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });
  expect(await page.evaluate(() => window.__play!.masterVolume())).toBeCloseTo(0.35);
  expect(await page.evaluate(() => window.__play!.sfxVolume())).toBeCloseTo(0.55);
  expect(await page.evaluate(() => window.__play!.reducedMotionMode())).toBe('on');
  expect(await page.evaluate(() => window.__play!.autoSkipOpponent())).toBe(true);
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

  const courtVisual = await page.evaluate(async () => {
    // Allow transition frames to settle
    await new Promise((r) => setTimeout(r, 500));
    return {
      particles: window.__play!.ambientParticleKind(),
      tileBack: window.__play!.tileBackPattern(),
      tileBackSpec: window.__play!.themeApplied().tileBack,
    };
  });
  expect(courtVisual.particles).toBe('petals');
  expect(courtVisual.tileBack).toBe('cloud');
  expect(courtVisual.tileBackSpec.pattern).toBe('cloud');

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

  const particles = await page.evaluate(() => ({
    backend: window.__app!.particleBackend(),
    gpuOk: window.__app!.gpuParticlesAvailable(),
  }));
  expect(['gpu', 'cpu']).toContain(particles.backend);
  if (particles.gpuOk) expect(particles.backend).toBe('gpu');
  else expect(particles.backend).toBe('cpu');
});

test('quality tiers control DPR/shadows/bloom/particles/sky and manual locks auto', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });

  await expect(page.getByTestId('quality-select')).toBeVisible();

  const low = await page.evaluate(() => {
    window.__play!.setQuality('low');
    return window.__play!.qualitySettings();
  });
  expect(low.tier).toBe('low');
  expect(low.dprCap).toBe(1);
  expect(low.shadows).toBe('off');
  expect(low.bloom).toBe('off');
  expect(low.sky).toBe('simplified');
  expect(low.preferGpuParticles).toBe(false);

  const mid = await page.evaluate(() => {
    window.__play!.setQuality('mid');
    return window.__play!.qualitySettings();
  });
  expect(mid.dprCap).toBe(1.5);
  expect(mid.shadowMapSize).toBe(1024);
  expect(mid.bloom).toBe('full');
  expect(mid.sky).toBe('full');

  const high = await page.evaluate(() => {
    window.__play!.setQuality('high');
    return window.__play!.qualitySettings();
  });
  expect(high.dprCap).toBe(2);
  expect(high.shadowMapSize).toBe(2048);
  expect(high.particleBudget).toBeGreaterThan(mid.particleBudget);

  await expect(page.getByTestId('quality-select')).toHaveValue('high');
  expect(await page.evaluate(() => window.__play!.qualityMode())).toBe('manual');

  await page.evaluate(() => {
    window.__play!.beginQualityGame();
    for (let i = 0; i < 60; i++) window.__play!.injectFpsSample(100, 20);
  });
  expect(await page.evaluate(() => window.__play!.qualityTier())).toBe('high');

  await page.evaluate(async () => {
    await window.__play!.selectTheme('court-palace');
    await new Promise((r) => setTimeout(r, 500));
  });
  const ambient = await page.evaluate(() => ({
    kind: window.__play!.ambientParticleKind(),
    backend: window.__play!.ambientParticleBackend(),
  }));
  expect(ambient.kind).toBe('petals');
  expect(['gpu', 'cpu']).toContain(ambient.backend);
});

test('auto quality downgrades one tier after sustained low fps', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 15_000 });

  const result = await page.evaluate(() => {
    window.__play!.pinAutoQuality('high');
    window.__play!.beginQualityGame();
    let changed: string | null = null;
    for (let i = 0; i < 50; i++) {
      changed = window.__play!.injectFpsSample(100, 20) ?? changed;
    }
    const afterDrop = window.__play!.qualityTier();
    for (let i = 0; i < 100; i++) {
      window.__play!.injectFpsSample(100, 60);
    }
    return {
      mode: window.__play!.qualityMode(),
      changed,
      afterDrop,
      afterHealthy: window.__play!.qualityTier(),
      settings: window.__play!.qualitySettings(),
    };
  });

  expect(result.mode).toBe('auto');
  expect(result.changed).toBe('mid');
  expect(result.afterDrop).toBe('mid');
  expect(result.afterHealthy).toBe('mid');
  expect(result.settings.dprCap).toBe(1.5);
});

import { expect, test } from '@playwright/test';

test('play mode deals a seeded hand and confirms a player discard', async ({ page }) => {
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

  expect(discarded.status).toBe('complete');
  await expect(page.getByTestId('status')).toContainText('不可撤销');

  const riverTail = await page.evaluate(() => {
    const river = window.__play!.snapshot().state!.seats[0].river;
    return river[river.length - 1]?.id ?? null;
  });
  expect(riverTail).toBe(discarded.id);
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

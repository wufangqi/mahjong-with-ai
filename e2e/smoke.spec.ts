import { expect, test } from '@playwright/test';

test('production preview boots and plays fixed basic win', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('header h1')).toHaveText('AI 爽胡麻将');
  await expect(page.locator('#c')).toBeVisible();

  await page.waitForFunction(() => window.__app?.ready === true, null, { timeout: 15_000 });

  await page.getByTestId('play-basic').click();
  await expect(page.locator('#banner')).toHaveClass(/basic/);
  await expect(page.locator('#banner .main')).toHaveText('胡');

  const playing = await page.evaluate(() => Boolean(window.__app?.st && (window.__app.st as { effect: unknown }).effect));
  expect(playing).toBe(true);
});

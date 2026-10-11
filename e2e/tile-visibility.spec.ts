import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VIEW = { width: 1280, height: 720 } as const;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECKER = path.join(
  ROOT,
  '.aidlc/issues/wuf-68-tile-visibility-camera/check-visibility.py',
);

async function discardFirstAndSettle(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 30_000 });
  await page.getByTestId('seed-input').fill('42');
  await page.getByTestId('start-match').click();
  const tileId = await page.evaluate(
    () => window.__play!.snapshot().state!.seats[0].hand[0]!.id,
  );
  await page.evaluate(async (id) => {
    await window.__play!.clickTile(id);
    await window.__play!.clickTile(id);
  }, tileId);
  await page.waitForTimeout(1500);
  const riverCount = await page.evaluate(() =>
    window.__play!.snapshot().state!.seats.reduce((total, seat) => total + seat.river.length, 0),
  );
  expect(riverCount).toBeGreaterThanOrEqual(1);
}

function assertVisibilityPng(shotPath: string): void {
  const out = execFileSync('python3', [CHECKER, shotPath], { encoding: 'utf8' });
  expect(out, out).toContain('PASS');
}

for (const theme of ['classic-green', 'court-palace'] as const) {
  test(`tile visibility + balanced framing (${theme})`, async ({ page }) => {
    await page.setViewportSize(VIEW);
    await page.goto('./');
    await page.waitForFunction(() => window.__play?.ready === true, null, { timeout: 30_000 });
    await page.evaluate(async (id) => {
      await window.__play!.selectTheme(id);
    }, theme);
    await discardFirstAndSettle(page);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wuf-68-vis-'));
    const shotPath = path.join(dir, `${theme}.png`);
    await page.screenshot({ path: shotPath, animations: 'disabled' });
    assertVisibilityPng(shotPath);

    // Keep a durable copy under the aidlc path for human review (classic only).
    if (theme === 'classic-green') {
      const durable = path.join(
        ROOT,
        '.aidlc/issues/wuf-68-tile-visibility-camera/repro-latest.png',
      );
      fs.copyFileSync(shotPath, durable);
    }
  });
}

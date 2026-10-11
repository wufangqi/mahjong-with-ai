import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

/** Wait until play boots, or the WebGL2 compatibility page appears. */
async function waitReadyOrUnsupported(page: Page): Promise<'ready' | 'unsupported'> {
  await page.goto('./');
  return Promise.race([
    page
      .waitForFunction(() => window.__play?.ready === true, null, { timeout: 30_000 })
      .then(() => 'ready' as const),
    page
      .getByTestId('webgl2-unsupported')
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(() => 'unsupported' as const),
  ]);
}

test('production HTML embeds CSP for static hosts', async () => {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  expect(html).toContain('Content-Security-Policy');
  expect(html).toMatch(/connect-src[^"]*'self'[^"]*https:/);
  expect(html).toMatch(/src="\.\/assets\//);
});

test('privacy notice and clear-data flow are visible on the main menu', async ({ page }) => {
  const boot = await waitReadyOrUnsupported(page);
  test.skip(boot === 'unsupported', 'WebGL2 unavailable in this browser/GPU stack');

  await expect(page.getByTestId('privacy-notice')).toContainText('无遥测');
  await expect(page.getByTestId('privacy-notice')).toContainText('外接 AI');
  await expect(page.getByTestId('clear-data')).toBeVisible();

  await page.evaluate(async () => {
    localStorage.setItem('mahjong.themeId', 'court-palace');
    localStorage.setItem(
      'mahjong.externalAi.v1',
      JSON.stringify({
        proxyUrl: 'https://proxy.example.com',
        model: 'm',
        seatSources: { 1: 'easy', 2: 'easy', 3: 'easy' },
        disclosureAccepted: true,
      }),
    );
    await window.__play!.clearLocalData();
  });

  const cleared = await page.evaluate(() => ({
    theme: localStorage.getItem('mahjong.themeId'),
    ai: localStorage.getItem('mahjong.externalAi.v1'),
    activeTheme: window.__play!.activeThemeId(),
  }));
  expect(cleared.theme).toBe('classic-green');
  expect(cleared.ai).toBeNull();
  expect(cleared.activeTheme).toBe('classic-green');
});

test('desktop browser can start a hand and discard once', async ({ page }) => {
  const boot = await waitReadyOrUnsupported(page);
  test.skip(boot === 'unsupported', 'WebGL2 unavailable in this browser/GPU stack');

  await page.getByTestId('seed-input').fill('42');
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('main-menu')).toBeHidden();
  await expect(page.getByTestId('status')).toContainText('出牌');

  const discarded = await page.evaluate(async () => {
    const snap = window.__play!.snapshot();
    const drawn = snap.state!.seats[0].drawn!;
    await window.__play!.clickTile(drawn.id);
    await window.__play!.clickTile(drawn.id);
    return window.__play!.snapshot().status;
  });
  expect([
    'awaiting_player_discard',
    'awaiting_player_claim_response',
    'awaiting_player_win_response',
    'awaiting_ai',
    'exhaustive_draw',
    'hand_won',
  ]).toContain(discarded);
});

test('unsupported WebGL2 shows the compatibility page', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = function getContext() {
      return null;
    };
  });
  await page.goto('./');
  await expect(page.getByTestId('webgl2-unsupported')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('webgl2-unsupported')).toContainText('WebGL2');
  await expect(page.locator('body')).toHaveClass(/failed/);
});

test('WebGL context lost recovers when the browser restores it', async ({ page }) => {
  const boot = await waitReadyOrUnsupported(page);
  test.skip(boot === 'unsupported', 'WebGL2 unavailable in this browser/GPU stack');

  const supported = await page.evaluate(() => window.__play!.loseWebGLContext());
  test.skip(!supported, 'WEBGL_lose_context unavailable in this browser');

  await page.waitForFunction(() => window.__play?.isContextLost() === true, null, {
    timeout: 5_000,
  });
  await page.evaluate(() => {
    window.__play!.restoreWebGLContext();
    window.__play!.forceContextRestore();
  });
  await page.waitForFunction(() => window.__play?.isContextLost() === false, null, {
    timeout: 10_000,
  });

  await page.getByTestId('seed-input').fill('7');
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('main-menu')).toBeHidden();
  await expect(page.getByTestId('status')).toBeVisible();
  const status = await page.getByTestId('status').innerText();
  expect(status.length).toBeGreaterThan(0);
});

test('production build loads under a non-root static prefix', async ({ browser }) => {
  const prefix = '/mahjong-with-ai';
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.woff2': 'font/woff2',
    '.map': 'application/json',
  };
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith(prefix)) {
      res.writeHead(404).end('not under prefix');
      return;
    }
    let rel = pathname.slice(prefix.length) || '/';
    if (rel.endsWith('/')) rel += 'index.html';
    const filePath = normalize(join(DIST, rel));
    if (!filePath.startsWith(DIST) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404).end('missing');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[extname(filePath)] ?? 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as { port: number };

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}${prefix}/`);
  const boot = await Promise.race([
    page
      .waitForFunction(() => window.__play?.ready === true, null, { timeout: 30_000 })
      .then(() => 'ready' as const),
    page
      .getByTestId('webgl2-unsupported')
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(() => 'unsupported' as const),
  ]);
  if (boot === 'unsupported') {
    await context.close();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    test.skip(true, 'WebGL2 unavailable in this browser/GPU stack');
    return;
  }
  await expect(page.locator('header h1')).toHaveText('AI 爽胡麻将');
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await context.close();
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

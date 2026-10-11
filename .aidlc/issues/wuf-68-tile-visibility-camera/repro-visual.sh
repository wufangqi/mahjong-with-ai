#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
shot="$root/.aidlc/issues/wuf-68-tile-visibility-camera/repro-latest.png"
checker="$root/.aidlc/issues/wuf-68-tile-visibility-camera/check-visibility.py"

cd "$root"
node --input-type=module - "$shot" <<'NODE'
import { chromium } from 'playwright';

const shot = process.argv[2];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.getByTestId('seed-input').fill('42');
await page.getByTestId('start-match').click();

const tileId = await page.evaluate(
  () => window.__play.snapshot().state.seats[0].hand[0].id,
);
await page.evaluate((id) => window.__play.clickTile(id), tileId);
await page.evaluate((id) => window.__play.clickTile(id), tileId);
await page.waitForTimeout(1500);

const riverCount = await page.evaluate(
  () => window.__play.snapshot().state.seats.reduce(
    (total, seat) => total + seat.river.length,
    0,
  ),
);
if (riverCount < 1) throw new Error('fixture did not reach a visible river tile');

await page.screenshot({ path: shot });
await browser.close();
NODE

python3 "$checker" "$shot"

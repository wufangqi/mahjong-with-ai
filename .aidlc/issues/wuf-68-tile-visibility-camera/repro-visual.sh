#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
shot="$root/.aidlc/issues/wuf-68-tile-visibility-camera/repro-latest.png"

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

python3 - "$shot" <<'PY'
import sys
from PIL import Image

image = Image.open(sys.argv[1]).convert("RGB")

def is_glyph(pixel):
    red, green, blue = pixel
    return (
        (blue > 60 and red < 110 and green < 140 and blue > red * 1.2)
        or (red > 100 and green < 85 and blue < 85 and red > green * 1.5)
        or (red < 50 and green < 50 and blue < 50)
    )

def glyph_count(box):
    return sum(is_glyph(pixel) for pixel in image.crop(box).getdata())

left_opponent = glyph_count((340, 220, 480, 480))
right_opponent = glyph_count((790, 230, 930, 470))
river = glyph_count((690, 350, 750, 440))

self_rows = []
for y in range(470, 570):
    count = sum(
        is_glyph(image.getpixel((x, y)))
        for x in range(250, 1050)
    )
    if count > 20:
        self_rows.append(y)
self_face_height = self_rows[-1] - self_rows[0] + 1 if self_rows else 0

failures = []
if left_opponent + right_opponent > 10:
    failures.append(
        f"opponent concealed faces leak glyphs: "
        f"left={left_opponent}, right={right_opponent}, expected total<=10"
    )
if river < 10:
    failures.append(
        f"public river tile has no readable face glyph: pixels={river}, expected>=10"
    )
if self_face_height < 48:
    failures.append(
        f"player tile face is too foreshortened: "
        f"height={self_face_height}px, expected>=48px"
    )

print(
    f"opponentGlyphs={left_opponent + right_opponent} "
    f"riverGlyphs={river} selfFaceHeight={self_face_height}px"
)
if failures:
    for failure in failures:
        print(f"FAIL: {failure}")
    raise SystemExit(1)
print("PASS")
PY

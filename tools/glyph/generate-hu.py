#!/usr/bin/env python3
"""Rasterize 「胡」 from Noto Serif SC Bold into src/fonts/glyph-hu.json."""
from __future__ import annotations

import json
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
FONT = ROOT / 'tools/font-subset/tmp/SubsetOTF/SC/NotoSerifSC-Bold.otf'
OUT = ROOT / 'src/fonts/glyph-hu.json'
S = 320


def main() -> int:
    if not FONT.is_file():
        print(f'missing font: {FONT}', file=sys.stderr)
        return 1
    img = Image.new('L', (S, S), 0)
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(str(FONT), 270)
    bbox = draw.textbbox((0, 0), '胡', font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (S - w) / 2 - bbox[0]
    y = (S - h) / 2 - bbox[1] + 8
    draw.text((x, y), '胡', font=font, fill=255)
    pts: list[list[float]] = []
    pix = img.load()
    for yy in range(0, S, 2):
        for xx in range(0, S, 2):
            if pix[xx, yy] > 120:
                pts.append([xx / S - 0.5, 0.5 - yy / S])
    if not pts:
        print('empty glyph', file=sys.stderr)
        return 1
    OUT.write_text(
        json.dumps(
            {
                'char': '胡',
                'size': S,
                'step': 2,
                'points': pts,
                'source': 'Noto Serif SC Bold offline raster',
            },
            ensure_ascii=False,
            separators=(',', ':'),
        ),
        encoding='utf-8',
    )
    print(f'wrote {OUT} ({len(pts)} points)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

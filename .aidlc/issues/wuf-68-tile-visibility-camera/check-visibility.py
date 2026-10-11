#!/usr/bin/env python3
"""Semantic visibility checks for WUF-68 deterministic gameplay screenshots.

Regions and heuristics target the balanced gameplay camera at 1280×720 DPR 1.
"""

from __future__ import annotations

import sys

from PIL import Image

# Balanced camera framing (seed 42 after first discard).
LEFT_OPPONENT = (250, 200, 400, 380)
RIGHT_OPPONENT = (880, 200, 1030, 380)
TOP_OPPONENT = (500, 150, 780, 280)
RIVER = (600, 380, 700, 480)
SELF_X0, SELF_X1 = 200, 1100
SELF_Y0, SELF_Y1 = 420, 560


def is_glyph(pixel: tuple[int, int, int]) -> bool:
    red, green, blue = pixel
    chroma = max(red, green, blue) - min(red, green, blue)
    # Dark green tile backs / felt: ignore low-chroma olive blacks.
    if green >= red - 5 and green >= blue - 5 and green > 15 and max(red, green, blue) < 60:
        return False
    if chroma < 40 and not (red < 35 and green < 35 and blue < 35):
        return False
    return (
        (blue > 70 and red < 100 and green < 130 and blue > red * 1.3 and blue - green > 15)
        # Saturated ink red (万/中), not warm wood / palace trim.
        or (red > 145 and green < 55 and blue < 55 and red > green * 2.6)
        or (red < 35 and green < 35 and blue < 35 and max(red, green, blue) <= 30)
    )


def glyph_count(image: Image.Image, box: tuple[int, int, int, int]) -> int:
    return sum(is_glyph(pixel) for pixel in image.crop(box).getdata())


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: check-visibility.py <screenshot.png>", file=sys.stderr)
        return 2

    image = Image.open(sys.argv[1]).convert("RGB")
    left_opponent = glyph_count(image, LEFT_OPPONENT)
    right_opponent = glyph_count(image, RIGHT_OPPONENT)
    top_opponent = glyph_count(image, TOP_OPPONENT)
    river = glyph_count(image, RIVER)

    self_rows: list[int] = []
    for y in range(SELF_Y0, SELF_Y1):
        count = sum(is_glyph(image.getpixel((x, y))) for x in range(SELF_X0, SELF_X1))
        if count > 15:
            self_rows.append(y)
    self_face_height = self_rows[-1] - self_rows[0] + 1 if self_rows else 0

    opponent_total = left_opponent + right_opponent + top_opponent
    failures: list[str] = []
    if opponent_total > 20:
        failures.append(
            "opponent concealed faces leak glyphs: "
            f"left={left_opponent}, right={right_opponent}, top={top_opponent}, "
            "expected total<=20"
        )
    if river < 10:
        failures.append(
            f"public river tile has no readable face glyph: pixels={river}, expected>=10"
        )
    if self_face_height < 48:
        failures.append(
            "player tile face is too foreshortened: "
            f"height={self_face_height}px, expected>=48px"
        )

    print(
        f"opponentGlyphs={opponent_total} "
        f"riverGlyphs={river} selfFaceHeight={self_face_height}px"
    )
    if failures:
        for failure in failures:
            print(f"FAIL: {failure}")
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

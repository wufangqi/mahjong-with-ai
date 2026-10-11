# Font subset tool

Builds WOFF2 subsets of **Noto Sans SC / Noto Serif SC** (Source Han Sans / Serif) for the game.

## Prerequisites

- Python 3 + venv with `fonttools` and `brotli`
- Upstream OTF downloads from [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk) releases

## Regenerate

```bash
python3 -m venv .tools-venv
.tools-venv/bin/pip install fonttools brotli pillow
# place NotoSansSC-Regular.otf and NotoSerifSC-Bold.otf under tools/font-subset/tmp/
.tools-venv/bin/pyftsubset tools/font-subset/tmp/NotoSansSC-Regular.otf \
  --text-file=tools/font-subset/chars-runtime.txt \
  --unicodes=U+0020-007E,U+00B7 \
  --flavor=woff2 \
  --output-file=src/fonts/source-han-sans-sc-subset.woff2
.tools-venv/bin/pyftsubset tools/font-subset/tmp/SubsetOTF/SC/NotoSerifSC-Bold.otf \
  --text-file=tools/font-subset/chars-runtime.txt \
  --unicodes=U+0020-007E,U+00B7 \
  --flavor=woff2 \
  --output-file=src/fonts/source-han-serif-sc-subset.woff2
```

Keep `src/fonts/OFL.txt` with the SIL OFL 1.1 text from the upstream package.

`chars-runtime.txt` must include every user-visible CJK glyph **and** UI punctuation
(`–—…、。！，：；？`). After regenerating WOFF2, `src/budget/fontCmap.test.ts` asserts
the shipped cmap still covers that set (ADR-0006).


Offline 「胡」 glyph lattice: `tools/glyph/generate-hu.py` writes `src/fonts/glyph-hu.json`.

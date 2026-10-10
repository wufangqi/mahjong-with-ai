# WUF-63 review — 一致中文字体与确定性视觉工具

- **Fixed point**: `e214d44`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip / Work 起点）
- **HEAD**: `84fbf22` on `feature/wuf-63`
- **Diff**: `git diff origin/feature/wuf-49-ai-shuanghu-mvp...HEAD`
- **对照**: issue AC + `implement.md` + ADR-0006 / 0009 / 0010
- **Verdict**: `fail`
- **合回**: 不合入 `mt_integrate_branch` / `main`（Spec 阻断未解）

## Standards

### Documented standards

**No hard ADR breaches** against ADR-0006 / 0009 / 0010 或仓库现有 TS/Vite/colocated-test 惯例。

1. **OK — ADR-0006**  
   子集 WOFF2 + `src/fonts/OFL.txt`；Sans → UI / Serif → 牌面与横幅；`loadGameFonts` + `areFontsReady` 拒绘牌面。

2. **OK — ADR-0009**  
   预览粒子/纹理走 `visualRandom` / `createVisualRng`；玩法 RNG 仍在 `src/core/rng.ts`（视觉侧独立 mulberry32 属隔离，非违规）。

3. **OK — ADR-0010**  
   `@font-face` 本地资产，无生产网络拉字体。

4. **Docs drift（soft）**  
   `tools/font-subset/README.md` 写 `generate-hu.mjs`，实际为 `tools/glyph/generate-hu.py`。  
   `e2e/visual.spec.ts` 注释写 `npm run test:visual -- --update-snapshots`，门禁脚本为 `test:visual:update`。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Speculative Generality** | `clearFaceTextureCache` 导出未调用；`tools/visual-test/compare.mjs` 未接入 CI（Playwright 已承担对比） |
| **Mysterious Name** | `loadFonts.test.ts` 只断言 family 字符串，未行使 `loadFonts` |
| **Duplicated Code** | `tableView.ts` / `styles.css` 重述 family 字面量，未统一用 `FONT_SERIF` / `FONT_SANS` |
| **Divergent Change** | `scene.ts` 继续叠加 harness 时钟 / `__visual` 与效果模拟 |

无硬性 documented-standard 阻断。

## Spec

### (a) Missing / partial

1. **阻断 — 主题固定未落到截图主体**  
   AC：「视觉预览可固定时钟、粒子种子、窗口、DPR、**主题**和截图时点」；`implement.md` L19 标「通过」。  
   `theme` 仅写入 `document.body.dataset.theme`（CSS `--felt` / `--gold`）；`preview` WebGL 绒面/天庭硬编码（如 `scene.ts` `feltTexture`），未接 `ThemeManager`；e2e 仅跑 `classic-green`，未验证主题改变画面。边缘截图主体为 canvas，主题参数对 artifact 几乎无效。

2. **Residual — ADR-0006 3 MB 预算**  
   ADR：「把字体计入 3 MB 首屏压缩传输预算」。本 diff 未量测首屏体积（WOFF2 合计约 250KB，属缺口而非明显超标）。非本票主阻断。

### (b) Scope creep

- `tools/visual-test/compare.mjs` — 自研 PNG 对比；CI 实际用 Playwright + `UPDATE_VISUAL_BASELINES`。验收未要求。
- `window.__visual` seek/capture — implement 有接缝说明；issue AC 未硬性要求（辅助性，轻）。

### (c) Looks done but wrong

1. **「主题」验收被夸大** — 见 (a).1；解析与 dataset 存在，截图路径上主题几乎不影响 canvas。
2. **加载门禁边角（非浏览器）** — `document.fonts` 缺失时 `loadFonts.ts` 直接 `loaded = true`。浏览器路径仍有 check；非主阻断。

### Covered (no finding)

子集化 Sans/Serif、WOFF2+OFL、`areFontsReady` 拒绘、离线 `glyph-hu.json` / `sampleGlyph('胡')`、seed / 窗口 / DPR / `captureAt` / 固定步进、三档 Playwright 基线、失败 artifact、`UPDATE_VISUAL_BASELINES=1` 更新门禁。

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | docs drift + 次要 smells | 无硬阻断 |
| Spec | 主题未接入预览截图路径；implement 误标通过 | **主题固定（阻断）** |

**Verdict `fail`**：回 implement — 将 `theme` 接到 preview 场面（或等价可见外观），并补至少一档主题差异验证；修正 `implement.md` 验收对照后再复审。不合回集成线。

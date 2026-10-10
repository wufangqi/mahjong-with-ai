# WUF-63 implement — 一致中文字体与确定性视觉工具

## 结论

工作分支 `feature/wuf-63` 已从 `origin/feature/wuf-49-ai-shuanghu-mvp` tip 创建并 push，落地子集化思源字体、离线「胡」点阵、确定性视觉预览与三档截图基线。

1. **字体**：UI 使用子集化思源黑体（Noto Sans SC）；牌面、横幅、胡与福使用子集化思源宋体（Noto Serif SC）。WOFF2 随包发布，`src/fonts/OFL.txt` 保留 SIL OFL 1.1。`loadGameFonts()` 完成前拒绝绘制牌面 Canvas。
2. **离线字形**：顶级场面「胡」粒子点阵来自 `src/fonts/glyph-hu.json`（构建期栅格化），`sampleGlyph('胡')` 不依赖运行时系统字体。
3. **视觉预览**：`preview.html?visual=1&tier=&seed=&width=&height=&dpr=&theme=&captureAt=` 固定时钟步进、粒子种子、窗口、DPR、主题与截图时点；`window.__visual` 暴露 seek/capture 接缝。
4. **主题（回修）**：`preparePreviewTheme` 经 `ThemeManager` 加载 `theme` 参数；`applyPreviewTheme` 写入 WebGL 绒面/天空/雾/灯光/牌背/横幅 CSS。e2e 覆盖 `classic-green` 三档与 `court-palace` 差异截图。
5. **CI 视觉**：Playwright 对比 basic / big / top（及宫廷 basic）基线；失败上传 `test-results/` artifact；基线更新必须 `UPDATE_VISUAL_BASELINES=1 npm run test:visual:update`。

## 回修（review=fail）

已回应 `review.md` Spec 阻断：

| 阻断 | 处理 |
| --- | --- |
| AC「可固定主题」仅 dataset/CSS，WebGL 场面未接 ThemeManager；`implement.md` 误标通过 | `themeBridge` + `applyPreviewTheme`；场景导入前 `preparePreviewTheme`；e2e 断言宫廷 felt/mark 与独立基线；更正验收对照 |

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| UI 使用子集化思源黑体，牌面、横幅、胡与福使用子集化思源宋体 | 通过（`fonts.css` + `families.ts` + styles/banner/mark） |
| 字体以 WOFF2 随包发布并保留许可证，加载完成后才绘制牌面 | 通过（`src/fonts/*.woff2` + `OFL.txt` + `areFontsReady` 门禁） |
| 顶级胡字形点阵离线生成且不依赖运行时系统字体 | 通过（`glyphHu.test.ts` 用无效字体名仍可确定性采样） |
| 视觉预览可固定时钟、粒子种子、窗口、DPR、主题和截图时点 | 通过（配置解析 + ThemeManager→WebGL + e2e classic/court） |
| 三档截图差异生成 CI artifact，基线更新要求人工确认 | 通过（`e2e/visual.spec.ts` + CI upload-artifact + `test:visual:update` 门禁） |

## 主要文件

- `src/fonts/` — WOFF2 子集、OFL、加载门禁、离线「胡」点阵
- `src/visual/` — 配置解析、视觉 PRNG、prepare
- `src/preview/themeBridge.ts` / `applyPreviewTheme.ts` — ThemeManager → 预览场面
- `src/preview/scene.ts` / `fx.ts` / `tiles.ts` — 确定性时钟与字形采样
- `e2e/visual.spec.ts` + `e2e/visual.spec.ts-snapshots/` — 三档 + 宫廷基线
- `tools/font-subset/`、`tools/glyph/`、`tools/visual-test/` — 再生与更新说明
- `.github/workflows/ci.yml` — 失败时上传视觉 artifact

## 本地验证

```bash
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

全部通过。

## 后续

不跳过 review。不自行合回集成线 / `main`。不调用 code-review。

# WUF-60 implement — 双主题热切换

## 结论

工作分支 `feature/wuf-60` 已从 `origin/feature/wuf-49-ai-shuanghu-mvp` tip 创建并 push，落地经典绿绒 / 中式宫廷热切换。

1. **主题边界** `ThemeDefinition` 仅含桌绒/框/标志/天空/雾/灯光/环境粒子/牌背/特效配色；禁止牌面、布局、场面节奏、横幅文案字段（ADR-0003）。
2. **ThemeManager**：默认主题 eager；非默认主题经 `import()` 按需加载；localStorage 持久化；单模块局部回退；整套无效完整回退；过渡时长钳制在 300–600 ms。
3. **场面配色**：胡牌场面开始时 `captureScenePalette()`；中途切主题只改 applied 外观，场面横幅继续用捕获配色。
4. **资源**：引用计数 + 延迟释放；最近一套 prior 主题保持 retain。
5. **渲染**：`TableView.applyThemeAt` 对桌绒/框/天空/雾/灯光色/牌背/标志全程插值；宫廷启用花瓣粒子与云纹牌背。

## 回修（review=fail）

已回应 `review.md` 三处阻断：

| 阻断 | 处理 |
| --- | --- |
| story 97 花瓣 / 云纹牌背未渲染 | `ambientParticles.kind: petals` → Points 粒子；`tileBack.pattern: cloud` → 程序化金云纹牌背 |
| AC / story 90 天空等末帧跳变 | `skyBlend.blendSkyColumn` 逐帧混合天空；雾/灯光色/牌背/标志同帧插值 |
| 懒加载宣称与静态 catalog 不符 | `catalog.loadTheme` 对 `court-palace` 使用 dynamic `import()`；默认经典绿绒仍 eager |

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 两套主题均只改变允许的外观字段，不改变牌面、布局或场面节奏 | 通过（`themeManager.test.ts` + `FORBIDDEN_THEME_KEYS`） |
| 切换在 0.3–0.6 秒内完成且无黑屏或单帧闪烁 | 通过（`transitionMs` 钳制 + `skyBlend.test.ts` 中段采样 + `TableView` 全程插值） |
| 正在播放的胡牌场面保留开始时配色，下一场面使用新配色 | 通过（unit + e2e mid-scene） |
| 主题选择持久化；单模块失败局部回退，整套无效完整回退 | 通过（unit + e2e reload） |
| 切换资源引用计数和延迟释放可验证，最近一套可快速切回 | 通过（`getRefCount` / `isRetained` / `reusedCached`） |
| story 97 宫廷花瓣与云纹牌背 | 通过（e2e：`ambientParticleKind()===petals`、`tileBackPattern()===cloud`） |
| 非默认主题按需加载 | 通过（`catalog.test.ts` + `loadTheme` dynamic import） |

## 主要文件

- `src/theme/` — 类型、Schema、懒加载 catalog、`skyBlend`、两套主题、`ThemeManager`
- `src/play/tableView.ts` — 全程主题插值、花瓣/浮尘粒子
- `src/preview/tiles.ts` — `setTileBackAppearance`（solid / cloud，不改牌面）
- `src/play/app.ts` / `index.html` — 主题选择
- `e2e/smoke.spec.ts` — 热切换与宫廷视觉验收

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

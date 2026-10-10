# WUF-60 implement — 双主题热切换

## 结论

工作分支 `feature/wuf-60` 已从 `origin/feature/wuf-49-ai-shuanghu-mvp` tip 创建并 push，落地经典绿绒 / 中式宫廷热切换：

1. **主题边界** `ThemeDefinition` 仅含桌绒/框/标志/天空/雾/灯光/环境粒子/牌背/特效配色；禁止牌面、布局、场面节奏、横幅文案字段（ADR-0003）。
2. **ThemeManager**：懒加载、localStorage 持久化、单模块局部回退、整套无效完整回退、非阻塞提示；过渡时长钳制在 300–600 ms。
3. **场面配色**：胡牌场面开始时 `captureScenePalette()`；中途切主题只改桌面/天空等 applied 外观，场面横幅继续用捕获配色；场面结束后释放，下一场面用新配色。
4. **资源**：引用计数 + 延迟释放；最近一套 prior 主题保持 retain，便于快速切回。
5. **UI**：HUD 主题下拉；`TableView.applyTheme` 对桌绒/框/天空/灯光/牌背/中央标志做无黑屏过渡。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 两套主题均只改变允许的外观字段，不改变牌面、布局或场面节奏 | 通过（`themeManager.test.ts` 边界断言 + `FORBIDDEN_THEME_KEYS`） |
| 切换在 0.3–0.6 秒内完成且无黑屏或单帧闪烁 | 通过（`transitionMs` 钳制；`TableView` 从旧外观插值到新外观） |
| 正在播放的胡牌场面保留开始时配色，下一场面使用新配色 | 通过（unit + e2e mid-scene） |
| 主题选择持久化；单模块失败局部回退，整套无效完整回退 | 通过（unit + e2e reload） |
| 切换资源引用计数和延迟释放可验证，最近一套可快速切回 | 通过（`getRefCount` / `isRetained` / `reusedCached`） |

## 主要文件

- `src/theme/` — 类型、Schema、目录、两套主题、`ThemeManager`
- `src/play/tableView.ts` — 主题外观应用与过渡
- `src/play/app.ts` / `index.html` / `src/styles.css` — 主题选择与提示
- `src/preview/tiles.ts` — `setTileBackColor`（不改牌面）
- `e2e/smoke.spec.ts` — 热切换浏览器验收

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

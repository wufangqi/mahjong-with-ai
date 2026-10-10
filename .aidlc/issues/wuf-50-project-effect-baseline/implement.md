# WUF-50 implement — 正式工程与效果基线

## 结论

单票 integration 路径已在 `feature/wuf-50-project-effect-baseline` 落地 M0 工程基线：

1. **正式应用**：仓库根目录 Vite + TypeScript + npm `three@0.160.0`，原生 DOM UI，无 React。
2. **效果预览入口**：开发模式 `npm run dev` 与生产构建 `npm run build` / `npm run preview` 均可启动；页面提供 basic / big / top 可操作预览。
3. **固定 basic 输入**：`src/preview/fixedHands.ts` 的 `FIXED_BASIC_HAND` 与只读原型手牌一致；冒烟测试点击「基础胡」可播放场面并出现「胡」横幅。
4. **只读原型**：现有 Demo 迁入 `prototype/mahjong-win-demo/`（含 vendored Three.js），附 `READONLY.md`；不进入 Vite 入口、不计入 Vitest coverage exclude 列表。
5. **CI 门禁**：`.github/workflows/ci.yml` 跑 typecheck、unit test、production build、Playwright Chromium 冒烟。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 正式应用可在开发模式和生产构建中启动，并显示可操作的效果预览入口 | 通过 |
| 固定输入可播放 basic 场面，观感可与现有 Demo 人工对照 | 通过（同源场面代码移植；原型保留对照） |
| 现有 Demo 作为只读原型保留且不进入生产构建或覆盖率 | 通过 |
| 类型检查、单元测试、生产构建和浏览器冒烟测试在 CI 中通过 | 本地 `npm run ci` 等价步骤通过；Actions 已添加 |

## 本地验证

```bash
npm ci
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

## 后续

不跳过 review。场面时间轴 JSON 化、主题系统与规则核心属后续切片，不在本票范围。

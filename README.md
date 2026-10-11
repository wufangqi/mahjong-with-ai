# AI 爽胡麻将

以胡牌爽感为核心的本地四人 3D 麻将游戏。项目采用 Three.js、Vite 和 TypeScript，支持内置 easy 对手与可选外接 AI。

## 产品入口

- **本地开发**：`npm install && npm run dev` → `http://127.0.0.1:5173/`
- **生产预览**：`npm run build && npm run preview` → `http://127.0.0.1:4173/`
- **非根路径静态托管**：构建使用相对资源路径（`base: './'`）。可将 `dist/` 挂到任意前缀，例如 GitHub Pages 项目站 `https://<user>.github.io/<repo>/`，或 `node tools/serve-subpath.mjs` 在 `/mahjong-with-ai/` 下验证。
- **效果预览**：[`preview.html`](./preview.html)（basic / big / top）

除用户明确启用的外接 AI 外，从本地静态服务器断网即可完整游玩。生产构建不访问分析/遥测端点；外接 AI 生产环境仅接受 HTTPS 代理（开发可另用 `http://localhost` / `127.0.0.1`）。

## 文档

- [产品需求文档](docs/需求文档.md)
- [领域词汇](.aidlc/domain/CONTEXT.md)
- [架构决策](.aidlc/domain/docs/adr/)

## 开发

```bash
npm install
npm run dev
```

开发服务器默认进入发牌 / 摸牌 / 出牌牌局（固定种子可复现）。确定性视觉截图（固定时钟 / 粒子种子 / 窗口 / DPR / 主题 / 时点）：

```text
preview.html?visual=1&tier=basic&seed=1&width=1280&height=720&dpr=1&theme=classic-green&captureAt=1200
```

```bash
npm run typecheck
npm test
npm run build
npm run preview
npx playwright install chromium firefox webkit
npm run test:e2e
# 人工确认后更新三档基线：
UPDATE_VISUAL_BASELINES=1 npm run test:visual:update
```

## 目录要点

- 正式应用在仓库根目录（Vite + TypeScript + npm `three`）
- `src/core/` 纯规则核心；`src/game/` 会话协调；`src/play/` 牌局表现；`src/compat/` 发布兼容（WebGL2 / CSP / 清除设置）
- `src/fonts/` 子集化思源黑体 / 宋体 WOFF2 与 OFL；顶级「胡」离线点阵
- `src/visual/` 确定性视觉预览配置与视觉 PRNG（与玩法 RNG 隔离）
- `prototype/mahjong-win-demo/` 为只读效果原型，不参与生产构建与覆盖率
- CI：类型检查、单元测试、生产构建、Playwright（Chromium 全量 + Firefox/WebKit 发布冒烟）；`main` 推送可部署 GitHub Pages

## 第三方许可与项目许可证

| 组件 | 许可 | 说明 |
| --- | --- | --- |
| Three.js (`three` npm) | MIT | 见 [npm 包许可证](https://www.npmjs.com/package/three) |
| 思源黑体 / 思源宋体子集 | SIL OFL 1.1 | 全文见 [`src/fonts/OFL.txt`](./src/fonts/OFL.txt) |

**项目许可证尚未选择**：仓库暂无根级 `LICENSE`；在所有者选定之前，请勿假定本仓库以 MIT 或其他 OSI 许可证发布。第三方组件仍遵循其自身许可证。

当前产品名“AI 爽胡麻将”为工作名。

## 状态

WUF-66：跨浏览器静态 MVP 发布——相对路径构建、GitHub Pages 工作流、CSP 元标签、WebGL2 兼容页与 context lost 恢复、隐私/无遥测说明与完整清除本地数据、Chromium/Firefox/WebKit 发布验收。

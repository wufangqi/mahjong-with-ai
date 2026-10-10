# AI 爽胡麻将

以胡牌爽感为核心的本地四人 3D 麻将游戏。项目采用 Three.js、Vite 和 TypeScript，支持内置 easy 对手与可选外接 AI。

## 文档

- [产品需求文档](docs/需求文档.md)
- [领域词汇](.aidlc/domain/CONTEXT.md)
- [架构决策](.aidlc/domain/docs/adr/)

## 开发

```bash
npm install
npm run dev
```

开发服务器默认进入发牌 / 摸牌 / 出牌牌局（固定种子可复现）。效果预览在 [`preview.html`](./preview.html)（basic / big / top）。固定 basic 手牌与只读原型 `prototype/mahjong-win-demo/` 一致，便于人工对照。

确定性视觉截图（固定时钟 / 粒子种子 / 窗口 / DPR / 主题 / 时点）：

```text
preview.html?visual=1&tier=basic&seed=1&width=1280&height=720&dpr=1&theme=classic-green&captureAt=1200
```

```bash
npm run typecheck
npm test
npm run build
npm run preview
npm run test:e2e
# 人工确认后更新三档基线：
UPDATE_VISUAL_BASELINES=1 npm run test:visual:update
```

## 目录要点

- 正式应用在仓库根目录（Vite + TypeScript + npm `three`）
- `src/core/` 纯规则核心（种子洗牌、发牌、摸牌、出牌）；`src/game/` 会话协调；`src/play/` 牌局表现
- `src/fonts/` 子集化思源黑体 / 宋体 WOFF2 与 OFL；顶级「胡」离线点阵
- `src/visual/` 确定性视觉预览配置与视觉 PRNG（与玩法 RNG 隔离）
- `prototype/mahjong-win-demo/` 为只读效果原型，不参与生产构建与覆盖率
- CI：类型检查、单元测试、生产构建、Playwright 冒烟与三档视觉对比（失败上传 artifact）

## 状态

WUF-63：子集化中文字体随包发布；字体就绪后才绘制牌面；顶级「胡」点阵离线生成；视觉预览可固定时钟与种子；三档截图基线需人工确认后更新。

当前产品名“AI 爽胡麻将”为工作名。项目许可证尚未选择；第三方依赖和字体仍分别遵循其自身许可证（字体见 `src/fonts/OFL.txt`）。

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

```bash
npm run typecheck
npm test
npm run build
npm run preview
npm run test:e2e
```

## 目录要点

- 正式应用在仓库根目录（Vite + TypeScript + npm `three`）
- `src/core/` 纯规则核心（种子洗牌、发牌、摸牌、出牌）；`src/game/` 会话协调；`src/play/` 牌局表现
- `prototype/mahjong-win-demo/` 为只读效果原型，不参与生产构建与覆盖率
- CI：类型检查、单元测试、生产构建、Playwright 冒烟

## 状态

WUF-51：相同种子可复现发牌；庄家 14 张先出；玩家手牌自动排序且刚摸牌在最右侧；二次点击或拖入牌河确认出牌且不可撤销；实体牌守恒 136。

当前产品名“AI 爽胡麻将”为工作名。项目许可证尚未选择；第三方依赖和字体仍分别遵循其自身许可证。

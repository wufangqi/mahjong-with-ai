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

开发服务器提供可操作的效果预览入口（basic / big / top）。固定 basic 手牌与只读原型 `prototype/mahjong-win-demo/` 一致，便于人工对照。

```bash
npm run typecheck
npm test
npm run build
npm run preview
npm run test:e2e
```

## 目录要点

- 正式应用在仓库根目录（Vite + TypeScript + npm `three`）
- `prototype/mahjong-win-demo/` 为只读效果原型，不参与生产构建与覆盖率
- CI：类型检查、单元测试、生产构建、Playwright 冒烟

## 状态

WUF-50 工程与效果基线已建立：正式应用可开发/构建启动，并提供固定输入的 basic 场面预览。

当前产品名“AI 爽胡麻将”为工作名。项目许可证尚未选择；第三方依赖和字体仍分别遵循其自身许可证。

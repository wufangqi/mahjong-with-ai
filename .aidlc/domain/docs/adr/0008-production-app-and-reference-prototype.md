# 正式应用与效果原型分开

正式应用位于仓库根目录，使用 npm、Vite、TypeScript、Three.js 和原生 DOM 组件，不引入 React。规则状态与 Three.js 场景保持唯一状态来源，避免为菜单和 HUD 再维护一套框架状态。Vitest 测规则与配置，Playwright 测完整流程、主题切换和固定条件下的宽松截图基线。

现有 Demo 迁入 `prototype/mahjong-win-demo/` 作为只读效果基准，提交到 Git，但不参与生产构建、发布产物或测试覆盖率；生产代码从 npm 引用 Three.js。产品需求文档进入 `docs/需求文档.md`，根 README 提供入口。

## Considered options

- 直接在无构建的 Demo 上持续开发
- 用 React 管理菜单、HUD 和结算
- 把原型及其 vendored Three.js 一同打进生产包

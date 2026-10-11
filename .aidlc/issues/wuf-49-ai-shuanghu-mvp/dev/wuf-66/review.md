# WUF-66 review — 发布跨浏览器静态 MVP 1.0

- **Fixed point**: `f5019ab`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip / Work 起点）
- **HEAD**: `79c9f9f` on `feature/wuf-66`
- **Diff**: `git diff f5019ab...HEAD`
- **对照**: issue AC + `implement.md` + ADR-0010 / ADR-0005 / ADR-0001 + `docs/需求文档.md` MVP 1.0
- **Verdict**: `pass`
- **合回**: `feature/wuf-66` → `feature/wuf-49-ai-shuanghu-mvp`

## Standards

### Documented standards

No **hard** breaches against ADR-0010 / 0001 / 0005 / 0008 or `docs/需求文档.md` §2.2（GitHub Pages + 静态非根 `base: './'`、无 PWA/React、生产 CSP `connect-src 'self' https:`、WebGL2 门禁与说明、清除覆盖 IndexedDB + localStorage 偏好 + 会话 AI 令牌、代理 HTTPS / localhost 仍由应用逻辑约束）。

**Judgement（ADR-0010「用户文案集中管理」）:** 新增玩家文案仍分散（`index.html` 隐私段、`WEBGL2_UNSUPPORTED_MESSAGE`、`app.ts` confirm）。仓库尚无 strings 模块，与既有 HTML/TS 散落一致，非阻断。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | `tools/serve-subpath.mjs` 与 `e2e/publish.spec.ts` 内联前缀静态服务器近似重复 |
| **Duplicated Code** | `app.ts` 双轨 lost 标志：`contextLost` 与 `contextGuard.isLost()` |
| **Duplicated Code** | `loseWebGLContext` / `restoreWebGLContext` 取 `WEBGL_lose_context` 形状相同 |
| **Divergent Change**（mild） | `bootPlayApp` 再叠 wipe / WebGL restore / 测试钩子 |

无 hard documented-standard 阻断。

### Compliant (no finding)

`src/compat/*` 拆分、CSP 仅生产注入、Pages workflow、`clearLocalSettingsKeys` 收敛、CI Chromium 全量 + Firefox/WebKit 发布冒烟矩阵、README 入口 / 第三方许可 / 项目许可证未选声明。

## Spec

### (a) Missing / partial

无阻断项。以下为测量深度 residual：

1. **Residual — 四浏览器「完整一场」**  
   Spec:「当前桌面 Chrome、Edge、Firefox、Safari 可完成一场完整游戏」。`publish.spec.ts` 在多浏览器上验证开局+一次出牌；Firefox/WebKit 仅 match publish（无 WebGL2 时 skip）；Edge 由 Chromium 代理。完整牌局路径仍主要在 Chromium `smoke.spec.ts`。

2. **Residual — 断网可玩**  
   Spec:「除用户明确启用的外接 AI 外，断网后从本地静态服务器可完整游玩」。本 diff 补隐私文案与 README；无 offline / no-network e2e，依赖既有本地 easy + ADR-0010 架构。

3. **Residual — 非根路径游玩深度**  
   Spec:「生产构建支持 GitHub Pages 和任意非根路径静态服务器」。`base: './'`、`pages.yml`、subpath boot 已有；subpath e2e 断言菜单/标题，未在前缀下打出一手牌。

### (b) Scope creep

无产品范围外功能。`__play.loseWebGLContext` / `forceContextRestore` 与 `tools/serve-subpath.mjs` 为验收接缝，合理。

### (c) Looks done but wrong

无产品路径阻断。

1. **Residual — context-loss e2e 强度**  
   Spec:「context lost 在可能时恢复」。生产路径：`preventDefault` + `webglcontextrestored` → `restoreAfterContextLoss()` 正确。测试钩子 `restoreWebGLContext` / `forceContextRestore` 可在未收到 restored 时清 lost 并重建；e2e 始终配对 `forceContextRestore`，未单独证明浏览器原生恢复。非阻断（用户不走测试钩子）。

2. **Residual — implement 表述偏强**  
   `implement.md` 将四浏览器完整一场标「通过」，相对本 diff 的 publish 覆盖偏乐观；不改验收结论。

### Verified OK

| 验收项 | 证据 |
| --- | --- |
| WebGL2 不支持明确说明 | `webgl2.ts` + publish mock `getContext` |
| context lost 可恢复（生产路径） | `contextGuard` + `TableView.restoreAfterContextLoss` + unit |
| GH Pages / 非根路径 | `base: './'`；`pages.yml`；subpath e2e / `serve-subpath.mjs` |
| CSP / 代理规则 / 无遥测 / 清除数据 | dist CSP 断言；既有 `isAllowedProxyUrl`；privacy-notice；clear-data e2e |
| README 入口、第三方许可、未选项目许可证 | 根 `README.md` |
| 本机复核 | `src/compat` 12 unit 通过；typecheck 通过 |

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | 无 hard；文案分散 / 重复服务器 / 双轨 lost 为 judgement | 无阻断 |
| Spec | AC 主干落地；四浏览器完整局 / 断网 e2e / subpath 游玩 / restore e2e 强度为 residual | 无阻断 |

**Verdict `pass`**：对照验收与 `implement.md` / `79c9f9f` 可收束；合回 `feature/wuf-49-ai-shuanghu-mvp`。

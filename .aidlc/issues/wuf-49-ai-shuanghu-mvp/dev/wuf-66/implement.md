# WUF-66 implement — 跨浏览器静态 MVP 发布

## 结论

工作分支 `feature/wuf-66` 从 `feature/wuf-49-ai-shuanghu-mvp` tip 创建并 push。落地相对路径静态构建、GitHub Pages 工作流、生产 CSP 元标签、WebGL2 兼容页与 context lost 恢复、隐私/无遥测说明与完整清除本地数据，以及 Chromium 发布验收（CI 另跑 Firefox/WebKit 发布冒烟）。

1. **WebGL2 门禁** `src/compat/webgl2.ts`：启动前探测；失败展示 `data-testid="webgl2-unsupported"` 兼容页。
2. **Context lost** `src/compat/contextGuard.ts` + `TableView.restoreAfterContextLoss()`：`preventDefault` 允许恢复；重建 mark/sky/composer/particles；无 restored 事件时可 `forceContextRestore`。
3. **CSP** `src/compat/csp.ts`：生产构建经 Vite 注入 meta（`connect-src 'self' https:`）；开发不注入以免打断 HMR。
4. **清除数据** `clearLocalSettingsKeys`：存档/日志 + 主题/画质/音量/动态/跳过对手/外接 AI + 会话令牌一并清除。
5. **静态非根路径** `base: './'` + `tools/serve-subpath.mjs` + e2e 前缀托管验证。
6. **GitHub Pages** `.github/workflows/pages.yml`（`main` / workflow_dispatch）。
7. **README**：产品入口、第三方许可表、项目许可证未选择声明、隐私/断网说明。

## 验收对照

| 验收项 | 状态 | 如何重复测量 |
| --- | --- | --- |
| 当前桌面 Chrome / Edge / Firefox / Safari 可完成一场 | 通过（Chromium 本地；CI 增 Firefox/WebKit 发布冒烟；无 WebGL2 时 skip） | `npm run test:e2e`；`PUBLISH_MULTI_BROWSER=1` 或 CI |
| WebGL2 不支持时明确说明；context lost 可恢复 | 通过 | `e2e/publish.spec.ts`（mock getContext / WEBGL_lose_context） |
| 生产构建支持 GitHub Pages 与任意非根路径 | 通过 | `base: './'`；`pages.yml`；subpath e2e |
| 除明确启用的外接 AI 外断网可玩 | 通过（既有本地 easy + 隐私文案；生产代理仅 HTTPS） | 主菜单隐私说明；`isAllowedProxyUrl` 单测 |
| CSP、外接 AI HTTPS/localhost、无遥测、清除数据可验证 | 通过 | dist CSP；`proxyUrl` 单测；privacy-notice；clear-data e2e |
| README 含入口、第三方许可、未选项目许可证 | 通过 | 根 `README.md` |

## 主要文件

- `src/compat/` — webgl2 / contextGuard / csp / clearLocalSettings
- `src/main.ts` / `src/play/app.ts` / `src/play/tableView.ts` / `index.html`
- `vite.config.ts` — 生产 CSP 注入
- `e2e/publish.spec.ts` / `playwright.config.ts`
- `.github/workflows/pages.yml` / `ci.yml`
- `README.md` / `tools/serve-subpath.mjs`

## 本地验证

```bash
npm ci
npm run typecheck && npm test
npm run build
npx playwright install chromium   # CI：chromium firefox webkit + --with-deps
CI=1 PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npx playwright test e2e/publish.spec.ts --project=chromium
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npx playwright test e2e/smoke.spec.ts --project=chromium
```

本机结果：typecheck 通过；197 unit 通过；publish×6 与 smoke×12（chromium）通过。Firefox/WebKit 需系统依赖（`npx playwright install-deps`）；无 WebGL2 时相关用例 skip。

## 后续

不跳过 review。不自行合回集成线 / `main`。不调用 code-review。

# WUF-60 review — 在牌局中切换两套主题

- **Fixed point**: `3b10e82`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip / implement 前）
- **HEAD**: `791b672` on `feature/wuf-60`
- **Diff**: `git diff origin/feature/wuf-49-ai-shuanghu-mvp...HEAD`
- **对照**: issue AC + `.aidlc/issues/wuf-49-ai-shuanghu-mvp/dev/wuf-60/implement.md` + WUF-49 stories 88–100 / 113 + ADR-0003 / arch theme bullets
- **本地复验**: `npm run typecheck` / `npm test`（63）均通过
- **Verdict**: `fail`
- **合回**: 本轮 Leader 明确「不合回集成线」；`fail` 亦不合入 `mt_integrate_branch` / `main`

## Standards

### Documented standards

1. **Judgement / residual — ADR-0010（用户文案集中管理）**  
   zh-CN still split: `ThemeManager` hardcodes notices（`已保存的主题无效…` / `主题模块「…」失败…`）；`index.html` `<option>` labels duplicate `displayName` in theme files；`listThemes()` unused for select population. Theme persistence via `localStorage` (`THEME_STORAGE_KEY`) is compliant.

2. **OK — ADR-0003（主题边界）**  
   `FORBIDDEN_THEME_KEYS`、`setTileBackColor`（faces untouched）、scene-palette capture、banner 文案来自 win plan / 颜色来自 theme palette 均对齐边界。`ambientParticles` 在 schema/data 存在但未接入 `TableView.applyThemeInstant` — 属 Spec 完整度，非边界违反。

3. **OK — ADR-0007 / 分层**  
   无 `src/core` 编辑；theme ID / palette 留在 `src/theme` + play。横幅档位仍来自 presentation。

4. **OK — ADR-0008**  
   Root Vite/TS、Vitest（`themeManager.test.ts`）、Playwright（`e2e/smoke.spec.ts`）、原生 DOM、无 React。

### Baseline smells (judgement only)

| Smell | Hunk / note |
| --- | --- |
| **Duplicated Code** | `MODULE_KEYS` via `Object.keys(classicGreenTheme.modules)` 与 schema 模块枚举并行；`app.ts` select change 与 `__play.selectTheme` 两处重复 apply 路径。 |
| **Shotgun Surgery** | 新主题需改 `ThemeId`、`THEME_IDS`、`catalog`、主题文件、以及硬编码 `index.html` options。 |
| **Speculative Generality** | retain/dispose/ref-count 对两主题 MVP 而言，非 active 几乎总是 `mostRecentPrior`，dispose 难在真实两主题切换中触发（测试用合成路径覆盖）。 |
| **Primitive Obsession** | sky gradient stops 用 CSS 字符串，table/lights 用 hex number。 |

No hard documented-standard breach. Skip tooling-enforced items.

## Spec

### (a) Missing / partial

1. **Fail — story 97 / 宫廷视觉完整度**  
   Spec 97: 「red woven table, dark wood, gold trim, palace-sunset gradient, **petals**, **cloud-pattern tile backs**, gold 福」  
   Data 有 `ambientParticles.kind: 'petals'` 与 solid `tileBack`；`TableView.applyTheme` **从不渲染粒子**；`setTileBackColor` 仅平面色，无云纹牌背。implement.md 称 TableView 过渡覆盖桌绒/框/天空/灯光/牌背/标志，但未兑现花瓣与云纹。

2. **Fail — AC / story 90（过渡无单帧闪烁）**  
   AC: 「切换在 0.3–0.6 秒内完成且无黑屏或单帧闪烁」；story 90: table and sky transition within 0.3–0.6s without a black frame.  
   `transitionMs` 钳制正确；felt/rail/trim 与光强 lerp；但 sky / fog / lights **color** / mark / tileBack 仅在 `t >= 1` 时经 `applyThemeInstant` 一次性跳变（solid→gradient 尤甚），不满足「天空亦过渡 / 无单帧闪烁」的字面要求。

3. **Partial — arch lazy load**  
   Arch: 「Theme loading is lazy… non-default theme loads on demand.」  
   `catalog.ts` 静态 import 两套主题；`loadThemeSync` 同步读目录 — 非按需加载。implement.md「懒加载」与代码不符。

4. **Partial — story 100 / palette 应用**  
   仅 `--banner-basic` 绑定；`bannerBig` / `bannerTop` 仍靠 CSS 硬编码档位样式；`effectPrimary` / `effectSecondary` 未进 play。

5. **Partial — story 88（主菜单）**  
   仅牌局 HUD `<select>`；无主菜单切换面。本子票标题为「在牌局中」，89 已覆盖；88 记 residual，不单独立为阻断。

6. **Partial — arch 测试矩阵**  
   有 persist / fallback / transition clamp / palette capture / retain；缺 **20 次重复切换**与 build-time schema rejection gate。延迟释放有 unit 合成路径，真实两主题切换下 prior 常被 pin，dispose 难触发。

### (b) Scope creep

- Marketing chrome: 标题/副标题改为「主题热切换」；`body[data-theme]` HUD CSS（`--felt`/`--gold`）不在 ADR 外观字段清单内 — 轻微、可接受。
- 新 trim mesh + 中央 mark sprite 对齐 ADR 字段，非 creep。

### (c) Looks done but wrong

- implement.md 验收表全部标「通过」，与上列 97 / 90 / lazy-load 缺口矛盾；manager 路径（91–96、98–99、persist、refcount/retain、e2e mid-scene）本身可信，但交付摘要过度宣称。

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | ADR-0010 文案分散 + 次要 smells | ADR-0010 copy split（非阻断） |
| Spec | 97 花瓣/云纹未渲染；90 天空等字段跳变；懒加载未兑现 | story 97 + AC/90 过渡（阻断） |

**Verdict `fail`**：回 implement 补齐宫廷粒子/云纹牌背（或诚实收窄并改 AC/spec）、天空等字段的无闪过渡，以及按需加载或修正 implement 宣称。本轮不合回集成线。

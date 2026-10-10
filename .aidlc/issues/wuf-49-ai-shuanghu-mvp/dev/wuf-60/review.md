# WUF-60 review — 在牌局中切换两套主题

- **Fixed point**: `3b10e82`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip / Work 起点）
- **HEAD**: `12289e3` on `feature/wuf-60`（回修后）
- **Diff**: `git diff origin/feature/wuf-49-ai-shuanghu-mvp...HEAD`；回修增量 `git diff 7bbe320...HEAD`
- **对照**: issue AC + 更新后 `implement.md` + 先前 fail 三处阻断 + WUF-49 stories 88–100 / 113 + ADR-0003
- **本地复验**: `npm run typecheck` / `npm test`（69）/ `npm run build`（含独立 `courtPalace-*.js` chunk）均通过
- **Verdict**: `pass`
- **合回**: 本轮 Leader 明确「不合回集成线」；不合入 `mt_integrate_branch` / `main`

## 复审：先前三处阻断

| 阻断 | 状态 | 证据 |
| --- | --- | --- |
| story 97 花瓣 / 云纹牌背未渲染 | **CLOSED** | `TableView.syncAmbientParticles` / `createParticles`；`setTileBackAppearance` + cloud canvas；e2e `petals` / `cloud` |
| AC / story 90 天空等末帧跳变 | **CLOSED** | `applyThemeAt` 全程插值；`skyBlend.blendSkyColumn` 中段混合；`skyBlend.test.ts` |
| 懒加载 vs 静态 catalog | **CLOSED** | `catalog.loadTheme` → `import('./themes/courtPalace')`；构建独立 chunk；`catalog.test.ts` |

## Standards

### Documented standards

1. **Judgement / residual — ADR-0010（用户文案集中管理）**  
   `listThemeOptions()` 仍硬编码宫廷 `displayName: '中式宫廷'`（为避免 eager import）；`ThemeManager` notices 仍内联。Select 已改为由 options 填充（相对首轮有改进）。非阻断。

2. **OK — ADR-0003**  
   `tileBack: { color, pattern }`、`ambientParticles` 留在 theme modules；牌面/节奏/横幅文案未进主题。

3. **OK — ADR-0007 / 分层**  
   无 core 编辑；`skyBlend` 纯数学；play 负责 Three 应用。

4. **OK — ADR-0008**  
   Vite/TS、Vitest（含 `skyBlend` / `catalog`）、Playwright、原生 DOM、无 React。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | `tableView.lerpHex` vs `skyBlend` RGB helpers；particle size 常量两处 |
| **Repeated Switches** | mid-transition `u < 0.5` 切换 pattern / glyph / particle source（无法对 discrete 字段像素插值） |

No hard documented-standard breach beyond ADR-0010 residual.

## Spec

### (a) Missing / partial

1. **Residual — story 88**  
   无主菜单切换面；本子票为「在牌局中」，HUD select 覆盖 story 89。非阻断。

2. **Residual — story 100 / palette**  
   `bannerBig` / `bannerTop` / effect 色仍未全部接到 play chrome（`--banner-basic` 已绑）。非阻断。

3. **Residual — arch 测试矩阵**  
   无 20 次重复切换 soak；两主题下 delayed dispose 仍难在真实路径触发。非阻断。

### (b) Scope creep

`skyBlend`、Points 粒子、程序化云纹 — 均服务于回修阻断，无无关功能面。

### (c) Looks done but wrong

None material。pattern/glyph 在 `u=0.5` 离散切换属合理；天空/雾/灯光色连续插值满足「无黑屏或单帧闪烁」。

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | ADR-0010 文案 residual + 次要 smells | ADR-0010（非阻断） |
| Spec | 三处阻断均 CLOSED；88 / bannerBig / 20-switch 仍 residual | 无阻断项 |

**Verdict `pass`**：回修闭环。本轮不合回集成线（Leader 指示）。

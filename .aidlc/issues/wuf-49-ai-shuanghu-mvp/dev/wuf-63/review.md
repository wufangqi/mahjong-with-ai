# WUF-63 review — 一致中文字体与确定性视觉工具

- **Fixed point**: `596e307`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip）
- **HEAD**: `01135fc` on `feature/wuf-63`（ThemeManager 回修后）
- **Diff**: `git diff origin/feature/wuf-49-ai-shuanghu-mvp...HEAD`；回修增量 `git show 01135fc`
- **对照**: issue AC + 更新后 `implement.md` + 先前 fail 阻断 + ADR-0003 / 0006 / 0009 / 0010
- **本地复验**: `vitest` — `themeBridge` / `visual/config` / `glyphHu` 通过
- **Verdict**: `pass`
- **合回**: 子票完工 → merge `feature/wuf-63` → `feature/wuf-49-ai-shuanghu-mvp`（不合 `main`）

## 复审：先前阻断

| 阻断 | 状态 | 证据 |
| --- | --- | --- |
| AC「可固定主题」仅 dataset/CSS，WebGL 未接 ThemeManager；`implement.md` 误标通过 | **CLOSED** | `preparePreviewTheme` → `ThemeManager`；`applyPreviewTheme` 写 felt/sky/fog/lights/tileBack/banner；`scene.ts` 导入时应用；e2e `court-palace` 断言 felt/mark/cloud + `basic-court-palace` 基线；`implement.md` 验收表与回修段已更正 |

## Standards

### Documented standards

1. **OK — ADR-0003**  
   ThemeManager modules 驱动预览场面外观；牌面绘制路径与 win timeline 仍主题无关。双 applicator（`applyPreviewTheme` vs `tableView.applyThemeAt`）属两场景不同技术，非边界违规。

2. **Judgement / residual — ADR-0003 环境粒子**  
   preview 未接 `ambientParticles` / FX palette（特效色仍有硬编码）。AC 要求固定主题于截图场面，非 play 全量粒子对等；非阻断。

3. **OK — ADR-0006 / 0009 / 0010**  
   WOFF2+OFL、视觉 RNG 隔离、`memoryStorage` 不覆盖 play 主题偏好。

4. **Docs**  
   `generate-hu.py` 路径与 `test:visual:update` 注释已对齐（软漂移已消）。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | fog/lights/tileBack 与 `tableView.applyThemeAt` 形似；felt 用 CanvasTexture+glyph 有意不同 |
| **Speculative Generality** | `getPreviewThemeManager` 导出；preview 未用 transition schedule |

无硬性 documented-standard 阻断。

## Spec

### (a) Missing / partial

1. **Residual — ambientParticles**  
   宫廷花瓣等未进 preview；主题毡面/天空/牌背/横幅已差分化。非阻断。

2. **Residual — ADR-0006 3 MB 预算**  
   未量测首屏压缩体积；字体约 250KB WOFF2。非阻断。

### (b) Scope creep

`court-palace` e2e + 基线 — 回应先前 fail「至少一档主题差异验证」，非无关扩面。

### (c) Looks done but wrong

None。主题路径为 ThemeManager → modules → WebGL，非 dataset-only。AC1–5 其余项（字体子集/门禁/离线胡点阵/时钟·种子·窗口·DPR·captureAt/三档基线+artifact+UPDATE 门禁）仍满足。

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | 粒子 residual + applicator 重复 | 无硬阻断 |
| Spec | 主题阻断 CLOSED；粒子 / 3MB residual | 无阻断项 |

**Verdict `pass`**：回修闭环，合回 Demand 集成线。

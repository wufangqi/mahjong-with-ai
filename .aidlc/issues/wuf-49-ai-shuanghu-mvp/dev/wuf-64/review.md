# WUF-64 review — 三档画质与 GPU 粒子兜底

- **Fixed point**: `d3482c8`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip / Work 起点）
- **HEAD**: `bc2a4d5` on `feature/wuf-64`
- **Diff**: `git diff origin/feature/wuf-49-ai-shuanghu-mvp...HEAD`
- **对照**: issue AC + `implement.md` + WUF-49 stories 105–109 / Implementation Decisions（GPU 粒子 + 自动降档）+ ADR-0003 / 0007 / 0008 / 0010
- **Verdict**: `pass`
- **合回**: 子票 `pass` → merge `feature/wuf-64` → `feature/wuf-49-ai-shuanghu-mvp`（不合入 `main`）

## Standards

### Documented standards

1. **OK — ADR-0008**  
   Vite/TS、Vitest（`qualityController` / `particleSystem`）、Playwright e2e、原生 DOM HUD；无 React。

2. **OK — ADR-0007 / 分层**  
   画质与粒子在 `src/quality` / `src/particles` + play/preview 渲染层；未污染 rule core / HandWon。

3. **OK — ADR-0003**  
   主题仍拥有粒子 kind/color 与天空定义；画质只缩放 DPR / 阴影 / Bloom / 预算 / backend / 天空简化。

4. **Judgement / residual — ADR-0010（用户文案集中管理）**  
   画质 HUD 文案（`画质` / `自动|低|中|高`）仍硬编码在 `index.html`，与既有「主题」chrome 先例一致。非阻断。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | GLSL point shaders 在 `particleSystem.ts` 与 `preview/fx.ts`（`makePointsMaterial`）各一份；`ParticleEmit` 形状亦有重复 |
| **Middle Man** | `preview/fx.ts` `ParticlePool` 多为对 `ParticleSystem` 的转发 |
| **Feature Envy** | `tableView` ambient 粒子自建 `createParticleSystem` 后手写速度/`aAlpha`/`aSize`，未走 `sys.update()`/`emit()` |
| **Speculative Generality** | `tierRank` / `TIER_RANK` 未使用；`ShadowQuality` 含 `'low'` 而预设未用 |

No hard documented-standard breach.

## Spec

### (a) Missing / partial

1. **Residual — Bloom / sky mid≡high**  
   AC「三档分别控制 … Bloom … 天空简化」；story 105。`presets`：仅 low 关 Bloom / 简化天空；mid/high 均为 `full`。DPR、阴影档、粒子预算仍分档。非阻断（控件齐全，相邻档可共享部分旋钮）。

2. **Residual — play 胡牌场面仍为 banner**  
   AC「GPU 粒子覆盖完整场面」。GPU/CPU 接缝覆盖 preview FX（`ParticlePool`）与桌面 ambient；`play` `showScene` 仍为 DOM banner（既有接缝，非本票引入的场面渲染缺口）。`implement.md` 明确「胡牌预览场面与桌面环境粒子」。非阻断。

### (b) Scope creep

1. **场间可重新选档** — story 108 只禁「同一场」自动升档；`endGame` + 下次 `selectInitial` 允许新开局重评。符合「同一场」语义。
2. **localStorage + HUD「自动」** — 超出 AC 字面，服务于手动锁定与恢复；合理增强。

### (c) Looks done but wrong

1. **Residual — `shadow.mapSize` 热切换**  
   AC「三档分别控制 … 阴影」。`applyQuality` 设置 `key.shadow.mapSize` 但未 dispose 既有 shadow map；Three.js 上 mid↔high 分辨率可能不生效。仍有 `shadows` on/off 与 `BasicShadowMap` vs `PCFSoftShadowMap` 分档。非阻断。

2. **Residual — 初始 FPS 样本偏轻**  
   story 106。`measureInitialFps` 为短 rAF 窗，可能偏乐观；有 GPU heuristic（含 UHD→mid）兜底。非阻断。

### Verified OK

| 验收项 | 证据 |
| --- | --- |
| 三档控制 DPR / 阴影 / Bloom / 粒子 / 天空 | `QUALITY_PRESETS` + `TableView.applyQuality`；unit + e2e `qualitySettings` |
| GPU 粒子 + CPU 回退 | `createParticleSystem`；preview + ambient；unit + e2e backend |
| 首次 GPU + 实测选档 | `selectInitial` + `measureInitialFps`；unit（weak / UHD / discrete） |
| 5s < 80% 目标只降一档且同场不升 | `recordFrame`；unit + e2e `injectFpsSample` |
| 手动选档关闭自动 | `setManual`；e2e manual lock |

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | ADR-0010 文案 residual + 次要 smells | ADR-0010（非阻断） |
| Spec | AC 五条均有实现与测试；Bloom/sky mid≡high、mapSize 热切换、play banner 场面为 residual | shadow mapSize 热切换（非阻断） |

**Verdict `pass`**：对照验收与 stories 105–109 可收束；合回 Demand 集成线。

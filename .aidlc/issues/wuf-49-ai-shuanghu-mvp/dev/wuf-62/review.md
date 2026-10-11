# WUF-62 review — 补齐声音、跳过、重播与减少动态效果

- **Fixed point**: `81ee34f`（`origin/feature/wuf-49-ai-shuanghu-mvp` tip / Work 起点）
- **HEAD**: `cf966ab` on `feature/wuf-62`
- **Diff**: `git diff origin/feature/wuf-49-ai-shuanghu-mvp...HEAD`
- **对照**: issue AC + `implement.md` + `docs/需求文档.md` §7.3–7.5 / §9.1 + ADR-0007 / 0008 / 0010
- **本地复验**: `vitest` — `audio` / `motion` / `winPresentation`（21）通过
- **Verdict**: `pass`
- **合入**: 子票 pass → merge `feature/wuf-62` → `feature/wuf-49-ai-shuanghu-mvp`（不合 `main`）

## Standards

### Documented standards

1. **OK — ADR-0008**  
   Vite/TS + 原生 DOM，无 React；Vitest 覆盖 `audio` / `motion` / `winPresentation`；Playwright 覆盖场面锁、音量/动态持久化。

2. **OK — ADR-0007**  
   场面档位与 SFX 映射留在 presentation（`winPresentation` / `eventSfx`）；未改 core `HandWon` 形状。

3. **OK — ADR-0010 local-first**  
   主/音效音量、减少动态、自动跳过对手均 localStorage；WebAudio 本地合成，无外部音频资源/网络。

4. **Judgement / residual — ADR-0010 用户文案集中管理**  
   新 UI 文案散落在 `index.html` / `app.ts`（`主音量` / `单独重播` 等），与既有切片同一 residual；非阻断。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | `memoryStorage` 在 audio/motion 测试各一份；preview 自建 localStorage try/catch；`2400` 与 `DEFAULT_SCENE_DURATION_MS` 重复 |
| **Middle Man** | `WinSceneScheduler.replay()` 仅转发 `replayAll()` |
| **Speculative Generality** | `WinScenePlayInfo` 生产 handler 未用 |
| **Mysterious Name** | `synth.ts` 中 `ac()` / `bus()` |

无硬性 documented-standard 阻断。

## Spec

### (a) Missing / partial

1. **Residual — 自动跳过仍先触发 `onScene`**  
   Spec 7.4：「可开启“自动跳过对手场面”」。`playCurrent` 先调 `sceneHandler`（横幅 + 场面 SFX）再 `defer(0)` 前进，对手场面有极短闪现。调度上已跳过完整时长；非阻断，后续可改为跳过前不发 `onScene`。

2. **Residual — play 路径无镜头阻尼**  
   AC / 7.5：「关闭震屏、猛推和快速转镜」。当前对局胡牌场面为横幅 + SFX（无 shake/dolly/turn）；`dampenCameraMotion` 接在 `preview/scene.ts`（三档镜头所在）。与 WUF-56 场面时间轴进 play 的接缝相关；非本票阻断。

3. **Residual — 场面锁保留「跳过对手」**  
   AC：「只开放跳过、音量、主题和减少动态效果」。实现另保留 `#auto-skip-opponent`（`implement.md` 已写明）；画质/对局操作已藏。轻微放宽，非阻断。

### (b) Scope creep

- 自动跳过对手偏好持久化（`mahjong.scene.autoSkipOpponent`）— AC 未要求；合理增强。
- 无无关功能面。

### (c) Looks done but wrong

1. **Judgement — `dampenCameraMotion` 软化而非清零 dolly**  
   Spec 7.5「关闭猛推」。实现将 `|dolly|` 压到 ≤0.25（×0.12），震屏清零、转镜封顶 0.25。与 unit 及注释「aggressive pushes」一致；作「关闭猛推」的合理解释，非阻断。

### AC → evidence

| AC | Evidence |
| --- | --- |
| 摸打吃碰杠胡 + 三档场面本地合成音效，无外部依赖 | `synth.ts` / `eventSfx.ts`；`app.ts` 域事件与 `sfxForSceneTier`；无采样依赖 |
| 主/音效音量可调并持久化 | `AudioController` + e2e reload |
| 跳过当前、自动跳过对手、单独/全部重播 | `WinSceneScheduler` unit + e2e skip/replay |
| 场面期只开放跳过/音量/主题/减少动态 | `body.scene-playing` + `data-scene-lock`；e2e 断言画质隐藏 |
| 减少动态关震屏/猛推/快转镜，保留牌/横幅/粒子 | `dampenCameraMotion` + preview 应用；仅改 camera 通道 |
| 默认 prefers-reduced-motion，可覆盖 | `ReducedMotionController` unit + e2e |

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | ADR-0010 文案 residual + 次要 smells | ADR-0010（非阻断） |
| Spec | 六条 AC 满足；auto-skip 闪现 / play 无镜头 / 场面锁多一开关为 residual | 无阻断项 |

**Verdict `pass`**。合入 `mt_integrate_branch`；不合 `main`。

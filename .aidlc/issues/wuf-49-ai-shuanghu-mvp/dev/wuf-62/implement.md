# WUF-62 implement — 声音、跳过、重播与减少动态效果

## 结论

工作分支 `feature/wuf-62` 已从 `origin/feature/wuf-49-ai-shuanghu-mvp` tip 创建并 push，落地本地合成音效、音量持久化、场面跳过/重播与减少动态效果。

1. **音频** `src/audio/`：WebAudio 本地合成摸/打/吃/碰/杠/胡与三档场面音效；`AudioController` 主音量 + 音效音量 localStorage 持久化；无外部音频依赖。
2. **场面调度** `WinSceneScheduler`：顺序播放；`skip`；自动跳过对手场面；结算单独重播 / 全部重播。
3. **场面锁 UI**：播放期间仅保留跳过、音量、主题、减少动态效果（及跳过对手开关）；画质与对局操作隐藏。
4. **减少动态** `src/motion/`：默认跟随 `prefers-reduced-motion`，可覆盖并持久化；preview 镜头关闭震屏、软化猛推、降低转镜速率，保留牌/横幅/粒子通道。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 摸打、吃碰杠胡和三档场面有本地合成音效，无外部音频依赖 | 通过（`audioController` / `eventSfx` unit + play 接线） |
| 主音量和音效音量可调并持久化 | 通过（unit + e2e reload） |
| 可跳过当前场面、自动跳过对手场面、单独重播或全部重播 | 通过（`winPresentation` unit + e2e） |
| 胡牌场面期间只开放跳过、音量、主题和减少动态效果 | 通过（e2e scene lock 断言） |
| 减少动态效果关闭震屏、猛推和快速转镜但保留牌、横幅和粒子 | 通过（`dampenCameraMotion` unit + preview 应用） |
| 默认读取 prefers-reduced-motion，玩家可覆盖 | 通过（`ReducedMotionController` unit + e2e） |

## 主要文件

- `src/audio/` — 合成音效、音量控制器、领域事件映射
- `src/motion/` — 减少动态偏好与镜头阻尼
- `src/play/winPresentation.ts` — 顺序场面、跳过、重播
- `src/play/app.ts` / `index.html` / `src/styles.css` — UI 与场面锁
- `src/preview/scene.ts` — preview 镜头应用减少动态
- `e2e/smoke.spec.ts` — 场面锁、重播、音量/动态持久化

## 本地验证

```bash
npm ci
npm run typecheck
npm test
npm run build
CI=1 npm run test:e2e
```

全部通过（unit 149；e2e 13）。

## 后续

不跳过 review。不自行合回集成线 / `main`。不调用 code-review。并行票勿抢合 `feature/wuf-49-ai-shuanghu-mvp` tip。

# WUF-64 implement — 三档画质与 GPU 粒子兜底

## 结论

工作分支 `feature/wuf-64` 已从 `origin/feature/wuf-49-ai-shuanghu-mvp` tip 创建并 push，落地 low / mid / high 画质档、自动降档与 GPU 粒子 CPU 兜底。

1. **画质预设** `src/quality/presets.ts`：三档分别控制 DPR、阴影（含 mapSize）、Bloom、粒子预算、天空简化。
2. **QualityController**：首次按 GPU probe + 实测帧率选档；连续 5 秒低于目标 80% 只降一档；同一场不自动升档；手动选档关闭自动变更。
3. **粒子**：`src/particles/createParticleSystem` — 优先 GPU ShaderMaterial，不可用或 low 档走 CPU PointsMaterial；胡牌预览场面与桌面环境粒子共用该接缝。
4. **渲染接入**：`TableView.applyQuality` 应用 DPR / 阴影 / Bloom composer / 天空简化 / 环境粒子预算；HUD 提供「自动 / 低 / 中 / 高」。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 三档分别控制 DPR、阴影、Bloom、粒子和天空简化 | 通过（unit presets + e2e qualitySettings） |
| GPU 粒子覆盖完整场面，GPU 路径不可用时可回退 CPU | 通过（particleSystem unit + preview e2e backend） |
| 首次运行根据 GPU 与实测选择初始档 | 通过（selectInitial unit + boot measureInitialFps） |
| 连续 5 秒低于目标 80% 时只降一档且同一场不自动升档 | 通过（unit + e2e injectFpsSample） |
| 玩家手动选档后关闭自动变更 | 通过（unit + e2e manual lock） |

## 主要文件

- `src/quality/` — 类型、预设、`QualityController`
- `src/particles/` — GPU/CPU 粒子工厂与 WebGL probe
- `src/play/tableView.ts` / `src/play/app.ts` — 画质应用与 HUD
- `src/preview/fx.ts` / `scene.ts` — 场面粒子走同一 GPU/CPU 接缝
- `e2e/smoke.spec.ts` — 画质与粒子验收

## 本地验证

```bash
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

全部通过。

## 后续

不跳过 review。不自行合回集成线 / `main`。不调用 code-review。

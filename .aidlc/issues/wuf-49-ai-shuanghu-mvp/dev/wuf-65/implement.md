# WUF-65 implement — 加载、性能与资源稳定预算

## 结论

工作分支 `feature/wuf-65`。落地可重复测量的验收接缝、真实加载进度、InstancedMesh 牌批处理，以及传输量 / 运行时 / 硬件 FPS 报告。

**复审 fail 回修**（对照 `review.md` @ `d17b52b`）：

1. **标点 cmap 回归已修**：`chars-runtime.txt` 补回 `–—…、。！，：；？` 并重建 WOFF2；`fontCmap.test.ts`（fontkit）锁 sans/serif cmap。
2. **UHD 绝对 FPS 已闭合**：Chromium 使用 ANGLE/Vulkan（`tools/budget/chromeGpuArgs.mjs`）；`ensure-dri-acl.sh` 在无 render 组时授 ACL。本机 UHD 630：`fpsGateApplied: true`，mid ≈60、top ≈60（≥30）。证据见 `budget-fps.json` / `budget-runtime.json`。

## 验收对照

| 验收项 | 状态 | 如何重复测量 |
| --- | --- | --- |
| 首屏 ≤3 MB | 通过 | `npm run budget:measure` |
| Fast 4G ≤3 s + 真实进度 | 通过 | `e2e/budget.spec.ts`（CDP 吞吐） |
| UHD 620 级 mid 60 / top ≥30 | 通过（UHD 630 / ANGLE-Vulkan） | `npm run budget:fps`；e2e soak 断言 |
| draw call ≤100；主题按需 ≤1 MB | 通过 | e2e + `budget-report.json` |
| 50 / 100 / 20 无持续增长 | 通过 | e2e 全量 soak |

## 本地验证

```bash
npm ci
bash tools/budget/ensure-dri-acl.sh   # 若 /dev/dri 对当前用户不可写
npm run typecheck && npm test
npm run build && npm run budget:measure && npm run budget:fps
npx playwright install chromium
npm run test:e2e
```

## 后续

不跳过 review。不自行合回集成线 / `main`。不另开无关 PR。

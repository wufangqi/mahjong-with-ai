# Budget measurement (WUF-65)

Repeatable checks for MVP loading / performance / resource budgets.

## Transfer sizes (CI-friendly)

```bash
npm run build
npm run budget:measure
```

Writes `.aidlc/issues/wuf-49-ai-shuanghu-mvp/dev/wuf-65/budget-report.json`.

## Browser metrics (includes full 50/100/20 soak)

```bash
npx playwright install chromium
npm run test:e2e -- e2e/budget.spec.ts
```

- Cold start under CDP Fast 4G (1.6 Mbps down + 150 ms RTT)
- Static-scene draw calls ≤100
- Full soak: 50 hands / 100 scenes / 20 theme switches (heap + Three.js resource counts)
- Mid + top FPS samples; absolute 60/30 gate when `gpuProbe` reports UHD-class iGPU

## Hardware FPS (UHD 620-class)

```bash
npm run build
npm run budget:dri    # ACL on /dev/dri when not in render/video group
npm run budget:fps    # ANGLE/Vulkan → Intel UHD (not SwiftShader)
```

Writes `budget-fps.json`. Playwright e2e uses the same `CHROME_UHD_GPU_ARGS` so `fpsGateApplied` is true on UHD hosts.

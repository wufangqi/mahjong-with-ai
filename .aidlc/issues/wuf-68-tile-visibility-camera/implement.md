# WUF-68 implement — 牌可见性与平衡视角

## 结论

单票 integration 路径已在 `feature/wuf-68-tile-visibility-camera` 落地：

1. **姿态组合** `src/play/tilePoses.ts`：座位 yaw 与局部姿态用 quaternion 相乘（`seatYaw ⊗ localPose`），不再把 yaw 加进 `Euler.y`。
2. **公开牌** 牌河 / 副露先局部面朝上，再套座位 yaw；四座位牌面法向世界 `+Y`。
3. **对手隐藏手牌** 竖直站立、牌背朝桌心；去掉 `faceDown` 换面，表现层仍只接收张数。
4. **玩法相机** 命名 profile `balanced`：`(0, 6.5, 12.8)` → lookAt `(0, 0.2, 0.4)`；胡牌焦点清除后回到该 base。
5. **验收** 姿态单测 + Playwright 语义截图（经典绿绒 / 中式宫廷）+ `repro-visual.sh`。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 四家公开牌牌面朝上可读 | 通过（pose 单测 + visual） |
| 三家对手只显示牌背 | 通过（pose 单测 + visual） |
| 玩家牌面高度 ≥ 48px（1280×720） | 通过（约 79px） |
| 平衡视角保留整桌与三家 | 通过（截图人工可核对 `repro-latest.png`） |
| 胡牌焦点结束后回到 balanced | 通过（smoke 平胡场景） |
| 两主题均不泄露对手牌面 | 通过（`e2e/tile-visibility.spec.ts`） |

## 主要路径

- `src/play/tilePoses.ts` / `tilePoses.test.ts`
- `src/play/tableView.ts` / `tileBatch.ts`
- `e2e/tile-visibility.spec.ts` / `e2e/smoke.spec.ts`
- `.aidlc/issues/wuf-68-tile-visibility-camera/{check-visibility.py,repro-visual.sh,repro-latest.png}`

## 本地验证

```bash
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run preview -- --host 127.0.0.1 --port 4173
bash .aidlc/issues/wuf-68-tile-visibility-camera/repro-visual.sh
npx playwright test e2e/tile-visibility.spec.ts
```

## 后续

不跳过 review。不自行合回 `main`。

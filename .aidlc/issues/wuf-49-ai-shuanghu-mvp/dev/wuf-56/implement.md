# WUF-56 implement — 完整番型白名单与三档场面

## 结论

工作分支 `feature/wuf-56` 已从集成分支 `feature/wuf-49-ai-shuanghu-mvp` tip 创建并 push，落地完整番型白名单与特效档映射：

1. **番型** `evaluateWin` 补齐 `pengpenghu` / `qingyise`；七对四张计两对；十三幺要求无副露；副露参与清一色判定。
2. **叠加** 非平胡每项 1 番可叠加（如清一色+碰碰胡、清一色+杠上开花、七对+清一色）；平胡仅在无其他番型时计入；自摸/庄家不加番。
3. **特效档** `sceneTierForPatterns` 取命中番型最高档（basic / big / top），不按总番晋升。
4. **固定预览** `WIN_TIMELINES` 为 basic / big / top 提供可校验时间轴；`validateTimeline` 门禁；`scene.ts` 从配置读取时长与横幅。

## 验收对照

| 验收项 | 状态 |
| --- | --- |
| 碰碰胡、清一色、七对、十三幺各有正反例并按领域定义判定 | 通过（`winning.test.ts`） |
| 七对将四张相同计作两对，十三幺要求无副露 | 通过 |
| 非平胡番型每项 1 番且允许叠加；自摸和庄家不加番 | 通过 |
| 特效档取命中番型的最高档，不使用总番数值 | 通过（`winPresentation.test.ts`） |
| basic、big、top 均可在固定预览中播放并通过配置 Schema 校验 | 通过（`timelines.test.ts` + preview 接线） |

## 主要文件

- `src/core/winning.ts` — 完整白名单判定与叠加
- `src/core/hand.ts` — 胡牌时传入副露 kind/codes
- `src/play/winPresentation.ts` — 碰碰胡/清一色 → big；最高档映射
- `src/preview/timelineSchema.ts` / `timelines.ts` — 三档时间轴与 Schema
- `src/preview/scene.ts` — 固定预览读取时间轴配置

## 本地验证

```bash
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## 后续

不跳过 review。不自行合回集成线 / `main`。不调用 code-review。

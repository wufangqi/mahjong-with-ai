# WUF-53 review — 平胡响应、basic 场面与结算

- **Fixed point**: `a977ec8`（`origin/feature/wuf-49-ai-shuanghu-mvp`）
- **HEAD**: `5d9415b` on `feature/wuf-53`
- **Diff**: `git diff origin/feature/wuf-49-ai-shuanghu-mvp...HEAD`
- **对照**: issue AC + `.aidlc/issues/wuf-49-ai-shuanghu-mvp/dev/wuf-53/implement.md` + WUF-49 相关故事
- **Verdict**: `pass`

## Standards

### Documented standards

1. **Residual — ADR-0007（胡牌事件载荷：副露）**（本切片可接受，非阻断）  
   `WinnerResult` / `HandWon` 现携带 `seat`、`hand`、`patterns`、`fan`、`discarder`、`tile`、`winKind`，仍无 `副露` 字段（即使 `[]`）。本票平胡路径为纯暗牌，无副露接线；完整副露载荷属后续吃碰杠切片。  
   证据：`src/core/types.ts`（`WinnerResult`、`HandWon`）；`src/core/hand.ts`（`buildWinnerResult`）。

2. **OK — ADR-0007（表现字段隔离）**  
   `HandWon` 不含 `tier` / `themeId` / 横幅样式；特效档仅在 `src/play/winPresentation.ts`。

3. **OK — ADR-0002**  
   `evaluateWin` 使用白名单 id；平胡在命中七对 / 十三幺时不叠加。

4. **OK — ADR-0003 / ADR-0008 / ADR-0009**  
   场面节奏不随主题变化；play UI 仍为 DOM + session；本 diff 无 gameplay `Math.random`。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | `pinghuResponseState`（`winResponse.test.ts`）≅ `buildPlayerPinghuResponseState`（`session.ts`） |
| **Divergent Change** | `PlaySession` 兼管 e2e/demo fixture（`loadPinghuWinDemo`）与 `forcePassWins` |
| **Mysterious Name** | `WinSettlement` 注释写「shown after HandWon」，领域类型用 UI 口吻 |
| **Primitive Obsession (mild)** | `WinSceneScheduler.replay()` 用 `hand: []` 回填 `WinnerResult` |

## Spec

### (a) Missing / partial

- **五条 WUF-53 AC：主路径无缺口。** 证据：`winning.test.ts`（平胡排他）；`winResponse.test.ts` / `session.test.ts`（胡/过、过后续打、`HandWon` 无表现字段）；`winPresentation.test.ts` + e2e（basic 调度、结算赢家/平胡/1 番、重播）。
- **Partial — 父规格「JSON 时间轴场面」：** WUF-49 Solution / story 72 要求 basic 场面经数据驱动时间轴播放；本 diff 为 CSS `#banner` stub（`showScene`）。WUF-53 AC「进入场面调度」已满足；完整轨道路线留给后续特效切片。
- **Partial — 父规格 story 35 全白名单排他：** `evaluateWin` 仅相对已实现的七对 / 十三幺排他；碰碰胡 / 清一色等未接线时仍可记平胡——与当前核心白名单一致，非本票阻断。

### (b) Scope creep

- **赢家连庄 / 一炮多响庄家**（`nextDealerAfterWin`）— 父故事 8–9；implement 写明「下一局由赢家坐庄」，合理接线。
- **`qidui`→big、`shisanyao`→top** 映射表 — 父故事 73–74；WUF-53 仅强制平胡→basic。

### (c) Looks done but wrong

- **「100 ms 内进入场面调度」：** 实现用 `defer(..., 0)`，满足预算；单元测试以同拍时钟断言调度入口时刻，未测 HandWon→schedule 端到端延迟。证据偏弱，未构成功能反证。

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | ADR-0007 副露残留 + 若干 smell | HandWon 缺副露（切片外，非阻断） |
| Spec | 五条 AC 满足；父规格场面/全白名单排他为后续 | JSON 时间轴场面未做（超出本票 AC） |

**子票 `pass`：** 合入 Demand 级 `mt_integrate_branch`（`feature/wuf-49-ai-shuanghu-mvp`）。不合 `main`。

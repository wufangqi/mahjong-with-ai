# WUF-68 review — 对手牌可见性与玩家手牌视角

- **Fixed point**: `f454142`（spec/diagnosis tip；implement 前）
- **HEAD**: `251f009` on `feature/wuf-68-tile-visibility-camera`
- **Diff**: `git diff f454142...251f009`
- **对照**: `spec.md` / `diagnosis.md` / `implement.md` + 本票期望
- **Verdict**: `pass`
- **合回**: 单票集成分支；代码已在 `mt_integrate_branch`，无 Work merge 步骤

---

## Standards

### Documented standards

No **hard** breaches. Repo has no `CODING_STANDARDS.md` / `CONTRIBUTING.md`. `AGENTS.md` → `.aidlc/matt/domain.md`（glossary / ADR）. Diff stays in presentation (`src/play/` + visual harness), uses seat/opponent/player/牌背-aligned names, and does not contradict domain ADR boundaries (theme still owns tile-back appearance).

1. **OK — quaternion 组合替代 Euler.y += yaw**  
   证据：`composeSeatWorldPose` = `seatYaw ⊗ localPose`；`tableView` 公开/隐藏姿态走该路径。

2. **OK — 表现层仍只收对手张数**  
   证据：`collectOpponentPoses(seat, count, …)`；无真实对手牌值入参。

3. **OK — 命名玩法相机 profile**  
   证据：`BALANCED_GAMEPLAY_CAMERA.id === 'balanced'`；`setWinCameraFocus(null)` 恢复 base 位姿。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code / Speculative Generality** | `localPlayerHandRotation` 与 `localOpponentConcealedRotation` 均返回 identity quaternion；语义标签有用，行为尚未分叉 |
| **Speculative Generality** | `gameplayCameraProfile()` 恒返回 `'balanced'`（单 profile） |
| **Duplicated Code** | `e2e/smoke.spec.ts` 焦点前后两段重复 y/z≈6.5/12.8 断言，且硬编码字面量 |
| **Message Chains** | `e2e/tile-visibility.spec.ts` 的 `snapshot().state!.seats[0].hand[0]!.id`（与既有 e2e 风格一致） |

无 hard documented-standard 阻断。

---

## Spec

### (a) Missing / partial

无针对本票核心验收（四家公开牌面朝上、对手牌背、玩家牌面 ≥48px、balanced 相机、信息边界）的缺失。

**Soft / residual（不阻断）：**

1. Spec Impl：「Stop using a fixed white-dragon face…」— `faceDown` 换面已去掉， upright 姿态显示主题牌背；但 `collectOpponentPoses` 仍推送 `code: 'P'`（atlas 在牌背朝向时不采样正面）。视觉契约已满足，占位码为 residual。
2. Spec US16 resize survival — 依赖既有 `onResize`；本 diff 无独立 resize 断言。
3. Spec Testing「camera focus returns to the balanced base **profile**」— `gameplayCameraProfile()` 恒为 `'balanced'`，名字断言偏空；真正有效的是 position `y≈6.5` / `z≈12.8` 恢复检查。

### (b) Scope creep

无产品面扩张。Harness（`gameplayCameraProfile` / `gameplayCameraPosition`、`check-visibility.py`）服务于 Testing Decisions，可接受。

### (c) Looks done but wrong

无重开根因的实现错误：

| 验收项 | 证据 |
| --- | --- |
| 四家公开牌面朝上 | `tilePoses.test.ts` face.y > 0.99；visual river glyphs |
| 三家对手只显示牌背 | pose：inward · back > 0.99；`check-visibility` opponentGlyphs 阈值 |
| 玩家牌面 ≥48px | implement / repro：selfFaceHeight≈79px；`repro-latest.png` 手牌可读 |
| balanced 保留整桌 | 截图可见三家位置与牌河 |
| 胡牌焦点后回 balanced | `smoke.spec.ts` 平胡后 position 断言 |
| 两主题不泄露 | `e2e/tile-visibility.spec.ts` classic-green + court-palace |

人工核对 `repro-latest.png`：玩家手牌正面可读、河中公开牌面朝上、对手区域为牌背/侧面，与 diagnosis 复现失败态（opponent 漏字形 / riverGlyphs=0 / 35px）对照已闭合。

---

## Summary

- **Standards**: 0 hard；若干 soft smells（双 identity 工厂、单 profile API、smoke 重复字面量）
- **Spec**: 0 hard 缺失；worst soft = profile 名字断言偏空 + 残留 `code: 'P'`（视觉已正确）
- **Verdict**: `pass`

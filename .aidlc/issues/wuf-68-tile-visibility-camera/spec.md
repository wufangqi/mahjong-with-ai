## Problem Statement

玩家无法稳定辨认其他座位打出的牌：现有牌姿态只让玩家座位的出牌牌面朝上，左右座位的出牌竖立，对面座位的出牌牌面朝向桌面。与此同时，上家和下家的隐藏手牌会显示重复的白板牌面，视觉上像是暴露了手牌。这里并没有传入真实隐藏牌值，但表现仍违反“对手手牌只显示牌背”的预期。

玩家自己的手牌也因玩法相机俯角过大而明显缩短，固定验收画面中的有效牌面高度只有约 35px，影响读牌和选牌。

## Solution

统一修正四个座位的牌姿态：使用明确的世界旋转组合，让牌河和副露中的公开牌始终牌面朝上，让三家对手的隐藏手牌保持竖直且只向玩家显示牌背。隐藏信息的数据边界保持不变，表现层仍不得接收对手的真实手牌牌值。

玩法相机改为已确认的“平衡视角”：降低俯角并增强玩家手牌可读性，同时保留完整牌桌和另外三家的位置。玩家牌面的自动验收高度不低于 48px，最终构图通过人工截图确认。

## User Stories

1. As a 玩家, I want to see every seat's played tile face-up in the river, so that I can follow the public game state.
2. As a 玩家, I want a played tile's suit and rank to remain readable regardless of who played it, so that seat position does not affect decision quality.
3. As a 玩家, I want newly played tiles to use the same public orientation as older river tiles, so that the river is visually consistent.
4. As a 玩家, I want claimed tiles in a meld to remain face-up, so that I can understand every public 吃、碰 and 杠.
5. As a 玩家, I want the upper opponent's concealed hand to show only tile backs, so that hidden information remains visually hidden.
6. As a 玩家, I want the lower-left and lower-right opponents' concealed hands to show only tile backs, so that side-seat perspective does not expose placeholder faces.
7. As a 玩家, I want all three opponent hands to follow the active theme's tile-back appearance, so that concealment remains clear after a theme switch.
8. As a 玩家, I want opponent hands to remain concealed while their hand counts stay visible, so that I can understand hand size without seeing tile values.
9. As a 玩家, I want my own hand to face me at a readable angle, so that I can identify tiles without leaning into the screen.
10. As a 玩家, I want my own tile-face glyphs to occupy at least 48px vertically in the standard desktop view, so that suits and honors are legible.
11. As a 玩家, I want the complete table and all three opponents to remain in view, so that improving my hand view does not remove public context.
12. As a 玩家, I want the balanced camera framing to remain stable during normal draw and discard actions, so that the table does not visually jump.
13. As a 玩家, I want selecting or dragging a tile to preserve the corrected hand orientation, so that interaction feedback does not reintroduce the old angle.
14. As a 玩家, I want the camera to return to the balanced base view after a 胡牌场面, so that temporary scene focus does not permanently alter gameplay framing.
15. As a 玩家, I want the corrected visibility behavior in both 经典绿绒 and 中式宫廷, so that changing themes cannot reveal opponent faces or hide public tiles.
16. As a 玩家, I want the corrected view to survive browser resizing at supported desktop dimensions, so that aspect changes do not alter which tile surface is visible.
17. As a developer, I want deterministic visual reproduction for the visibility rules, so that a future rendering change cannot silently restore the defect.
18. As a developer, I want all four seat transforms checked independently, so that a screenshot covering one seat cannot mask an orientation error in another seat.

## Implementation Decisions

- Compose tile orientation explicitly as a seat yaw quaternion multiplied by a local pose quaternion. Do not combine independent rotations by adding Euler-angle components.
- Treat player hand, opponent concealed hand, river tile and meld tile as distinct presentation poses.
- Keep the player's hand upright with its face toward the player.
- Keep opponent concealed hands upright with their backs toward the table center and the player camera.
- Lay river and meld tiles face-up in local space before applying the seat's world yaw. Their face normal must point upward for all four seats.
- Stop using a fixed white-dragon face plus a face-swap flag as the visual representation of opponent concealment. The visible surface must be the active theme's tile back.
- Preserve the existing information boundary: opponent presentation receives only the concealed tile count, never the actual tile codes.
- If the batched tile API cannot express the required composition unambiguously, change its pose contract from Euler angles to quaternion or transform matrices.
- Retain theme-controlled tile-back color and pattern. The correction must work for solid and cloud-pattern backs.
- Introduce a named balanced gameplay camera profile instead of anonymous hard-coded framing values.
- Tune the balanced profile by lowering the camera's downward angle and/or moving it toward the player while retaining the full table and all seats.
- Preserve temporary 胡牌场面 camera focus. Clearing focus must restore the balanced gameplay profile.
- Keep existing draw, selection, drag, claim and settlement behavior unchanged; this work changes presentation transforms and camera framing only.
- Use the existing deterministic visual configuration and seeded game flow rather than introducing a second rendering harness.

## Testing Decisions

- The primary, highest-level seam is the existing Playwright gameplay surface using a fixed seed, 1280×720 viewport and DPR 1.
- The primary scenario starts a local game, performs a real player discard, allows the deterministic opponents to act, and checks all three user-visible outcomes together.
- The visual check must verify that opponent concealed regions contain no readable face glyphs, a public river tile contains readable face glyphs, and the player's tile-face glyph height is at least 48px.
- Keep a screenshot from the deterministic scenario for human review of the balanced composition. Use tolerant semantic thresholds rather than exact whole-image equality for automated gating.
- Run the primary visual scenario under both 经典绿绒 and 中式宫廷 to verify that tile-back theme changes do not affect concealment.
- Add one focused pose test below the browser seam because one screenshot cannot exercise every seat and every public tile category.
- The pose test covers all four seats and asserts that river and meld face normals point upward after world composition.
- The same pose test asserts that each opponent's visible inward surface is the back surface and that actual opponent tile codes are not required to build concealed poses.
- Existing interaction tests remain responsible for click-to-select, second-click discard and drag-to-river behavior; they must continue to pass after pose-contract changes.
- Existing theme-switch and 胡牌场面 tests remain responsible for theme lifetime and temporary camera focus; add an assertion that camera focus returns to the balanced base profile.
- A good test checks visible behavior or a stable geometric invariant. It must not assert incidental object ordering, private method calls or exact floating-point matrices beyond a small tolerance.
- The existing deterministic reproduction command remains available at `.aidlc/issues/wuf-68-tile-visibility-camera/repro-visual.sh` until the fix turns all three signals green.

## Out of Scope

- Mahjong rules, turn order, 响应 priority, scoring or settlement changes.
- Changes to easy or external AI decision-making.
- Revealing any opponent's actual concealed tile values.
- Redesigning tile-face artwork, fonts, tile-back themes or table themes.
- Redesigning the 胡牌场面 camera choreography beyond restoring the corrected base view afterward.
- Mobile or portrait layout support.
- Reworking the full rendering engine or replacing Three.js.
- Changing quality tiers, particles, audio, persistence or replay formats.

## Further Notes

- Root-cause evidence and world-normal calculations are recorded in `diagnosis.md`.
- The repeated blue pattern visible on side opponents is the fixed `P` placeholder, not their real hand. The correction is still required because the visual contract is “牌背 only.”
- The “平衡视角” decision is confirmed: improve the player's hand readability while retaining the complete table and all opponent positions.
- The 48px player-face threshold is an automated lower bound. Final visual acceptance still requires reviewing the deterministic screenshot.

# WUF-68 诊断：牌面可见性与玩家视角

## 结论

三个视觉问题可稳定复现，包含两个独立根因：

1. `TableView.seatWorldPose` 通过把座位 yaw 直接加到 `Euler.y` 来组合“牌的局部姿态”和“座位旋转”。Three.js 默认 `XYZ` 欧拉角下，这不等价于先把牌放平、再绕世界 Y 轴旋转到座位方向。
2. 玩家视角使用固定高位相机，牌面相对视线明显缩短，且没有玩法相机的视觉验收或姿态单元测试。

对手显示出的重复蓝色图案是固定白板代码 `P`，不是实际手牌内容。当前实现只把对手手牌张数传给表现层，因此不存在真实隐藏牌值泄露；但视觉语义仍然错误，应显示牌背。

## 稳定复现

前置条件：生产预览运行在 `http://127.0.0.1:4173/`。

```bash
bash .aidlc/issues/wuf-68-tile-visibility-camera/repro-visual.sh
```

固定条件：

- 种子：42
- 视口：1280×720，DPR 1
- 动作：开始一局后打出第一张手牌
- 耗时：约 3.8 秒

连续三次结果：

```text
opponentGlyphs=83–84 riverGlyphs=0 selfFaceHeight=35px
FAIL: opponent concealed faces leak glyphs
FAIL: public river tile has no readable face glyph
FAIL: player tile face is too foreshortened
```

`repro-latest.png` 是最近一次复现截图。

## 根因证据

### 1. 牌河姿态错误

`src/play/tableView.ts` 中：

- `collectRiverPoses` 使用局部旋转 `Euler(-π/2, 0, 0)`，意图让牌面朝上。
- `seatWorldPose` 随后构造 `Euler(localRot.x, localRot.y + yaw, localRot.z)`。

用 Three.js 对相同欧拉角计算局部牌面 `+Z` 的世界法向，四座位结果为：

```text
seat 0: ( 0,  1, 0)  向上
seat 1: (-1,  0, 0)  向左
seat 2: ( 0, -1, 0)  向下
seat 3: ( 1,  0, 0)  向右
```

因此只有玩家座位的出牌面朝上；左右座位的出牌竖立，对面座位的出牌面朝桌面。截图中间的公开牌只露出空白侧面，和 `riverGlyphs=0` 一致。

### 2. 对手手牌错误显示固定白板牌面

`collectOpponentPoses`：

- 只接收手牌张数，不接收实际牌值；
- 每张固定使用 `code: 'P'`；
- 使用 `Euler(π/2, 0, 0)` 并设置 `faceDown: true`。

错误的欧拉角组合让左右两家的牌面成为垂直面。`src/play/tileBatch.ts` 的 shader 又在 `faceDown` 时交换 `front` / `back` 判定，于是朝向相机的面采样固定 `P` 图集，形成截图中的重复蓝色白板图案。

这解释了“看起来能看到上家和下家的牌”：能看到的是占位牌面，不是真实隐藏牌，但正确表现应为牌背。

### 3. 玩家牌面视角过度缩短

玩法相机固定为：

```text
position = (0, 9.2, 11.5)
lookAt   = (0, 0.2, 0.4)
```

相机约向下俯视 39°。玩家手牌保持竖直，视线相对其正面偏离较大；固定截图中有效字形高度只有 35px。当前没有玩法相机 profile，也没有以玩家牌面可读性为目标的测试。

## 排除项

- 不是规则状态或隐藏信息模型错误：对手实际牌值没有进入 `collectOpponentPoses`。
- 不是主题材质本身错误：牌背材质可正常显示在对面座位和牌的侧面。
- 不是单纯响应式缩放错误：resize 正常更新相机 aspect；错误来自世界姿态和固定相机参数，改变视口只能改变构图，不能修正法向。

## 建议修复

1. 用 quaternion 明确组合姿态：`seatYaw * localPose`，不要把 yaw 直接加到欧拉角分量。
2. 对手手牌保持竖直，并让牌背朝桌面中心；不要靠 `code: 'P' + faceDown` 模拟隐藏。
3. 牌河与副露先在局部空间面朝上，再用世界 Y 轴座位 quaternion 旋转；断言四座位牌面法向的 `worldY` 均接近 `+1`。
4. 下调玩法相机高度或把相机向玩家侧前移，减少玩家牌面的透视缩短。`selfFaceHeight >= 48px` 仅为自动回归阈值，最终构图需要人工确认。
5. 增加姿态单元测试：覆盖四座位的对手牌背、牌河正面、副露正面；保留 `repro-visual.sh` 作为浏览器回归。

## 测试缺口

当前没有 `TableView` 牌姿态测试。已有 Playwright 测试验证流程、预算和既有截图，但既有基线接受了错误姿态，因此无法阻止这类回归。

## 已确认的相机方案

采用**平衡视角**：

- 降低当前俯角，明显放大玩家自己的牌面；
- 保留完整牌桌和另外三家的位置；
- 玩家牌面自动验收目标为 48px 以上，最终截图仍需人工确认观感。

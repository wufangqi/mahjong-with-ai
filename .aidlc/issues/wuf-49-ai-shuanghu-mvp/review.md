# WUF-49 Stage 接缝 review — 开发 Stage（Demand 集成线）

- **Kind**: 开发 Stage 接缝（`mt_batch=true`；不合 `main`）
- **Branch**: `feature/wuf-49-ai-shuanghu-mvp` @ `391fae8`
- **Fixed point**: `origin/main` (`9539bd5`)
- **Diff**: `git diff origin/main...HEAD`（60 commits；WUF-50…66 均已合入）
- **对照**: `.aidlc/issues/WUF-49/spec.md`（MVP 1.0 / M6）+ `docs/需求文档.md` §2.2 + ADRs `0001`–`0010`
- **本地复验**: `npm ci`；`npm run typecheck` 通过；`npm test` 在无 `dist/` 时失败（见下）；`npm run build` 后 `npm test` 197/197 通过
- **Verdict**: `fail`

## 接缝完整性

| 检查 | 结果 |
| --- | --- |
| Tip 含 WUF-66 / `391fae8` | 是 |
| Work `mt_review_result=pass` 合入 | 是（WUF-50…66；含多轮 fail→fix→pass） |
| 直合 `main` | 否（正确） |
| 集成可 typecheck / build | 是 |
| 干净 CI 单元测试顺序 | **否** — `ci.yml` 在 `build` 前跑 `test`，`firstScreen.test.ts` 依赖 `dist/` |

---

## Standards

### Documented violations

1. **Hard — 对局路径未使用数据驱动胡牌时间轴**  
   规则：`.aidlc/issues/WUF-49/spec.md` Implementation Decisions（~168）：「Win presentation uses a data-driven timeline of lifecycle-managed tracks」；ADR-0003 场面节奏主题无关、全主题共用。  
   证据：`src/preview/timelines.ts` + `timelineSchema.ts` 校验 `WIN_TIMELINES`，但 `src/play/` 不导入。对局场面为固定横幅 + SFX + 2400 ms 定时器（`src/play/app.ts` `showScene`；`DEFAULT_SCENE_DURATION_MS` in `winPresentation.ts`）。预览持有校验过的轨道；对局不播放。

2. **Hard — 首屏预算测试与 CI 顺序冲突**  
   规则：Impl Decisions ≤3 MB 首屏；Testing Decisions / `npm run ci` 含 budget。  
   证据：`src/budget/firstScreen.test.ts` 要求 `dist/` 已存在；`.github/workflows/ci.yml` 顺序为 Unit tests → Production build；本地干净树上 `npm test` 2 条失败。预算门禁在默认 CI 路径上无法成立（`budget:measure` 也不在 workflow 内）。

3. **Soft — 对局环境粒子绕过视觉 RNG 接缝**  
   规则：ADR-0009 — 视觉粒子用独立随机源。  
   证据：`src/visual/rng.ts` 供 preview 使用；`src/play/tableView.ts` 环境粒子 spawn/respawn 使用裸 `Math.random`。`src/core/` / `src/game/` / `src/ai/` 无 gameplay `Math.random`（牌局隔离仍成立）。

4. **Residual — HandWon 赢家载荷缺副露**  
   规则：ADR-0007 — 核心胡牌事件含手牌、**副露**、番型与番数。  
   证据：`WinnerResult`（`src/core/types.ts`）仅有 `seat` / `patterns` / `fan` / `hand`，无 `melds`。WUF-53 起记为切片残留，接缝仍未闭合。

**Checked OK:** 无 React（ADR-0001）；`prototype/` 不进生产/覆盖率（ADR-0008）；`HandWon` 无 `tier`/`themeId`（ADR-0007）；外接 AI 令牌会话级、无厂商 Key 落盘（ADR-0005）；IndexedDB/localStorage 分工、无 SW/PWA/analytics（ADR-0010）；WebGL2 门禁与 CSP 注入存在。

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Duplicated Code** | `src/audio/synth.ts` 与 `src/preview/audio.ts` 平行 WebAudio 噪声/增益图 |
| **Divergent Change** | `src/play/app.ts`（~1356 行）混杂 boot/DOM、主题/AI 设置、存档导出、场面 chrome、画质 harness、开发者回放 |

---

## Spec

### (a) Missing / partial

1. **对局胡牌场面（US72–78；Impl data-driven timeline）**  
   对局 `showScene` 仅切换 HTML 横幅 + SFX 2400 ms；无赢家座位镜头（US78）、无 `WIN_TIMELINES` 轨播放。basic/big/top 编排在 `src/preview/`，不在 match 路径。特效档映射与多赢家排序已有（`winPresentation.ts`）。各 Work 评审曾记为 AC 外残留；Demand M6 接缝仍缺口。

2. **Testing Decisions — 10 000 局自对弈**  
   Spec：「Seeded self-play runs at least 10,000 hands…」。仓库无 `selfPlay` / 10k 模拟器（`src/`、`tools/`、`e2e/`）。

3. **Testing Decisions — 规则核心 100% 分支覆盖**  
   Spec：「The rule core requires 100% branch coverage。」`vitest.config.ts` 无 coverage thresholds；CI 不跑 coverage。

4. **Testing Decisions — 浏览器流程覆盖偏薄**  
   Spec 列 chow-choice、每种杠、一炮多响等浏览器接缝。核心单测有（`kong.test.ts`、`multiWin.test.ts` 等）；`e2e/smoke.spec.ts` 未覆盖吃/杠/一炮多响玩家流程（偏平胡 demo / 流局）。

5. **Testing Decisions / M6 CI 矩阵偏薄**  
   Spec：GHA 含 coverage、schema validation、production build、Playwright、visual。`.github/workflows/ci.yml` 缺 coverage、独立 schema 门、`budget:measure`。Firefox/WebKit 主要在 `publish.spec.ts`；Edge 借 Chromium 代理。

### (b) Scope creep

未发现越界产品面（无 normal/hard AI、BGM、第三主题、PWA、analytics、Unity）。轻微：核心 `HandWon` 赢家预按座位排序（`claims.ts`）超出「表现层展开场面」措辞；preview 配置中未驱动的 track kinds（WUF-56 残留）。

### (c) Looks done but wrong

1. **首屏 3 MB 门禁 vs CI 顺序（Impl ≤3 MB）**  
   `firstScreen.test.ts` 在 build 前断言 `dist/`；与 GHA / `npm run ci`（test→build）冲突。干净检出上预算断言不能门禁。build 之后复跑则通过——说明测的是产物，但接线顺序错误。

2. **「三档场面」观感（US72–75）**  
   特效档映射与多赢家顺序调度完整，但对局不跑 preview Effect 时间轴 / 座位镜头；e2e「basic scene」只证明横幅调度 + CSS tier。

---

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | 2 hard + 1 soft + 1 residual + 2 smells | 对局场面未接时间轴；CI/test 顺序使预算门失效 |
| Spec | a:5 · b:1 · c:2 | 对局胡牌场面仍为横幅 stub；Demand 测试接缝（自对弈 / 覆盖率 / CI）未闭合 |

**Verdict `fail`.** 集成线功能骨架与各 Work AC 大多已合入，但 Demand MVP 1.0 接缝仍有阻断缺口，需回 implement 闭合后再复审。不合 `main`。

### 建议回修优先级（供 Leader / implement；本票不派工）

1. 修 CI：`build`（或 `budget:measure`）先于依赖 `dist/` 的预算单测，或把预算断言移出默认 `vitest run`。
2. 将对局胡牌场面接到已校验的 `WIN_TIMELINES` / preview Effect（含赢家镜头），或明确缩 scope 并改 Spec（需人裁决则升 `needs-human`）。
3. 补 Demand 测试决策：核心覆盖率门禁、≥10k 自对弈、关键浏览器流程缺口。
4.（次要）`WinnerResult` 补副露；对局粒子改用 `visualRandom`。

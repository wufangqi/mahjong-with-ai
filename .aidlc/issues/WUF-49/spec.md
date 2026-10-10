# AI 爽胡麻将 MVP 1.0

## Problem Statement

玩家想要一款以胡牌高光时刻为核心、无需联网服务也能完整游玩的 3D 四人麻将游戏。现有 Three.js Demo 已证明 basic、big、top 三档胡牌场面具有表现力，但它没有真实规则、对手、牌局状态、存档、主题边界或可维护的工程结构，所有牌型、外观和场面都直接写在展示代码里。

产品需要把 Demo 转变为可重复游玩的“AI 爽胡麻将”：使用范围明确的爽胡规则，支持玩家与三名对手连续打若干局，按番型播放对应胡牌场面，并能在经典绿绒和中式宫廷主题之间热切换。游戏必须本地优先、规则可复现、表现与规则分离；内置 easy 对手保证离线可玩，外接 AI 只作为可选决策来源，不能获得隐藏信息或破坏牌局合法性。

## Solution

构建一个桌面优先的静态网页游戏。纯 TypeScript 规则核心管理 136 张实体牌、爽胡规则、合法动作、吃碰杠、番型、听牌、一炮多响、流局、庄家和连续多局的一场；核心接收命令并产生新状态与领域事件。Three.js 表现层订阅事件，更新桌面、牌墙、牌河、副露、镜头、音频与 UI。胡牌事实由表现层映射为 basic、big 或 top，再通过 JSON 时间轴播放。

产品提供经典绿绒和中式宫廷两套主题，主题只改变外观与配色，不改变牌面、布局或胡牌场面节奏。每名对手默认由可复现的 easy 决策器控制，也可独立切换为用户代理的 OpenAI-compatible 外接 AI；任何超时、错误或非法动作都回退 easy。

交付分成两个边界：M3 是可玩纵切版，完成桌面 Chrome/Edge 上的完整一场、两套主题、三档场面、本地存档和外接 AI；M6 是 MVP 1.0，再补齐三档画质、GPU 粒子、性能、字体、资源管理、Firefox/Safari 和静态部署。

## User Stories

1. As a player, I want to start a new local game from the main menu, so that I can play without creating an account.
2. As a returning player, I want to continue my most recent unfinished game, so that closing or refreshing the page does not lose progress.
3. As a player, I want to end the current game voluntarily, so that I can return to the main menu and clear its active save.
4. As a player, I want one game to contain consecutive hands, so that dealer continuity matters without requiring an overall score.
5. As a player, I want to choose “next hand” after settlement, so that I can keep playing at the same table.
6. As a player, I want the first dealer to be selected randomly, so that repeated games do not always start from the same seat.
7. As a player, I want the dealer to receive 14 tiles and discard first, so that the opening follows the declared rule.
8. As a player, I want the winner to become dealer in the next hand, so that dealer movement is easy to understand.
9. As a player, I want the nearest winner after the discarder to become dealer after multiple wins, so that dealer selection is deterministic.
10. As a player, I want the dealer to remain after an exhaustive draw, so that the next hand has a defined starter.
11. As a player, I want my seat to remain at the bottom of the screen, so that the table does not rotate when the dealer changes.
12. As a player, I want a visible dealer marker, so that I know who starts without needing round-wind scoring.
13. As a player, I want to play with 136 tiles containing suits and honors but no flowers, so that the tile set matches the爽胡规则.
14. As a player, I want each physical copy of a tile to remain distinct internally, so that claims, logs, saves, and replays identify the exact tile.
15. As a player, I want normal draws to come from the head of the wall, so that wall consumption is predictable.
16. As a player, I want kong replacement tiles to come from the tail of the wall, so that normal draws and replacements remain distinct.
17. As a player, I want kong to be unavailable when no replacement tile remains, so that the game never enters an impossible state.
18. As a player, I want to chow only the previous player’s discard, so that chow follows the declared rule.
19. As a player, I want to choose the exact chow combination when several sequences are possible, so that the game does not make a hidden choice for me.
20. As a player, I want to pung a matching discard from any player, so that exposed triplets work consistently.
21. As a player, I want to declare an exposed kong from another player’s discard, so that four matching tiles can form a meld.
22. As a player, I want to declare a concealed kong after drawing and before discarding, so that concealed four-of-a-kind hands are playable.
23. As a player, I want to upgrade an existing pung to a kong after drawing the fourth tile, so that added kongs are supported.
24. As a player, I want added kongs to complete without robbing the kong, so that the selected rule remains intentionally simple.
25. As a player, I want a claimed discard removed from the river and shown in the meld with its source seat, so that public information stays accurate.
26. As a player, I want the claimant to discard immediately after chow or pung, so that interrupted turn order resumes correctly.
27. As a player, I want the claimant to take a replacement tile before discarding after exposed kong, so that the hand has the correct tile count.
28. As a player, I want win claims to outrank all other claims, so that a winning tile cannot be taken for a meld.
29. As a player, I want exposed kong to outrank pung and pung to outrank chow, so that simultaneous claims resolve deterministically.
30. As a player, I want equal-priority claims resolved by nearest seat after the discarder, so that only one non-win claimant succeeds.
31. As a player, I want the game to wait for my response without a timer, so that I can inspect my legal choices.
32. As a player, I want “pass” to reject only the current opportunity, so that the same tile can still be claimed later.
33. As a player, I want only win claims to be allowed after the final normal draw is discarded, so that an empty wall cannot lead to endless claim chains.
34. As a player, I want to win with an ordinary four-meld-and-pair hand, so that common hands are recognized as 平胡.
35. As a player, I want 平胡 to count only when no other listed pattern matches, so that it does not inflate every standard hand.
36. As a player, I want 碰碰胡 to recognize four triplet-or-kong melds and a pair, so that triplet hands receive the big scene.
37. As a player, I want 清一色 to include exposed melds and reject honors, so that the entire hand must use one numbered suit.
38. As a player, I want 七对 to count four identical tiles as two pairs, so that this declared edge case is accepted.
39. As a player, I want 十三幺 to require a concealed hand, so that exposed melds invalidate it.
40. As a player, I want a win on a kong replacement tile to count as 杠上开花, so that the circumstance can stack with another pattern.
41. As a player, I want each matched non-平胡 pattern to count as one fan, so that settlement remains simple and transparent.
42. As a player, I want self-draw and dealer status not to multiply fans, so that the game does not imply a monetary scoring system.
43. As a player, I want no minimum fan requirement, so that every recognized winning hand can end the hand.
44. As a player, I want to pass on a valid win, so that I remain in control of my hand.
45. As a player, I want AI opponents to declare every available win, so that their behavior is deterministic and does not stall.
46. As a player, I want multiple players to win on the same discard, so that 一炮多响 is fully supported.
47. As a player, I want all winners in 一炮多响 settled atomically, so that the first winner does not erase later winners.
48. As a player, I want each winner’s patterns and fan count shown separately, so that multiple results remain understandable.
49. As a player, I want exhaustive draw settlement to reveal every hand, so that I can understand why nobody won.
50. As a player, I want exhaustive draw settlement to show who was ready and their winning tiles, so that the final state is informative.
51. As a player, I want no fan or score transfer on exhaustive draw, so that settlement matches the no-money rule.
52. As a player, I want my hand automatically sorted by suits and honors, so that it is easy to scan.
53. As a player, I want the newly drawn tile separated on the right, so that I can distinguish it before discarding.
54. As a player, I want to select a tile with one click and confirm it with a second click, so that accidental discards are reduced.
55. As a desktop player, I want to drag a tile into the river as an alternative, so that mouse interaction feels direct.
56. As a player, I want legal chow, pung, kong, win, and pass buttons shown contextually, so that I do not need to memorize unavailable actions.
57. As a player, I want confirmed actions to be final, so that event history stays deterministic without undo branches.
58. As a player, I want no ready-hand or discard recommendation during play, so that the first release remains a game rather than an assistant.
59. As a player, I want three easy opponents by default, so that the game is playable completely offline.
60. As a player, I want each opponent configurable as built-in or external AI, so that I can experiment per seat.
61. As a player, I want all external AI seats to share one proxy and model configuration, so that setup remains manageable.
62. As a player, I want external AI to see only its hand, public melds, rivers, remaining count, dealer, turn, and legal actions, so that it cannot cheat.
63. As a player, I want other hands, wall order, and random seed withheld from external AI, so that hidden information remains hidden.
64. As a player, I want external AI responses constrained to listed legal actions, so that a model cannot corrupt the rules.
65. As a player, I want simultaneous external AI claim checks sent in parallel, so that three opponents do not create a 60-second wait.
66. As a player, I want external AI to fall back to easy after 20 seconds, so that a slow service cannot block the game indefinitely.
67. As a player, I want malformed, failed, or illegal external AI responses to fall back to easy, so that optional AI never makes the game unplayable.
68. As a privacy-conscious player, I want a disclosure before first enabling external AI, so that I know the proxy and exact data boundary.
69. As a privacy-conscious player, I want model-provider API keys kept outside the browser, so that the static app does not expose provider credentials.
70. As a player, I want the proxy address and model remembered but its token kept only for the browser session, so that convenience does not persist a secret.
71. As a player, I want normal play to work with no network, so that external AI remains optional.
72. As a player, I want 平胡 to trigger the basic scene, so that ordinary wins still feel rewarding.
73. As a player, I want 碰碰胡、清一色、七对 and 杠上开花 to trigger the big scene, so that notable hands feel stronger.
74. As a player, I want 十三幺 to trigger the top scene, so that the rarest hand receives the largest spectacle.
75. As a player, I want the highest matched pattern to choose the scene tier, so that stacked fan count does not unexpectedly change presentation.
76. As a player, I want multiple winner scenes ordered by top, big, then basic, so that the strongest result is shown first.
77. As a player, I want same-tier winner scenes ordered from the discarder’s next seat, so that ties are deterministic.
78. As a player, I want the camera to focus each winning seat in sequence, so that every winner’s scene occurs around the correct hand.
79. As a player, I want only wins to have tiered scenes, so that chow, pung, kong, and exhaustive draw do not dilute the product’s central moment.
80. As a player, I want to skip the current winner scene, so that long or repeated animations do not trap me.
81. As a player, I want an option to auto-skip opponent scenes, so that I can shorten repeated play while preserving my own wins.
82. As a player, I want to replay one winner’s scene from settlement, so that I can revisit a specific highlight.
83. As a player, I want to replay all winner scenes in their original order, so that 一炮多响 can be reviewed as one sequence.
84. As a motion-sensitive player, I want reduced motion to remove shake, aggressive pushes, and fast turns, so that I can play comfortably.
85. As a motion-sensitive player, I want reduced motion to preserve tile animation, banners, and particles, so that the game retains its identity.
86. As a player, I want reduced motion to default from my operating-system preference, so that accessibility works before I open settings.
87. As a player, I want to override the system motion preference, so that the final behavior is under my control.
88. As a player, I want to switch between 经典绿绒 and 中式宫廷 from the main menu, so that I can choose an appearance before play.
89. As a player, I want to switch theme during a hand without refreshing or interrupting rules, so that appearance changes remain cosmetic.
90. As a player, I want the table and sky to transition within 0.3–0.6 seconds without a black frame, so that switching feels polished.
91. As a player, I want an already-running win scene to retain its starting palette, so that a mid-scene theme change does not create inconsistent colors.
92. As a player, I want my last selected theme remembered, so that the next launch restores my preference.
93. As a player, I want an invalid saved theme to fall back to 经典绿绒, so that startup never gets stuck.
94. As a player, I want one failed theme module to fall back independently, so that a missing sky does not discard the whole theme.
95. As a player, I want an invalid whole theme to fall back completely, so that malformed configuration cannot break the scene.
96. As a player, I want theme failures shown as non-blocking messages, so that I know a fallback happened without losing play.
97. As a player, I want 中式宫廷 to use a red woven table, dark wood, gold trim, palace-sunset gradient, petals, cloud-pattern tile backs, and a gold 福 mark, so that it is visually distinct without external assets.
98. As a player, I want themes to leave tile faces unchanged, so that readability is consistent.
99. As a player, I want themes to leave layout and win-scene timing unchanged, so that cosmetics never change gameplay.
100. As a player, I want banners to use win-derived text and theme-derived color, so that content and styling have clear owners.
101. As a player, I want local synthesized sounds for draw, discard, chow, pung, kong, win, and win scenes, so that the game has feedback without external audio assets.
102. As a player, I want master and sound-effect volume controls remembered, so that audio preferences persist.
103. As a player without Chinese system fonts, I want tile faces, banners, 胡, and 福 to render consistently, so that presentation does not depend on the operating system.
104. As a player, I want a loading screen with real progress until fonts and the default theme are ready, so that startup does not show broken glyphs or blank assets.
105. As a player, I want low, mid, and high quality settings in MVP 1.0, so that the game can match my hardware.
106. As a player, I want the game to select an initial quality from GPU data and measured frame rate, so that first-run performance is reasonable.
107. As a player, I want automatic quality to lower one tier after five seconds below 80% of target, so that sustained slowdown is corrected.
108. As a player, I want automatic quality never to raise itself during the same game, so that visual quality does not oscillate.
109. As a player, I want manual quality selection to disable automatic changes, so that my explicit choice is respected.
110. As a player on unsupported hardware, I want a clear WebGL2 compatibility page, so that failure is understandable.
111. As a player, I want a lost WebGL context restored when possible, so that a temporary graphics reset does not always destroy the game.
112. As a player, I want the first screen to load within the declared budget, so that the game feels responsive on a cold visit.
113. As a player, I want theme switching and repeated scenes not to leak memory, so that long sessions remain stable.
114. As a developer, I want seeded shuffling and AI decisions, so that a failing game can be reproduced.
115. As a developer, I want visual randomness isolated from gameplay randomness, so that particles never change the hand outcome.
116. As a developer, I want every completed action saved as state and logged as an action, so that recovery and replay share a reliable boundary.
117. As a developer, I want snapshots versioned and migrated only by explicit migrators, so that incompatible saves are never silently misread.
118. As a developer, I want the exact failing seed and action log from random simulations, so that a failure is actionable.
119. As a developer, I want built-in configurations schema-validated at build time, so that malformed shipped data cannot reach users.
120. As a developer, I want deterministic clocks, visual seeds, viewport, and DPR in preview tests, so that screenshots are stable.
121. As a developer, I want a dedicated preview mode for arbitrary winning hands and tiers, so that effects can be tuned without playing a full game.
122. As a developer, I want to import and export action logs, so that bug reports can be replayed without external AI calls.
123. As a developer, I want local logs capped to the most recent 20 games, so that IndexedDB does not grow indefinitely.
124. As a privacy-conscious player, I want no analytics or automatic crash upload, so that local play stays local.
125. As a player, I want a clear-data action, so that I can remove saves, logs, settings, and theme preferences.
126. As a desktop player, I want MVP 1.0 to work in current Chrome, Edge, Firefox, and Safari, so that I am not tied to one browser.
127. As a self-hosting player, I want the production build to work below a non-root static path, so that it can be hosted on GitHub Pages or another static server.
128. As an offline player, I want all required game resources local, so that a local static server works without internet.
129. As a maintainer, I want third-party font and library notices retained, so that redistribution respects their licenses.
130. As a maintainer, I want product strings centralized in Simplified Chinese, so that a future language pack does not require searching game logic.

## Implementation Decisions

- The product working name is “AI 爽胡麻将”; the sole MVP rule is 爽胡规则 with identifier `shuanghu-v1`.
- Delivery has two explicit boundaries: M3 is the playable vertical slice; M6 is MVP 1.0.
- The application remains a Three.js web product built with npm, Vite, and TypeScript. It does not migrate to Unity.
- UI uses TypeScript DOM components rather than React, preserving one authoritative game state and avoiding a second framework state tree.
- The existing visual Demo is retained as a read-only reference prototype and excluded from production bundles and coverage.
- The rule core is pure TypeScript and independent of rendering, browser UI, audio, network, and persistence.
- The rule core processes commands and returns a new authoritative state plus domain events. The product does not use full Event Sourcing.
- A serialized state snapshot is the recovery source. The action log is the replay and diagnosis source.
- Gameplay-affecting randomness uses a serializable seeded source shared by shuffle and built-in easy decisions. Visual randomness is isolated.
- Every physical tile has a stable internal identity in addition to its tile code.
- Rule algorithms are implemented through a typed RuleSet with tests. JSON is limited to validated constants and presentation configuration.
- The rule set contains 136 tiles, honors, chow, no flowers, no dice, no robbing an added kong, and no minimum fan.
- The response resolver collects all choices before resolution. All wins succeed; otherwise exposed kong outranks pung, pung outranks chow, and same-priority claims use nearest-seat order.
- `HandWon` is one atomic event containing every winner. It cannot be decomposed into state-ending single-winner events.
- Core win events contain only domain facts and never contain scene tier, banner styling, theme ID, or palette.
- The presentation mapper assigns basic, big, or top from the highest matched pattern, not total fan.
- Win presentation uses a data-driven timeline of lifecycle-managed tracks. Shipped timelines and themes must pass schema validation during build.
- Only wins receive tiered scenes. Melds receive necessary movement feedback but no tier.
- Multiple winner scenes are expanded by the presentation layer in descending tier order and then seat order.
- A scene captures its theme palette when it starts. Theme changes may transition the table and sky without recoloring an active scene.
- Themes own table materials, central mark, color/gradient sky, fog, lights, ambient particles, tile backs, effect palette, post parameters, preview, and optional audio fields.
- Themes do not own tile faces, table layout, camera gameplay layout, timeline rhythm, or banner wording.
- MVP ships exactly two themes: 经典绿绒 and 中式宫廷. MVP supports only solid and gradient sky implementations.
- Theme loading is lazy. Default theme loads at startup; the selected non-default theme loads on demand. Failed modules fall back independently, while invalid whole configuration falls back completely.
- Theme resources use reference counting and delayed disposal, retaining the most recently used prior theme for quick switching.
- The opponent boundary is a DecisionProvider. Built-in easy is always available; an OpenAI-compatible adapter is optional.
- Each opponent can select built-in or external AI, while all external seats share proxy and model configuration.
- External AI receives one seat’s visible state and a complete legal-action list. The returned action must exactly select a legal option, including concrete chow tiles.
- Claim requests to multiple external seats run in parallel under one 20-second deadline.
- Timeout, network error, invalid format, or illegal action falls back to built-in easy for that action.
- The browser never stores provider API keys. A user-owned proxy performs provider authentication.
- Proxy URL and model may persist. Proxy token is session-only and is excluded from storage, logs, and exports.
- External AI requires first-use disclosure and confirmation.
- Settings and theme preference use localStorage. Active snapshots and action logs use IndexedDB.
- The application retains the active save plus the most recent 20 completed game logs.
- Snapshots have a schema version. Incompatible snapshots require an explicit migrator or a visible restart flow; silent reinterpretation is forbidden.
- Replay consumes recorded final actions and never invokes external AI again.
- Player-facing replay is limited to win scenes in MVP. Full action replay is a developer tool.
- MVP audio is synthesized locally. BGM, voice callouts, and sampled sounds are deferred, though theme schemas retain optional audio fields.
- UI uses a subsetted Source Han Sans webfont; tiles, banners, 胡, and 福 use subsetted Source Han Serif. Licenses ship with the fonts.
- The vertical slice may use CPU particles and one desktop quality. MVP 1.0 adds GPU particles with CPU fallback and low/mid/high quality.
- Automatic quality lowers one tier after five sustained seconds below 80% of target, never rises in the same game, and is disabled by manual selection.
- MVP requires WebGL2 and has no WebGL1 renderer.
- The production build is static, deployable below a non-root path, and defaults to GitHub Pages.
- The product does not use a service worker, PWA install, account system, cloud save, analytics SDK, or automatic telemetry.
- Production external AI accepts HTTPS. Local development may accept localhost HTTP.
- Because runtime proxy origins are user-defined on a static host, CSP permits same-origin and HTTPS connections; application logic sends only to the one configured proxy.
- The compressed initial payload, including code, Three.js, default theme, and fonts, must not exceed 3 MB.
- Cold startup under simulated Fast 4G must reach the main menu within three seconds; external AI is excluded.
- Each MVP theme’s on-demand compressed assets must not exceed 1 MB. Future texture/HDR themes may use up to 5 MB.
- Desktop performance acceptance uses a UHD 620-class integrated GPU at 1920×1080 in current Chrome: mid gameplay targets 60 fps and top scenes remain at or above 30 fps.
- The source repository does not receive an arbitrary software license. Third-party components retain their own notices until the owner chooses a project license.

## Testing Decisions

- Tests assert externally observable behavior rather than private helpers, internal data structures, or exact implementation sequencing.
- Three seams are intentional because the product exposes three fundamentally different outputs:
  1. The highest rule seam is the command-driven core: given a state and command, assert the next state and emitted domain events.
  2. The highest playable seam is the browser: drive the UI as a player and assert visible table state, controls, settlement, persistence, theme switching, and AI fallback.
  3. The highest visual seam is the deterministic effect preview: provide a declared event, theme, clock, random seed, viewport, and DPR, then compare selected frames.
- The rule seam covers every pattern with at least one positive and negative case, plus exposed melds, four-identical-as-two-pairs, 平胡 exclusion, stacked patterns, multiple wins, response precedence, final discard, and all kong flows.
- The rule core requires 100% branch coverage. Rendering code has no blanket coverage threshold.
- Seeded self-play runs at least 10,000 hands and checks legal actions, unique physical-tile conservation, no deadlock, and exactly one terminal state.
- A failed self-play case reports its seed and action log.
- DecisionProvider contract tests use a local mock OpenAI-compatible service and cover success, shared-deadline timeout, network failure, malformed output, illegal output, and easy fallback.
- CI never calls a real model provider.
- Persistence tests cover save after every completed action, reload, explicit end-game clearing, schema migration, incompatible schema refusal, log retention, export, and clear-data.
- Theme tests cover build-time schema rejection, per-module fallback, whole-theme fallback, persistence, transition, active-scene palette capture, resource release, and 20 repeated switches.
- Timeline tests assert observable track start/finish/disposal under a controlled clock rather than private scheduler internals.
- Browser flows cover starting, continuing, completing a win, exhaustive draw, player pass, chow-choice selection, every kong type, multiple wins, scene skipping, scene replay, theme switching, reduced motion, and unsupported WebGL2.
- Visual preview tests fix clock, visual random seed, viewport, DPR, theme, and capture time. Differences use a tolerant threshold and publish artifacts for human approval.
- Human review remains authoritative for scene timing, brightness, readability, and impact; baseline updates are explicit.
- Performance tests measure startup payload, Fast 4G startup, frame rates on the reference class, draw calls, and sustained memory across 50 hands, 100 scenes, and 20 theme switches.
- Browser compatibility tests target current desktop Chrome, Edge, Firefox, and Safari for MVP 1.0.
- GitHub Actions runs install, type checking, unit tests, coverage, schema validation, production build, Playwright flows, and visual tests.

## Out of Scope

- Real-money play, chips, payments, gambling mechanics, purchases, advertising, or paid theme unlocks.
- Online multiplayer, accounts, login, cloud saves, leaderboards, anti-cheat, social features, or cross-device synchronization.
- Unity, native mobile applications, Electron, Capacitor, mini-game platforms, PWA installation, or service workers.
- Mobile landscape support, touch controls, safe areas, portrait layout, and mobile audio unlock in MVP 1.0.
- Full Chinese Official, Sichuan, Guangdong, Japanese, or another regional rule set.
- Flowers, robbing an added kong, minimum-fan rules, round winds, seat-wind scoring, dealer bonus, self-draw multiplier, money settlement, or match winner.
- Internal normal and hard opponent difficulty in MVP 1.0.
- Ready-hand hints, discard recommendations, manual hand sorting, action undo, and player-facing full-game replay.
- User-created themes, runtime theme imports, online theme downloads, or commercial theme entitlement.
- A third MVP theme; cubemap, HDR, and shader skies.
- BGM, sampled sound effects, and spoken pattern announcements.
- Theme-controlled tile faces, table layout, or per-theme win-scene timing.
- WebGL1 fallback.
- Automatic analytics, crash upload, game upload, or performance telemetry.
- Localization UI beyond Simplified Chinese, while keeping strings ready for future language packs.
- A final product brand and a repository software license; both remain owner decisions.

## Further Notes

- The canonical product requirement is version 1.0 and has no unresolved proposal markers.
- The domain glossary defines terms such as 一局、一场、实体牌、响应、一炮多响、特效档 and 主题; implementation must use that vocabulary.
- Accepted ADRs cover staying on the web, the fan whitelist, theme boundaries, multiple wins, optional external AI, bundled fonts, authoritative state and events, prototype separation, deterministic randomness, and local-first deployment.
- The repository currently contains domain and product documentation but not the migrated prototype or production application.
- The existing Demo already contains its vendored Three.js module; the obsolete “missing module” warning must not be carried into implementation.
- The work is planned for one developer with no fixed date or budget. Complete and evaluate the playable vertical slice before committing to the remaining MVP milestones.

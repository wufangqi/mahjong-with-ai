# WUF-50 review — 正式工程与效果基线

- **Fixed point**: `main` (`9539bd5`)
- **HEAD**: `0e7c831` on `feature/wuf-50-project-effect-baseline`
- **Diff**: `git diff main...HEAD`
- **Verdict**: `fail`

## Standards

### Documented standards (hard)

**`tsconfig.json` — `strict` / `noUnusedLocals` / `noUnusedParameters`**  
Five production modules open with `// @ts-nocheck - mechanical port from prototype/mahjong-win-demo`: `src/preview/audio.ts`, `court.ts`, `tiles.ts`, `fx.ts`, `scene.ts`. That opts the bulk of app code out of the repo’s TypeScript strictness; `npm run typecheck` cannot enforce those flags there. Stripping the directive surfaces real `TS7006` / `TS7053` errors (e.g. in `tiles.ts`).

**ADR 0010 (`.aidlc/domain/docs/adr/0010-local-first-static-application.md`) — “用户文案集中管理”**  
User-facing Chinese is split across `index.html` (header, controls, mute, error) and `scene.ts` (`showBanner('胡'…)`, `'清一色'`, `'国士无双'`, mute button labels). No shared copy module.

### Compliant (no issue)

- **ADR 0008**: root Vite/TS app, npm `three@0.160.0`, native DOM, no React; `vitest.config.ts` excludes `prototype/**` from tests/coverage; Vite entry is `src/`.
- **ADR 0010**: `vite.config.ts` has `base: './'`.

### Baseline smells (judgement only)

**Divergent Change — `src/preview/scene.ts` (~665 lines)**  
One file owns renderer/camera/lights, table textures, walls/hands, postprocessing, `st`/`ui`, three effect classes, mute, drag, and the RAF loop.

**Mysterious Name**  
`const st = { effect, timeScale, dolly, … }` and `function ac()` (audio context) do not read as domain names.

**Primitive Obsession — `src/preview/fixedHands.ts`**  
`export type TileCode = string;` — branded tile identity is a bare string alias.

**Duplicated Code**  
Canvas→texture helpers: `feltTexture` / `woodTexture` in `scene.ts` vs `canvasTex` in `court.ts`; `sfx.basic` / `big` / `top` share the same `if (muted) return; const b = newBus(); …` shape in `audio.ts`.

**Speculative Generality — `prototypeIsolation.ts`**  
Exports only `READ_ONLY_PROTOTYPE_PATH` (plus a string-equality test); no import guard. Thin for a dedicated module.

## Spec

### (a) Missing / partial

- **Partial — TypeScript formal app.** Spec: M0「建立 Vite + TypeScript 正式应用」; ADR 0008「使用 … TypeScript …」; WUF-50 AC「类型检查…在 CI 中通过」. App is Vite+TS and `npm run typecheck` exits 0, but `src/preview/{scene,tiles,fx,court,audio}.ts` are all `@ts-nocheck`, so the effect surface that *is* the baseline is not actually typechecked.
- **Partial — three-tier reproduction vs CI proof.** Spec: M0「完成标志：正式应用能复现 Demo 的三档场面」; WUF-50「固定输入可播放 basic 场面」. UI wires basic/big/top (`data-fx` + `EFFECTS`) and hands match the Demo; e2e only clicks `play-basic`. Big/top rely on manual check, not CI. (Issue AC only requires basic for the fixed-input clause — note as residual risk, not sole fail reason.)

### (b) Scope creep

- Spec/ADR only require excluding **`prototype/**`** from coverage (ADR 0008「不参与 … 测试覆盖率」). Diff also coverage-excludes `src/preview/scene|tiles|fx|audio|court.ts` in `vitest.config.ts` — not asked.
- Aidlc handoff/README under `.aidlc/issues/wuf-50-project-effect-baseline/` is process docs, not a product requirement (harmless).

### (c) Looks done but wrong / weak

- Spec: WUF-50 / ADR「现有 Demo … 不进入生产构建或覆盖率」. `prototypeIsolation.test.ts` only asserts the string `'prototype/mahjong-win-demo'`; it does **not** prove no runtime import or bundle inclusion. Real isolation holds via entry/`import * as THREE from 'three'` and vitest `exclude: ['prototype/**']`, not via that test.
- No production `src` import of `prototype/`; npm `three@0.160.0`; no React; CI runs typecheck/test/build/e2e; Demo at `prototype/mahjong-win-demo/` with vendored Three — these match ADR 0008 / WUF-50 as inspected.

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | 1 hard (`@ts-nocheck` voids strict TS) + 1 hard-ish (copy not centralized) + several judgement smells | `@ts-nocheck` on all preview modules |
| Spec | Hollow typecheck vs AC; weak isolation test; big/top not in e2e | Typecheck AC satisfied only via `@ts-nocheck` |

**Required for re-review:** remove `@ts-nocheck` from production preview modules (or otherwise make `npm run typecheck` actually check that surface) so the CI typecheck gate is meaningful.

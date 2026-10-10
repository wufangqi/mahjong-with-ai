# WUF-50 review — 正式工程与效果基线

- **Fixed point**: `main` (`9539bd5`)
- **HEAD**: `5db5701` on `feature/wuf-50-project-effect-baseline`
- **Diff**: `git diff main...HEAD`
- **Prior review**: `fail` @ `ea7b7c6`（`@ts-nocheck` 掏空 typecheck）
- **Verdict**: `pass`

## Re-check of prior fail

| 项 | 结果 |
| --- | --- |
| `src/preview/{scene,tiles,fx,court,audio}.ts` 无 `@ts-nocheck` | 通过（全仓 `src/` 无匹配） |
| `tsconfig` `strict` + `npm run typecheck` 真实检查场面代码 | 通过（exit 0；`include: ["src"]`） |
| unit / production build | 通过（本地复验） |

## Standards

**Prior hard fail: fixed.** At `5db5701` `@ts-nocheck` directives are gone; `npm run typecheck` succeeds under `strict` / `noUnusedLocals` / `noUnusedParameters`.

### Documented standards

1. **ADR 0010 — 用户文案集中管理**（残留，非阻断）  
   User-facing zh-CN strings are split: chrome/buttons/errors in `index.html`, runtime banners/mute in `src/preview/scene.ts`. No shared copy module. Acceptable for M0 baseline; follow-up slice.

**ADR 0008 / Vite `base`:** OK — root Vite + TS + npm `three` + native DOM, no React; `base: './'`; prototype excluded from Vitest coverage.

### Baseline smells (judgement only)

| Smell | Note |
| --- | --- |
| **Divergent Change** | `scene.ts` mixes win effects, HUD wiring, camera, mute, rAF loop. |
| **Primitive Obsession** | `TileCode = string` in `fixedHands.ts`. |
| **Mysterious Name** | Module-level `st`, `ac()`, dense short locals in preview ports. |
| **Speculative Generality** | `prototypeIsolation.ts` is only a path constant + test. |

## Spec

**Prior Spec fail — resolved.** Zero `@ts-nocheck`; CI typecheck covers the effect surface.

### (a) Missing / partial

- **Partial — M0 three-tier vs CI proof**（残留风险，非 WUF-50 AC 缺口）  
  Spec: M0「完成标志：正式应用能复现 Demo 的三档场面」; WUF-50「固定输入可播放 basic 场面」. UI wires basic/big/top; e2e only clicks `play-basic`.
- **No other WUF-50 AC holes:** Vite+TS app, operable preview, Demo under `prototype/mahjong-win-demo/`, CI typecheck/test/build/e2e.

### (b) Scope creep

- `vitest.config.ts` also coverage-excludes `src/preview/scene|tiles|fx|audio|court.ts` beyond ADR’s `prototype/**` — not asked; non-blocking for this ticket.

### (c) Looks done but weak

- `prototypeIsolation.test.ts` only asserts the path string; real isolation is Vite entry + npm `three` + vitest exclude. Structure still matches ADR 0008.

## Summary

| Axis | Findings | Worst |
| --- | --- | --- |
| Standards | Prior hard fail cleared; ADR 0010 copy + judgement smells remain | Copy not centralized (non-blocking) |
| Spec | Prior hollow-typecheck fail cleared; residual big/top not in e2e | M0 three-tier only smoke-tested for basic |

**单票 integration**：代码已在 `mt_integrate_branch`；本轮 `pass` 无需再 merge。不合 `main`。

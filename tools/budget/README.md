# Budget measurement (WUF-65)

Repeatable checks for MVP loading / performance / resource budgets.

## Transfer sizes (CI-friendly)

```bash
npm run build
npm run budget:measure
```

Writes `.aidlc/issues/wuf-49-ai-shuanghu-mvp/dev/wuf-65/budget-report.json`.

## Browser metrics

```bash
npx playwright install chromium
npm run test:e2e -- e2e/budget.spec.ts
```

Covers cold-start menu timing + loading bar, static-scene draw calls, mid FPS sample, theme-switch / scene soak growth check.

# Visual regression harness

Deterministic preview URL:

```text
preview.html?visual=1&tier=basic|big|top&seed=1&width=1280&height=720&dpr=1&theme=classic-green&captureAt=1200
```

Playwright compares canvases against committed baselines under `e2e/visual.spec.ts-snapshots/`.

## Update baselines (human gate)

1. Review the local capture or CI artifact diffs.
2. Confirm intentionally:
   ```bash
   UPDATE_VISUAL_BASELINES=1 npm run test:visual:update
   ```
3. Commit the updated snapshots.

Without `UPDATE_VISUAL_BASELINES=1`, `test:visual:update` refuses to run.

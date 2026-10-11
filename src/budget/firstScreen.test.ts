import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { measureFirstScreenTransfer, measureThemeOnDemandChunk } from './firstScreen';
import {
  FIRST_SCREEN_TRANSFER_BUDGET_BYTES,
  THEME_ON_DEMAND_BUDGET_BYTES,
} from './limits';

const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist');

describe('first-screen transfer budget', () => {
  it('keeps index entry graph + fonts under 3 MiB compressed transfer', () => {
    expect(existsSync(distDir)).toBe(true);
    const report = measureFirstScreenTransfer(distDir);
    expect(report.budgetBytes).toBe(FIRST_SCREEN_TRANSFER_BUDGET_BYTES);
    expect(report.totalBytes).toBeGreaterThan(100_000);
    expect(report.withinBudget).toBe(true);
    expect(report.totalBytes).toBeLessThanOrEqual(FIRST_SCREEN_TRANSFER_BUDGET_BYTES);
    // Default theme + Three.js live in the static graph; second theme stays out.
    expect(report.entries.some((e) => e.path.includes('courtPalace'))).toBe(false);
  });

  it('keeps court-palace on-demand chunk under 1 MiB', () => {
    const report = measureThemeOnDemandChunk(distDir);
    expect(report.budgetBytes).toBe(THEME_ON_DEMAND_BUDGET_BYTES);
    expect(report.withinBudget).toBe(true);
    expect(report.totalBytes).toBeLessThanOrEqual(THEME_ON_DEMAND_BUDGET_BYTES);
  });
});

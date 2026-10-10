import { describe, expect, it } from 'vitest';
import { listThemeOptions, loadTheme } from './catalog';
import { classicGreenTheme } from './themes/classicGreen';

describe('theme catalog — lazy non-default load', () => {
  it('lists both MVP themes without requiring court module at call time', () => {
    const opts = listThemeOptions();
    expect(opts.map((o) => o.id)).toEqual(['classic-green', 'court-palace']);
    expect(opts[0]?.displayName).toBe(classicGreenTheme.displayName);
  });

  it('loads classic-green synchronously from the eager default module', async () => {
    const theme = await loadTheme('classic-green');
    expect(theme.id).toBe('classic-green');
    expect(theme).toBe(classicGreenTheme);
  });

  it('loads court-palace on demand and exposes cloud tile backs + petals', async () => {
    const theme = await loadTheme('court-palace');
    expect(theme.id).toBe('court-palace');
    expect(theme.modules.tileBack.pattern).toBe('cloud');
    expect(theme.modules.ambientParticles.kind).toBe('petals');
  });
});

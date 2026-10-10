import { describe, expect, it } from 'vitest';
import { preparePreviewTheme, getPreviewThemeId, getPreviewThemeModules } from './themeBridge';

describe('preparePreviewTheme', () => {
  it('loads classic-green and court-palace through ThemeManager with distinct felt/mark', async () => {
    await preparePreviewTheme('classic-green');
    expect(getPreviewThemeId()).toBe('classic-green');
    const green = getPreviewThemeModules();
    expect(green.mark.glyph).toBe('雀');
    expect(green.table.felt).toBe(0x0d5a3c);

    await preparePreviewTheme('court-palace');
    expect(getPreviewThemeId()).toBe('court-palace');
    const court = getPreviewThemeModules();
    expect(court.mark.glyph).toBe('福');
    expect(court.table.felt).toBe(0x8b1e2d);
    expect(court.tileBack.pattern).toBe('cloud');
    expect(court.table.felt).not.toBe(green.table.felt);
  });
});

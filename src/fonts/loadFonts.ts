import { FONT_SANS_FAMILY, FONT_SERIF_FAMILY } from './families';

let fontsReady: Promise<void> | null = null;
let loaded = false;

export function areFontsReady(): boolean {
  return loaded;
}

/**
 * Load bundled WOFF2 subsets. Tile Canvas faces must wait for this
 * so glyphs never fall back to system CJK fonts.
 */
export function loadGameFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      if (typeof document === 'undefined' || !document.fonts) {
        loaded = true;
        return;
      }
      await Promise.all([
        document.fonts.load(`400 16px "${FONT_SANS_FAMILY}"`),
        document.fonts.load(`900 16px "${FONT_SERIF_FAMILY}"`),
        document.fonts.load(`900 108px "${FONT_SERIF_FAMILY}"`),
      ]);
      await document.fonts.ready;
      const sansOk = document.fonts.check(`16px "${FONT_SANS_FAMILY}"`);
      const serifOk = document.fonts.check(`900 16px "${FONT_SERIF_FAMILY}"`);
      if (!sansOk || !serifOk) {
        throw new Error('bundled Source Han subsets failed to load');
      }
      loaded = true;
    })();
  }
  return fontsReady;
}

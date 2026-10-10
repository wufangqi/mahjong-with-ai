import '../fonts/fonts.css';
import '../styles.css';
import { loadGameFonts } from '../fonts/loadFonts';
import { prepareVisualMode } from '../visual/prepare';
import { preparePreviewTheme } from './themeBridge';

async function main(): Promise<void> {
  const visual = prepareVisualMode();
  try {
    await loadGameFonts();
    await preparePreviewTheme(visual.theme);
  } catch (err) {
    console.error(err);
    document.body.classList.add('failed');
    return;
  }
  // Scene draws themed felt/tiles at import — fonts + ThemeManager must already be ready.
  await import('./scene');
}

void main();

window.setTimeout(() => {
  if (!document.body.classList.contains('ready')) {
    document.body.classList.add('failed');
  }
}, 8000);

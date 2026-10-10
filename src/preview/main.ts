import '../fonts/fonts.css';
import '../styles.css';
import { loadGameFonts } from '../fonts/loadFonts';
import { prepareVisualMode } from '../visual/prepare';

async function main(): Promise<void> {
  prepareVisualMode();
  try {
    await loadGameFonts();
  } catch (err) {
    console.error(err);
    document.body.classList.add('failed');
    return;
  }
  // Scene module draws tile faces at import time — fonts must already be ready.
  await import('./scene');
}

void main();

window.setTimeout(() => {
  if (!document.body.classList.contains('ready')) {
    document.body.classList.add('failed');
  }
}, 8000);

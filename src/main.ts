import './fonts/fonts.css';
import './styles.css';
import { loadGameFonts } from './fonts/loadFonts';
import { bootPlayApp } from './play/app';

async function main(): Promise<void> {
  try {
    await loadGameFonts();
  } catch (err) {
    console.error(err);
    document.body.classList.add('failed');
    return;
  }
  bootPlayApp();
}

void main();

window.setTimeout(() => {
  if (!document.body.classList.contains('ready')) {
    document.body.classList.add('failed');
  }
}, 8000);

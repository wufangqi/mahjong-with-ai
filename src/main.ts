import './fonts/fonts.css';
import './styles.css';
import { LoadProgressTracker, type LoadStageId } from './budget/loadProgress';
import { isWebGL2Available, showWebGL2UnsupportedPage } from './compat/webgl2';
import { loadGameFonts } from './fonts/loadFonts';
import { bootPlayApp } from './play/app';

function paintLoadProgress(tracker: LoadProgressTracker): void {
  const snap = tracker.snapshot();
  const root = document.getElementById('boot-loading');
  const label = document.getElementById('boot-loading-label');
  const bar = document.getElementById('boot-loading-bar');
  if (label) label.textContent = snap.label;
  if (bar) bar.style.width = `${Math.round(snap.fraction * 100)}%`;
  if (root) {
    root.setAttribute('aria-valuenow', String(Math.round(snap.fraction * 100)));
    if (snap.done) {
      root.hidden = true;
      document.body.classList.remove('loading');
    }
  }
}

async function main(): Promise<void> {
  const tracker = new LoadProgressTracker();
  paintLoadProgress(tracker);

  const onStage = (stage: LoadStageId): void => {
    tracker.complete(stage);
    paintLoadProgress(tracker);
  };

  if (!isWebGL2Available()) {
    showWebGL2UnsupportedPage();
    return;
  }

  try {
    await loadGameFonts();
    onStage('fonts');
  } catch (err) {
    console.error(err);
    document.body.classList.add('failed');
    return;
  }

  await bootPlayApp({ onStage });
}

void main();

window.setTimeout(() => {
  if (!document.body.classList.contains('ready')) {
    document.body.classList.add('failed');
  }
}, 8000);

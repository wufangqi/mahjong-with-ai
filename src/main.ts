import './styles.css';
import './preview/scene';

declare global {
  interface Window {
    __app?: {
      play: (name: string) => void;
      ready: boolean;
      st: unknown;
    };
  }
}

window.setTimeout(() => {
  if (!document.body.classList.contains('ready')) {
    document.body.classList.add('failed');
  }
}, 4000);

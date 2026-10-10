import './styles.css';
import { bootPlayApp } from './play/app';

bootPlayApp();

window.setTimeout(() => {
  if (!document.body.classList.contains('ready')) {
    document.body.classList.add('failed');
  }
}, 4000);

import '../styles.css';
import './scene';

window.setTimeout(() => {
  if (!document.body.classList.contains('ready')) {
    document.body.classList.add('failed');
  }
}, 4000);

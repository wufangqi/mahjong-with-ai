import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { cspMetaTag } from './src/compat/csp';

export default defineConfig(({ command }) => ({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        preview: resolve(__dirname, 'preview.html'),
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  plugins: [
    {
      name: 'inject-csp-meta',
      transformIndexHtml(html) {
        // Dev/HMR needs looser script policy; inject CSP only into production HTML.
        if (command !== 'build') return html;
        if (html.includes('Content-Security-Policy')) return html;
        return html.replace('<head>', `<head>\n${cspMetaTag()}`);
      },
    },
  ],
}));

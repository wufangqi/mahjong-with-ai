#!/usr/bin/env node
/**
 * Serve ./dist under a non-root prefix (GitHub Pages project-site shape).
 * Usage: node tools/serve-subpath.mjs [port] [prefix]
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.argv[2] ?? 4174);
const prefix = (process.argv[3] ?? '/mahjong-with-ai').replace(/\/$/, '') || '';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (prefix && !pathname.startsWith(prefix)) {
    res.writeHead(404).end('not under prefix');
    return;
  }
  let rel = prefix ? pathname.slice(prefix.length) : pathname;
  if (!rel || rel === '/') rel = '/index.html';
  const filePath = normalize(join(root, rel));
  if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404).end('missing');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`subpath static: http://127.0.0.1:${port}${prefix}/`);
});

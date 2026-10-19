import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
export const LEGACY_TAG = 'legacy-phaser2-final';
const cache = path.join(repo, '.legacy-cache');

export function ensureLegacy() {
  if (!fs.existsSync(path.join(cache, 'js', 'game.js'))) {
    fs.mkdirSync(cache, { recursive: true });
    const tar = execFileSync('git', ['archive', LEGACY_TAG], { cwd: repo, maxBuffer: 1 << 30 });
    execFileSync('tar', ['-x', '-C', cache], { input: tar });
  }
  return cache;
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav', '.css': 'text/css', '.fnt': 'text/plain' };

export function startServer(port = 0) {
  const root = ensureLegacy();
  const prefix = '/games/noeyeswilly/';
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file;
    if (url === '/baseline.html' || url === '/harness.js') file = path.join(here, url.slice(1));
    else if (url.startsWith(prefix)) file = path.join(root, url.slice(prefix.length));
    else { res.writeHead(404); res.end('not found'); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await startServer(Number(process.env.PORT) || 8099);
  console.log(`legacy baseline on http://127.0.0.1:${port}/baseline.html`);
}

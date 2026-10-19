import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { openGame, snap, watchProblems } from './helpers';

const dist = path.resolve(import.meta.dirname, '../dist');
const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wav': 'audio/wav', '.woff': 'font/woff', '.json': 'application/json' };

function serveUnder(prefix: string): Promise<{ url: string; close(): void; seen: string[] }> {
  const seen: string[] = [];
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://x');
      seen.push(url.pathname);
      if (!url.pathname.startsWith(prefix)) {
        res.writeHead(404).end('outside base');
        return;
      }
      let rel = url.pathname.slice(prefix.length) || 'index.html';
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.join(dist, rel);
      if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }).end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => server.close(), seen }));
  });
}

test('the production build runs from a nested sub-path with every asset derived from the app base', async ({ page, browserName }) => {
  const server = await serveUnder('/arcade/games/willy/');
  try {
    const problems = watchProblems(page);
    await page.goto(`${server.url}/arcade/games/willy/?test=1`);
    await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'title', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(async () => (await snap(page)).tick).toBeGreaterThan(5);
    expect(problems.errors).toEqual([]);
    expect(problems.failedRequests).toEqual([]);
    expect(server.seen.every((p) => p.startsWith('/arcade/games/willy/'))).toBe(true);
    // The Linux WebKit build used here has no WAV decoder, so it never requests the sounds.
    const expected = ['tiles/tiles.png', 'sprites/willy.png', ...(browserName === 'webkit' ? [] : ['sounds/splash.wav'])];
    for (const asset of expected) {
      expect(server.seen.some((p) => p.endsWith(asset)), asset).toBe(true);
    }
  } finally {
    server.close();
  }
});

test('missing assets show a clear error and disable the game instead of hanging', async ({ page }) => {
  await page.route('**/assets/sprites/willy.png', (route) => route.fulfill({ status: 404, body: 'gone' }));
  await page.goto('/?test=1');
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'error', { timeout: 30_000 });
  await expect(page.getByRole('alert')).toContainText('Could not load the game');
  await expect(page.getByRole('alert')).toContainText('willy');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Level Select', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reload', exact: true })).toBeVisible();
});

test('the shipped output contains no legacy engine, duplicate level scripts or archive', async () => {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(path.relative(dist, p));
    }
  };
  walk(dist);
  expect(files.length).toBeGreaterThan(10);
  const banned = [/phaser(\.min)?\.js$/, /pixi/i, /modernizr/i, /config\.php$/, /levels\.js$/, /tilemaps\//, /legacy/i, /\.map$/];
  for (const f of files) {
    if (/^assets\/index-[\w-]+\.js$/.test(f)) continue;
    for (const re of banned) expect(re.test(f), `${f} matches ${re}`).toBe(false);
  }
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  expect(html).not.toMatch(/phaser\.min\.js|js\/boot\.js|js\/levels\.js|\/games\/noeyeswilly/);
  const bundle = files.filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(dist, f), 'utf8')).join('\n');
  expect(bundle).not.toContain('Phaser v2');
  expect(bundle).not.toContain('/games/noeyeswilly');
  expect(bundle).not.toContain('Level_0_7' + '.js');
});

test('opening with a hash, query or trailing path does not break start-up', async ({ page }) => {
  await openGame(page, '?test=1&x=1#level-3');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => (await snap(page)).phase).toBe('playing');
});

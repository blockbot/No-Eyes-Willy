// Captures documentation screenshots (and optional demo videos) from the production build.
// usage: node tools/visual/screenshots.mjs <outDir>      (needs `npm run build` first)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, devices, webkit } from 'playwright-core';

const outDir = process.argv[2] ?? 'test-results/screenshots';
fs.mkdirSync(outDir, { recursive: true });
const dist = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wav': 'audio/wav', '.woff': 'font/woff' };
const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  const file = path.join(dist, p === '/' ? 'index.html' : p);
  if (!file.startsWith(dist) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/?test=1`;
const routes = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => JSON.parse(fs.readFileSync(`routes/level-${n}.json`, 'utf8')));
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'];
const chromeExe = fs.existsSync('/usr/local/bin/google-chrome') ? '/usr/local/bin/google-chrome' : undefined;

const setup = async (ctxOpts, browserType, launch) => {
  const browser = await browserType.launch(launch);
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForFunction(() => window.__nsw && window.__nsw.snapshot().phase === 'title');
  return { browser, ctx, page };
};
const snap = (page) => page.evaluate(() => __nsw.snapshot());
const tap = async (page, touch, x, y) => {
  const c = await page.evaluate(([a, b]) => __nsw.viewToClient(a, b), [x, y]);
  if (touch) await page.touchscreen.tap(c.x, c.y);
  else await page.mouse.click(c.x, c.y);
};
async function play(page, touch, level, untilTick, paced = false) {
  await page.evaluate((i) => { __nsw.setManual(true); __nsw.begin(i); }, level);
  const by = new Map();
  for (const a of routes[level].actions) by.set(a.tick, [...(by.get(a.tick) ?? []), a]);
  for (let t = 0; t < untilTick; t++) {
    for (const a of by.get(t) ?? []) {
      const s = await snap(page);
      await tap(page, touch, a.worldX - s.cameraX, a.worldY - s.cameraY);
    }
    await page.evaluate(() => __nsw.step(1));
    if (paced) await page.waitForTimeout(12);
  }
  await page.waitForTimeout(250);
}

for (const [label, ctxOpts, type, launch, touch] of [
  ['desktop-chrome', { viewport: { width: 1280, height: 800 } }, chromium, { executablePath: chromeExe, args }, false],
  ['phone-pixel7-chrome', { ...devices['Pixel 7'] }, chromium, { executablePath: chromeExe, args }, true],
  ['phone-iphone14-webkit-emulated', { ...devices['iPhone 14'] }, webkit, {}, true],
]) {
  const { browser, page } = await setup(ctxOpts, type, launch);
  const shot = (name) => page.screenshot({ path: path.join(outDir, `${label}-${name}.png`) });
  await shot('1-title');
  await play(page, touch, 0, 300);
  await shot('2-level1-playing');
  await play(page, touch, 1, 800);
  await shot('3-level2-scrolled-camera');
  await page.evaluate(() => { __nsw.begin(0); __nsw.setManual(true); __nsw.step(560); });
  await page.waitForTimeout(250);
  await shot('4-death-retry');
  await play(page, touch, 0, routes[0].winTick + 120);
  await shot('5-level1-won');
  await page.evaluate(() => { __nsw.begin(3); __nsw.step(120); });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await shot('6-paused');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Level Select', exact: true }).click();
  await page.waitForTimeout(200);
  await shot('7-level-select');
  await page.keyboard.press('Escape');
  await play(page, touch, 7, routes[7].winTick + 120);
  await shot('8-final-level-won-play-again');
  await browser.close();
}

// Demo videos: real pointer events, ticks paced at roughly real time.
for (const level of [0, 6]) {
  const browser = await chromium.launch({ executablePath: chromeExe, args });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: path.join(outDir, 'video-tmp'), size: { width: 1280, height: 800 } } });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForFunction(() => window.__nsw && window.__nsw.snapshot().phase === 'title');
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await play(page, false, level, routes[level].winTick + 150, true);
  await page.waitForTimeout(600);
  const video = page.video();
  await ctx.close();
  await browser.close();
  fs.renameSync(await video.path(), path.join(outDir, `demo-level${level + 1}-route-real-pointer-events.webm`));
}
fs.rmSync(path.join(outDir, 'video-tmp'), { recursive: true, force: true });
server.close();

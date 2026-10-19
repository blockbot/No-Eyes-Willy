// Side-by-side visual comparison of the original Phaser 2 build (from the archive tag) and the new production build.
// usage: node tools/visual/compare.mjs <outDir>      (needs `npm run build` first; serves dist/ itself)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { startServer } from '../legacy-baseline/serve.mjs';

const outDir = process.argv[2] ?? 'test-results/visual';
fs.mkdirSync(outDir, { recursive: true });
const dist = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wav': 'audio/wav', '.woff': 'font/woff' };
const newServer = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  const file = path.join(dist, p === '/' ? 'index.html' : p);
  if (!file.startsWith(dist) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise((r) => newServer.listen(0, '127.0.0.1', r));
const newPort = newServer.address().port;
const { server: legacyServer, port: legacyPort } = await startServer(0);

const args = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];
const exe = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args });

const routes = Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((n) => [n, JSON.parse(fs.readFileSync(`routes/level-${n}.json`, 'utf8'))]));
const shots = [
  { name: 'L1-start-t4', level: 0, ticks: 4, passive: true },
  { name: 'L1-start-t12', level: 0, ticks: 12, passive: true },
  { name: 'L1-walking-t40', level: 0, ticks: 40, passive: true },
  { name: 'L1-walking-t300', level: 0, ticks: 300 },
  { name: 'L3-mid-route-t500', level: 2, ticks: 500 },
  { name: 'L4-scrolled-t700', level: 3, ticks: 700 },
  { name: 'L6-won-dance', level: 5, ticks: routes[5].winTick + 90 },
  { name: 'L8-won-final', level: 7, ticks: routes[7].winTick + 90 },
  { name: 'L1-dead-passive', level: 0, ticks: 600, passive: true },
];

async function legacyShot(s) {
  const page = await browser.newPage({ viewport: { width: 700, height: 600 } });
  await page.goto(`http://127.0.0.1:${legacyPort}/baseline.html`);
  await page.evaluate(() => H.waitBoot());
  const actions = s.passive ? [] : routes[s.level].actions.map((a) => ({ t: a.tick, type: 'world', wx: a.worldX, wy: a.worldY }));
  await page.evaluate((sc) => H.run(sc).then(() => undefined), { level: s.level, ticks: s.ticks, actions });
  await page.waitForTimeout(150);
  const buf = await page.locator('canvas').first().screenshot();
  await page.close();
  return buf;
}

async function newShot(s) {
  const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
  await page.goto(`http://127.0.0.1:${newPort}/?test=1`);
  await page.waitForFunction(() => window.__nsw && window.__nsw.snapshot().phase === 'title');
  await page.addStyleTag({ content: '.frame{position:fixed !important;left:0 !important;top:0 !important;margin:0 !important;width:512px !important;min-width:0 !important;height:480px !important;aspect-ratio:auto !important}.stage{height:448px !important}:focus{outline:none !important}' });
  await page.evaluate((i) => { __nsw.setManual(true); __nsw.begin(i); }, s.level);
  const byTick = new Map();
  if (!s.passive) for (const a of routes[s.level].actions) byTick.set(a.tick, [...(byTick.get(a.tick) ?? []), a]);
  let now = 0;
  for (const t of [...byTick.keys()].sort((a, b) => a - b)) {
    if (t >= s.ticks) break;
    if (t > now) { await page.evaluate((n) => __nsw.step(n), t - now); now = t; }
    for (const a of byTick.get(t)) {
      const cam = await page.evaluate(() => { const x = __nsw.snapshot(); return [x.cameraX, x.cameraY]; });
      const c = await page.evaluate(([x, y]) => __nsw.viewToClient(x, y), [a.worldX - cam[0], a.worldY - cam[1]]);
      await page.mouse.click(c.x, c.y);
    }
  }
  await page.evaluate((n) => __nsw.step(n), s.ticks - now);
  await page.waitForTimeout(250);
  const buf = await page.screenshot({ clip: { x: 32, y: 0, width: 448, height: 448 } });
  await page.close();
  return buf;
}

const cmp = await browser.newPage();
await cmp.setContent('<canvas id=c></canvas>');
const report = [];
for (const s of shots) {
  const a = await legacyShot(s);
  const b = await newShot(s);
  fs.writeFileSync(path.join(outDir, `${s.name}-original.png`), a);
  fs.writeFileSync(path.join(outDir, `${s.name}-new.png`), b);
  const res = await cmp.evaluate(async ([ab, bb]) => {
    const load = (b64) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64; });
    const [ia, ib] = await Promise.all([load(ab), load(bb)]);
    const w = 448, h = 448;
    const ctx = document.getElementById('c').getContext('2d', { willReadFrequently: true });
    document.getElementById('c').width = w * 3; document.getElementById('c').height = h;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ia, 0, 0, w, h); ctx.drawImage(ib, w, 0, w, h);
    const A = ctx.getImageData(0, 0, w, h), B = ctx.getImageData(w, 0, w, h), D = ctx.createImageData(w, h);
    let diff = 0, maxd = 0;
    for (let i = 0; i < A.data.length; i += 4) {
      const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
      if (d > 24) { diff++; D.data[i] = 255; D.data[i + 1] = 0; D.data[i + 2] = 80; D.data[i + 3] = 255; } else { D.data[i] = A.data[i] >> 1; D.data[i + 1] = A.data[i + 1] >> 1; D.data[i + 2] = A.data[i + 2] >> 1; D.data[i + 3] = 255; }
      maxd = Math.max(maxd, d);
    }
    ctx.putImageData(D, w * 2, 0);
    return { sizes: [ia.width, ia.height, ib.width, ib.height], pct: (100 * diff) / (w * h), maxd, sheet: document.getElementById('c').toDataURL('image/png').split(',')[1] };
  }, [a.toString('base64'), b.toString('base64')]);
  fs.writeFileSync(path.join(outDir, `${s.name}-sidebyside-diff.png`), Buffer.from(res.sheet, 'base64'));
  report.push({ shot: s.name, ticks: s.ticks, sizes: res.sizes.join('x'), differingPixelsPct: Number(res.pct.toFixed(2)) });
  console.log(s.name, JSON.stringify({ sizes: res.sizes, pct: res.pct.toFixed(2), maxChannelDiff: res.maxd }));
}
fs.writeFileSync(path.join(outDir, 'visual-report.json'), JSON.stringify(report, null, 1));
await browser.close();
newServer.close();
legacyServer.close();

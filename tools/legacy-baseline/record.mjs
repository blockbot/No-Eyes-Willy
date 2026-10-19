// Runs scenarios against the untouched legacy game (Phaser 2.0.3) in Chrome and writes gzip JSON traces.
// usage: node tools/legacy-baseline/record.mjs <scenarios.json> <outDir> [nameFilter]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from 'playwright-core';
import { startServer } from './serve.mjs';

const [, , scFile, outDir, filter] = process.argv;
const scenarios = JSON.parse(fs.readFileSync(scFile, 'utf8')).filter((s) => !filter || new RegExp(filter).test(s.name));
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await startServer(0);
const exe = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const meta = { chrome: browser.version() };
const r6 = (n) => Math.round(n * 1e6) / 1e6;

for (const sc of scenarios) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/baseline.html`);
  await page.evaluate(() => H.waitBoot());
  const res = await page.evaluate((s) => H.run(s), sc);
  const compact = {
    name: sc.name, level: sc.level, ticks: sc.ticks, meta,
    world: res.world, clicks: res.clicks, skippedUiClicks: res.skipped, pageErrors: errors,
    cols: ['sx', 'sy', 'vx', 'vy', 'blk', 'sc', 'alive', 'exists', 'camx', 'camy', 'vX', 'walking', 'win', 'isC', 'wasC', 'lc', 'px', 'end', 'edits'],
    rows: res.trace.map((s) => [s.sx, s.sy, r6(s.vx), r6(s.vy), s.blk, s.sc, s.alive, s.exists, s.cam[0], s.cam[1], s.S.vX, s.S.walking, s.S.win, s.S.isC, s.S.wasC, s.S.lc, r6(s.S.px), s.S.end, s.edits]),
  };
  fs.writeFileSync(path.join(outDir, sc.name + '.json.gz'), zlib.gzipSync(JSON.stringify(compact)));
  const last = res.trace[res.trace.length - 1];
  console.log(sc.name, 'clicks', res.clicks.length, 'final', JSON.stringify({ x: r6(last.sx), y: r6(last.sy), alive: last.alive, win: last.S.win, end: last.S.end }), errors.length ? 'ERRORS ' + errors.join('|') : '');
  await page.close();
}
await browser.close();
server.close();

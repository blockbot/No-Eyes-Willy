import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { begin, manual, openGame, snap, step, tapView, viewToClient, watchProblems } from './helpers';

const startGame = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'playing');
};

const level = (n: number): { width: number; layers: Array<{ data?: number[] }> } =>
  JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, `../src/levels/maps/${n === 0 ? 'test' : `level0_${n}`}.json`), 'utf8'));

test('boots to the title screen with no errors, from the production build', async ({ page }) => {
  const problems = watchProblems(page);
  await openGame(page);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.locator('#level-indicator')).toHaveText('Press Play to begin');
  expect(await page.evaluate(() => document.querySelectorAll('canvas').length)).toBe(1);
  expect(problems.errors).toEqual([]);
  expect(problems.failedRequests).toEqual([]);
});

test('Play and Start begin level 1; time runs at 60 ticks per second', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('#level-indicator')).toHaveText('Level 1 of 8');
  const a = await snap(page);
  await page.waitForTimeout(2000);
  const b = await snap(page);
  const rate = (b.tick - a.tick) / 2;
  expect(rate).toBeGreaterThan(45);
  expect(rate).toBeLessThan(70);
  expect(b.spriteX).not.toBe(a.spriteX);
});

test('controls have accessible names, are keyboard operable and show a visible focus style', async ({ page, browserName }) => {
  await openGame(page);
  for (const name of ['Start', 'Pause', 'Restart', 'Level Select', 'Mute']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Start', exact: true }).focus();
  const outline = await page.getByRole('button', { name: 'Start', exact: true }).evaluate((el) => getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth);
  if (browserName !== 'webkit') expect(outline).toMatch(/solid 4px|auto/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'playing');
  await page.getByRole('button', { name: 'Pause', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();
});

test('Pause freezes time and ignores taps; Resume continues; Restart resets', async ({ page }, testInfo) => {
  await openGame(page);
  await startGame(page);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const a = await snap(page);
  await page.waitForTimeout(500);
  const b = await snap(page);
  expect(b.tick).toBe(a.tick);
  expect(b.spriteX).toBe(a.spriteX);
  const c = await viewToClient(page, 224, 224);
  await page.mouse.click(c.x, c.y).catch(() => undefined);
  expect((await snap(page)).edits).toEqual(b.edits);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.waitForTimeout(300);
  expect((await snap(page)).tick).toBeGreaterThan(b.tick);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  const r = await snap(page);
  expect(r.tick).toBeLessThan(10);
  expect(r.attempt).toBeGreaterThan(b.attempt);
  void testInfo;
});

test('Level Select: modal, keyboard-closable, resumes where it paused, and starts the chosen stage', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await page.getByRole('button', { name: 'Level Select', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Level Select' })).toBeVisible();
  expect((await snap(page)).phase).toBe('paused');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'playing');
  await expect(page.getByRole('button', { name: 'Level Select', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Level Select', exact: true }).click();
  await page.getByRole('button', { name: 'Level 5', exact: true }).click();
  await expect(page.locator('#level-indicator')).toHaveText('Level 5 of 8');
  expect((await snap(page)).levelIndex).toBe(4);
});

test('Mute toggles, is remembered across reloads, and is the only thing stored', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unmute', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'title', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Unmute', exact: true })).toBeVisible();
  const stored = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  expect(stored).toEqual({ 'noeyeswilly:muted': '1' });
  await page.getByRole('button', { name: 'Unmute', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mute', exact: true })).toBeVisible();
});

test('progress is never saved: reloading always starts from the title', async ({ page }) => {
  await openGame(page);
  await begin(page, 3);
  await page.reload();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'title', { timeout: 30_000 });
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('tapping Willy reverses him exactly once per tap', async ({ page }, testInfo) => {
  await openGame(page);
  await startGame(page);
  await manual(page);
  await step(page, 40);
  const a = await snap(page);
  expect(a.vx).toBe(-100);
  await tapView(page, testInfo, a.spriteX - a.cameraX, a.spriteY - a.cameraY);
  await step(page, 1);
  const b = await snap(page);
  expect(b.vx).toBe(100);
  await tapView(page, testInfo, b.spriteX - b.cameraX, b.spriteY - b.cameraY);
  await step(page, 1);
  expect((await snap(page)).vx).toBe(-100);
});

test('tapping a gap fills it once, and the exact tile under the pointer is the one that changes', async ({ page }, testInfo) => {
  await openGame(page);
  await begin(page, 0);
  await manual(page);
  await step(page, 20);
  const s = await snap(page);
  const map = level(0);
  const gaps: Array<[number, number]> = [];
  map.layers[0]!.data!.forEach((g, i) => g === 19 && gaps.push([i % map.width, Math.floor(i / map.width)]));
  const [tx, ty] = gaps.find(([x, y]) => x * 32 + 16 - s.cameraX >= 0 && x * 32 + 16 - s.cameraX < 448 && y * 32 + 16 - s.cameraY >= 0 && y * 32 + 16 - s.cameraY < 448)!;
  await tapView(page, testInfo, tx * 32 + 16 - s.cameraX, ty * 32 + 16 - s.cameraY);
  expect((await snap(page)).edits).toEqual([[tx, ty]]);
  await tapView(page, testInfo, tx * 32 + 16 - s.cameraX, ty * 32 + 16 - s.cameraY);
  expect((await snap(page)).edits).toEqual([[tx, ty]]);
  await tapView(page, testInfo, 2, 2);
  expect((await snap(page)).edits).toEqual([[tx, ty]]);
});

test('taps map correctly after the camera has scrolled (and on any canvas size)', async ({ page }, testInfo) => {
  await openGame(page);
  await begin(page, 1);
  await manual(page);
  await step(page, 700);
  const s = await snap(page);
  expect(s.cameraX + s.cameraY).toBeGreaterThan(0);
  const map = level(1);
  const visible: Array<[number, number]> = [];
  map.layers[0]!.data!.forEach((g, i) => {
    if (g !== 19) return;
    const x = i % map.width;
    const y = Math.floor(i / map.width);
    const vx = x * 32 + 16 - s.cameraX;
    const vy = y * 32 + 16 - s.cameraY;
    if (vx >= 0 && vx < 448 && vy >= 0 && vy < 448) visible.push([x, y]);
  });
  expect(visible.length).toBeGreaterThan(0);
  const [tx, ty] = visible[0]!;
  await tapView(page, testInfo, tx * 32 + 16 - s.cameraX, ty * 32 + 16 - s.cameraY);
  expect((await snap(page)).edits).toEqual([[tx, ty]]);
  const box = await page.locator('#game canvas').boundingBox();
  expect(box!.width).toBeCloseTo(box!.height, 0);
});

test('taps on the canvas corners, edges and outside it never throw or act', async ({ page }, testInfo) => {
  const problems = watchProblems(page);
  await openGame(page);
  await begin(page, 0);
  await manual(page);
  await step(page, 5);
  const before = await snap(page);
  for (const [x, y] of [
    [0, 0],
    [447, 0],
    [0, 447],
    [447, 447],
  ] as const) {
    await tapView(page, testInfo, x, y);
  }
  const box = (await page.locator('#game canvas').boundingBox())!;
  if (!testInfo.project.use.hasTouch) {
    await page.mouse.click(box.x - 3, box.y + 10);
    await page.mouse.click(box.x + box.width + 3, box.y + 10);
  }
  const after = await snap(page);
  expect(after.edits).toEqual(before.edits);
  expect(after.vx).toBe(before.vx);
  expect(problems.errors).toEqual([]);
});

test('using the visible controls never counts as a game tap', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await manual(page);
  await step(page, 30);
  const before = await snap(page);
  await page.getByRole('button', { name: 'Mute', exact: true }).click();
  await page.getByRole('button', { name: 'Unmute', exact: true }).click();
  const after = await snap(page);
  expect(after.vx).toBe(before.vx);
  expect(after.edits).toEqual(before.edits);
  expect(after.tick).toBe(before.tick);
});

test('multitouch is ignored: a second finger never acts, and one tap is one action', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || !testInfo.project.use.hasTouch, 'needs CDP touch injection');
  await openGame(page);
  await startGame(page);
  await manual(page);
  await step(page, 40);
  const s = await snap(page);
  const willy = await viewToClient(page, s.spriteX - s.cameraX, s.spriteY - s.cameraY);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 5, y: 5, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 5, y: 5, id: 1 },
      { x: willy.x, y: willy.y, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await step(page, 1);
  expect((await snap(page)).vx).toBe(s.vx);
  await page.touchscreen.tap(willy.x, willy.y);
  await step(page, 1);
  expect((await snap(page)).vx).toBe(-s.vx);
});

test('backgrounding the page auto-pauses; returning leaves it paused until Resume', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  const a = await snap(page);
  expect(a.phase).toBe('paused');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(400);
  expect((await snap(page)).tick).toBe(a.tick);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.waitForTimeout(300);
  expect((await snap(page)).tick).toBeGreaterThan(a.tick);
});

test('after a long stall the game does not fast-forward', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await page.waitForTimeout(200);
  const a = await snap(page);
  await page.evaluate(() => {
    const end = performance.now() + 1500;
    while (performance.now() < end) {
      /* block the main thread */
    }
  });
  await page.waitForTimeout(100);
  const b = await snap(page);
  expect(b.tick - a.tick).toBeLessThan(40);
});

for (const size of [
  { name: 'phone portrait', width: 360, height: 640 },
  { name: 'phone landscape', width: 740, height: 360 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'wide desktop', width: 1920, height: 1080 },
]) {
  test(`layout and tap mapping hold at ${size.name} (${size.width}x${size.height}) and after resizing`, async ({ page }, testInfo) => {
    test.skip(Boolean(testInfo.project.use.isMobile), 'viewport is fixed by the device profile');
    await page.setViewportSize({ width: size.width, height: size.height });
    await openGame(page);
    await begin(page, 0);
    await manual(page);
    await step(page, 20);
    const check = async (): Promise<void> => {
      const box = (await page.locator('#game canvas').boundingBox())!;
      const vp = page.viewportSize()!;
      expect(box.width).toBeCloseTo(box.height, 0);
      expect(box.x).toBeGreaterThanOrEqual(-0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      const s = await snap(page);
      const map = level(0);
      const gaps: Array<[number, number]> = [];
      map.layers[0]!.data!.forEach((g, i) => g === 19 && gaps.push([i % map.width, Math.floor(i / map.width)]));
      const spots = gaps.filter(([x, y]) => {
        const vx = x * 32 + 16 - s.cameraX;
        const vy = y * 32 + 16 - s.cameraY;
        return vx >= 0 && vx < 448 && vy >= 0 && vy < 448 && !s.edits.some(([ex, ey]) => ex === x && ey === y);
      });
      const [tx, ty] = spots[0]!;
      const c = await viewToClient(page, tx * 32 + 16 - s.cameraX, ty * 32 + 16 - s.cameraY);
      await page.mouse.click(c.x, c.y);
      const edits = (await snap(page)).edits;
      expect(edits.some(([x, y]) => x === tx && y === ty)).toBe(true);
      expect(edits.length).toBe(s.edits.length + 1);
    };
    await check();
    await page.setViewportSize({ width: size.height, height: size.width });
    await page.waitForTimeout(150);
    await check();
  });
}

test('repeated restarts, advances and level changes leave no accumulated objects or listeners', async ({ page }) => {
  const problems = watchProblems(page);
  await openGame(page);
  await begin(page, 0);
  await manual(page);
  await step(page, 5);
  const base = await snap(page);
  for (let i = 0; i < 60; i++) {
    await page.evaluate((n) => {
      const nsw = (window as unknown as { __nsw: { begin(i: number): void; step(n: number): void } }).__nsw;
      nsw.begin(n % 8);
      nsw.step(3);
    }, 0);
  }
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await step(page, 5);
  const after = await snap(page);
  expect(after.counts.displayObjects).toBe(base.counts.displayObjects);
  expect(after.counts.tracked).toBe(base.counts.tracked);
  expect(after.counts.sceneListeners).toBe(base.counts.sceneListeners);
  expect(after.counts.shellListeners).toBe(base.counts.shellListeners);
  expect(after.counts.particles).toBe(0);
  expect(after.counts.levelsShown).toBeGreaterThan(60);
  expect(problems.errors).toEqual([]);
});

test('death: shows Retry once, blood clears, retry restores the level and edits', async ({ page }, testInfo) => {
  const problems = watchProblems(page);
  await openGame(page);
  await begin(page, 0);
  await manual(page);
  await step(page, 600);
  let s = await snap(page);
  expect(s.outcome).toBe('dead');
  await expect(page.getByRole('button', { name: 'Retry level', exact: true })).toBeVisible();
  expect(await page.getByRole('button', { name: 'Retry level', exact: true }).count()).toBe(1);
  await step(page, 400);
  s = await snap(page);
  expect(s.counts.particles).toBe(0);
  await page.getByRole('button', { name: 'Retry level', exact: true }).click();
  s = await snap(page);
  expect(s.outcome).toBe('playing');
  expect(s.tick).toBeLessThan(5);
  expect(s.edits).toEqual([]);
  expect(problems.errors).toEqual([]);
  void testInfo;
});

test('winning every level in turn advances in the original order and the last level offers a full restart', async ({ page }, testInfo) => {
  test.slow();
  const { loadRoute, replayRoute } = await import('./helpers');
  await openGame(page);
  await startGame(page);
  for (let n = 0; n < 8; n++) {
    const r = await replayRoute(page, testInfo, loadRoute(n));
    expect(r.winTick).toBeGreaterThan(0);
    if (n < 7) {
      await page.getByRole('button', { name: 'Next level', exact: true }).click();
      expect((await snap(page)).levelIndex).toBe(n + 1);
    }
  }
  await page.getByRole('button', { name: 'Play again from level 1', exact: true }).click();
  const s = await snap(page);
  expect(s.levelIndex).toBe(0);
  expect(s.edits).toEqual([]);
  expect(s.tick).toBeLessThan(5);
});

import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import type { NswSnapshot } from '../src/testing/hook';

export interface RouteAction {
  tick: number;
  worldX: number;
  worldY: number;
  intent: 'reverse' | 'fill';
  tile?: [number, number];
}
export interface Route {
  level: number;
  winTick: number;
  actions: RouteAction[];
}

export const loadRoute = (n: number): Route => JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, `../routes/level-${n}.json`), 'utf8')) as Route;

export interface Problems {
  errors: string[];
  failedRequests: string[];
}

/** Collects console errors, uncaught exceptions and failed network requests so tests can assert there are none. */
export function watchProblems(page: Page): Problems {
  const problems: Problems = { errors: [], failedRequests: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') problems.errors.push(m.text());
  });
  page.on('pageerror', (e) => problems.errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.failedRequests.push(`${r.url()} ${r.failure()?.errorText ?? ''}`));
  page.on('response', (r) => {
    if (r.status() >= 400) problems.failedRequests.push(`${r.status()} ${r.url()}`);
  });
  return problems;
}

export async function openGame(page: Page, query = '?test=1'): Promise<void> {
  await page.goto(`/${query}`);
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'title', { timeout: 30_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __nsw?: unknown }).__nsw));
}

export const snap = (page: Page): Promise<NswSnapshot> => page.evaluate(() => (window as unknown as { __nsw: { snapshot(): NswSnapshot } }).__nsw.snapshot());
export const step = (page: Page, n: number): Promise<void> => page.evaluate((k) => (window as unknown as { __nsw: { step(n: number): void } }).__nsw.step(k), n);
export const manual = (page: Page, on = true): Promise<void> => page.evaluate((v) => (window as unknown as { __nsw: { setManual(b: boolean): void } }).__nsw.setManual(v), on);
export const begin = (page: Page, level: number): Promise<void> => page.evaluate((i) => (window as unknown as { __nsw: { begin(i: number): void } }).__nsw.begin(i), level);

export const viewToClient = (page: Page, x: number, y: number): Promise<{ x: number; y: number }> =>
  page.evaluate(([vx, vy]) => (window as unknown as { __nsw: { viewToClient(x: number, y: number): { x: number; y: number } } }).__nsw.viewToClient(vx!, vy!), [x, y] as const);

/** A real pointer tap at a position in the 448x448 game view: a touch tap on touch devices, a mouse click otherwise. */
export async function tapView(page: Page, testInfo: TestInfo, x: number, y: number): Promise<void> {
  const c = await viewToClient(page, x, y);
  if (testInfo.project.use.hasTouch) await page.touchscreen.tap(c.x, c.y);
  else await page.mouse.click(c.x, c.y);
}

/** Replays a route through real pointer events, advancing exact ticks between taps. Returns the tick the level was won on. */
export async function replayRoute(page: Page, testInfo: TestInfo, route: Route): Promise<{ winTick: number; taps: number }> {
  await begin(page, route.level);
  await manual(page, true);
  const byTick = new Map<number, RouteAction[]>();
  for (const a of route.actions) byTick.set(a.tick, [...(byTick.get(a.tick) ?? []), a]);
  const ticks = [...byTick.keys()].sort((a, b) => a - b);
  let now = 0;
  let taps = 0;
  for (const t of ticks) {
    if (t > now) {
      await step(page, t - now);
      now = t;
    }
    for (const a of byTick.get(t)!) {
      const s = await snap(page);
      await tapView(page, testInfo, a.worldX - s.cameraX, a.worldY - s.cameraY);
      taps++;
    }
  }
  for (let i = 0; i < 40; i++) {
    await step(page, 200);
    if ((await snap(page)).outcome !== 'playing') break;
  }
  const end = await snap(page);
  return { winTick: end.outcome === 'won' ? end.outcomeTick : -1, taps };
}

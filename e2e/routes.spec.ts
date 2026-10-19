import { expect, test } from '@playwright/test';
import { loadRoute, openGame, replayRoute, snap, watchProblems } from './helpers';

test.describe('every stage is beatable with the original verbs (production build, real pointer events)', () => {
  for (let level = 0; level < 8; level++) {
    test(`Level ${level + 1}: recorded route reaches Martha on the recorded tick`, async ({ page }, testInfo) => {
      const problems = watchProblems(page);
      await openGame(page);
      const route = loadRoute(level);
      const result = await replayRoute(page, testInfo, route);
      expect(result.taps).toBe(route.actions.length);
      expect(result.winTick).toBe(route.winTick);
      const end = await snap(page);
      expect(end.outcome).toBe('won');
      expect(end.phase).toBe('won');
      await expect(page.locator('#end-screen')).toBeVisible();
      if (level < 7) await expect(page.getByRole('button', { name: 'Next level', exact: true })).toBeVisible();
      else await expect(page.getByRole('button', { name: 'Play again from level 1', exact: true })).toBeVisible();
      expect(problems.errors).toEqual([]);
      expect(problems.failedRequests).toEqual([]);
    });
  }

  test('the same route fails if the first gap is never filled (the taps matter)', async ({ page }, testInfo) => {
    await openGame(page);
    const route = loadRoute(0);
    const withoutFills = { ...route, actions: route.actions.filter((a) => a.intent === 'reverse') };
    const result = await replayRoute(page, testInfo, withoutFills);
    expect(result.winTick).toBe(-1);
  });
});

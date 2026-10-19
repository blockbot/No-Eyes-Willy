import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/levels/manifest';
import { parseLevel } from '../src/sim/level';
import { LevelSim } from '../src/sim/level-sim';
import type { RouteFile } from '../tools/routes/solve';

const root = path.resolve(__dirname, '..');
const loadRoute = (n: number): RouteFile => JSON.parse(fs.readFileSync(path.join(root, `routes/level-${n}.json`), 'utf8')) as RouteFile;
const loadLegacy = (n: number): { cols: string[]; rows: Array<Array<number | string>> } =>
  JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, `parity/traces/route-L${n}.json.gz`))).toString());

describe('winning routes (tap Willy to reverse, tap gaps to fill)', () => {
  for (const def of LEVELS) {
    it(`${def.title}: the recorded route wins, on the same tick as the original Phaser 2 game`, () => {
      const route = loadRoute(def.index);
      const sim = new LevelSim(parseLevel(def));
      const byTick = new Map<number, RouteFile['actions']>();
      for (const a of route.actions) byTick.set(a.tick, [...(byTick.get(a.tick) ?? []), a]);

      let won = -1;
      let reversals = 0;
      let fills = 0;
      for (let t = 0; t < route.winTick + 5; t++) {
        for (const a of byTick.get(t) ?? []) {
          const r = sim.pointerDown(a.worldX - sim.cameraX, a.worldY - sim.cameraY);
          expect(r.edited || r.turned, `tap at tick ${t} must do something`).toBe(true);
          if (r.turned) reversals++;
          if (r.edited) fills++;
        }
        sim.tick();
        if (sim.outcome === 'won' && won < 0) won = t;
        expect(sim.outcome, `died at tick ${t}`).not.toBe('dead');
      }
      expect(won).toBe(route.winTick);
      expect(reversals).toBeGreaterThan(0);
      expect(fills + reversals).toBeGreaterThanOrEqual(route.actions.length);

      const legacy = loadLegacy(def.index);
      const winCol = legacy.cols.indexOf('win');
      const legacyWin = legacy.rows.findIndex((row) => row[winCol] === 1);
      expect(legacyWin, 'original game reaches Martha on the same tick').toBe(route.winTick);
    });
  }

  it('every level has at least one click-to-reverse in its route or a filled gap', () => {
    for (const def of LEVELS) {
      const route = loadRoute(def.index);
      expect(route.actions.length).toBeGreaterThan(0);
    }
  });
});

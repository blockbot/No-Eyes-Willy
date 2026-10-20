import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/levels/manifest';
import { TILE_SIZE } from '../src/sim/constants';
import { parseLevel } from '../src/sim/level';
import { LevelSim } from '../src/sim/level-sim';

interface Trace {
  name: string;
  level: number;
  ticks: number;
  clicks: Array<{ t: number; wx: number; wy: number; cam: [number, number] }>;
  cols: string[];
  rows: Array<Array<number | string>>;
}

const dir = path.resolve(__dirname, '../parity/traces');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json.gz')).sort() : [];
const load = (f: string): Trace => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString()) as Trace;

const EPS = 1e-4;

function newSim(trace: Trace, legacyFloor: boolean): LevelSim {
  const def = LEVELS[trace.level];
  if (!def) throw new Error('level');
  const sim = new LevelSim(parseLevel(def));
  // The original engine let any overlap with a tile top act as floor; the game now only uses Willy's foot.
  if (legacyFloor) sim.willy.footSupport = false;
  return sim;
}

const clicksByTick = (trace: Trace): Map<number, Trace['clicks']> => {
  const byTick = new Map<number, Trace['clicks']>();
  for (const c of trace.clicks) byTick.set(c.t, [...(byTick.get(c.t) ?? []), c]);
  return byTick;
};

function checkRow(trace: Trace, sim: LevelSim, t: number): void {
  const col = (n: string): number => trace.cols.indexOf(n);
  const row = trace.rows[t]!;
  const num = (n: string): number => row[col(n)] as number;
  const where = `${trace.name} tick ${t}`;
  const blk = (sim.willy.blocked.left ? 1 : 0) | (sim.willy.blocked.right ? 2 : 0) | (sim.willy.blocked.up ? 4 : 0) | (sim.willy.blocked.down ? 8 : 0);
  expect(Math.abs(sim.spriteX - num('sx')), `${where} sx ${sim.spriteX} vs ${num('sx')}`).toBeLessThan(EPS);
  expect(Math.abs(sim.spriteY - num('sy')), `${where} sy ${sim.spriteY} vs ${num('sy')}`).toBeLessThan(EPS);
  expect(Math.abs(sim.willy.vx - num('vx')), `${where} vx`).toBeLessThan(EPS);
  expect(Math.abs(sim.willy.vy - num('vy')), `${where} vy`).toBeLessThan(EPS);
  expect(blk, `${where} blocked`).toBe(num('blk'));
  expect(sim.scaleX, `${where} scale`).toBe(num('sc'));
  expect(sim.alive ? 1 : 0, `${where} alive`).toBe(num('alive'));
  expect(sim.exists ? 1 : 0, `${where} exists`).toBe(num('exists'));
  expect(sim.cameraX, `${where} camx`).toBe(num('camx'));
  expect(sim.cameraY, `${where} camy`).toBe(num('camy'));
  expect(sim.velocityX, `${where} velocityX`).toBe(num('vX'));
  expect(sim.walking ? 1 : 0, `${where} walking`).toBe(num('walking'));
  expect(sim.didWin ? 1 : 0, `${where} win`).toBe(num('win'));
  expect(sim.isClimbing ? 1 : 0, `${where} isClimbing`).toBe(num('isC'));
  expect(sim.wasClimbing ? 1 : 0, `${where} wasClimbing`).toBe(num('wasC'));
  expect(sim.ladderCheck, `${where} ladderCheck`).toBe(num('lc'));
  // legacy bumped endCheck once per queued death timeout; only "has the end screen been shown" is gameplay.
  expect(sim.endCheck > 0, `${where} endScreenShown`).toBe(num('end') > 0);
  const edits = sim
    .editedTiles()
    .map(([x, y]) => `${x},${y}`)
    .join(';');
  expect(edits, `${where} edits`).toBe(row[col('edits')]);
}

const sameBody = (a: LevelSim, b: LevelSim): boolean =>
  a.spriteX === b.spriteX &&
  a.spriteY === b.spriteY &&
  a.willy.vx === b.willy.vx &&
  a.willy.vy === b.willy.vy &&
  a.willy.blocked.left === b.willy.blocked.left &&
  a.willy.blocked.right === b.willy.blocked.right &&
  a.willy.blocked.down === b.willy.blocked.down;

/** True when no colliding tile top lies under the foot position (the bottom-centre of the body). */
function footUnsupported(sim: LevelSim): boolean {
  const w = sim.willy;
  const foot = w.x + w.width / 2;
  const row = w.bottom / TILE_SIZE;
  if (!Number.isInteger(row)) return false;
  for (const tx of [Math.floor(foot / TILE_SIZE), Math.ceil(foot / TILE_SIZE) - 1]) {
    if (sim.grid.tileAt(tx, row)?.collideUp) return false;
  }
  return true;
}

describe('legacy parity (Phaser 2.0.3 recorded traces, legacy floor rule)', () => {
  it('has recorded traces', () => {
    expect(files.length).toBeGreaterThan(0);
  });
  for (const f of files) {
    it(f.replace('.json.gz', ''), () => {
      const trace = load(f);
      const sim = newSim(trace, true);
      const byTick = clicksByTick(trace);
      for (let t = 0; t < trace.rows.length; t++) {
        for (const c of byTick.get(t) ?? []) sim.pointerDown(c.wx - c.cam[0], c.wy - c.cam[1]);
        sim.tick();
        checkRow(trace, sim, t);
      }
    });
  }
});

describe('foot support departs from the legacy traces only where Willy stood with his foot over no floor', () => {
  for (const f of files) {
    it(f.replace('.json.gz', ''), () => {
      const trace = load(f);
      const sim = newSim(trace, false);
      const legacy = newSim(trace, true);
      const byTick = clicksByTick(trace);
      for (let t = 0; t < trace.rows.length; t++) {
        for (const c of byTick.get(t) ?? []) {
          sim.pointerDown(c.wx - c.cam[0], c.wy - c.cam[1]);
          legacy.pointerDown(c.wx - c.cam[0], c.wy - c.cam[1]);
        }
        sim.tick();
        legacy.tick();
        if (sameBody(sim, legacy)) {
          checkRow(trace, sim, t);
          continue;
        }
        const where = `${trace.name} first departure at tick ${t}`;
        expect(legacy.willy.blocked.down, `${where}: legacy held Willy on a floor`).toBe(true);
        expect(footUnsupported(legacy), `${where}: legacy floor was not under his foot`).toBe(true);
        expect(sim.spriteX, `${where}: same horizontal position`).toBe(legacy.spriteX);
        expect(sim.spriteY, `${where}: Willy is below the legacy platform height`).toBeGreaterThan(legacy.spriteY);
        expect(sim.willy.blocked.down, `${where}: not standing`).toBe(false);
        return;
      }
    });
  }
});

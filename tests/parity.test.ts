import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/levels/manifest';
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

const EPS = 1e-4;

function check(trace: Trace): void {
  const col = (n: string): number => trace.cols.indexOf(n);
  const def = LEVELS[trace.level];
  if (!def) throw new Error('level');
  const sim = new LevelSim(parseLevel(def));
  const byTick = new Map<number, Trace['clicks']>();
  for (const c of trace.clicks) byTick.set(c.t, [...(byTick.get(c.t) ?? []), c]);
  for (let t = 0; t < trace.rows.length; t++) {
    for (const c of byTick.get(t) ?? []) sim.pointerDown(c.wx - c.cam[0], c.wy - c.cam[1]);
    sim.tick();
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
}

describe('legacy parity (Phaser 2.0.3 recorded traces)', () => {
  it('has recorded traces', () => {
    expect(files.length).toBeGreaterThan(0);
  });
  for (const f of files) {
    it(f.replace('.json.gz', ''), () => {
      const trace = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString()) as Trace;
      check(trace);
    });
  }
});

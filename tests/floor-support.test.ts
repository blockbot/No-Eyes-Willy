import { describe, expect, it } from 'vitest';
import { OBJECT_LADDER, TILE_EDITABLE, TILE_SIZE, WALK_SPEED, WILLY_BODY_W } from '../src/sim/constants';
import { parseLevel } from '../src/sim/level';
import type { LevelDef, TiledMap } from '../src/sim/level';
import { LevelSim } from '../src/sim/level-sim';

/**
 * Small maps built from text rows: '#' solid tile, 'e' editable slot, '.' empty, 'H' empty cell with a
 * ladder, 'L' solid tile with a ladder (ladder tops sit on a platform tile, as in the campaign maps).
 */
function makeSim(rows: string[], willy: { x: number; row: number; facing: -1 | 1 }): LevelSim {
  const width = rows[0]!.length;
  const data: number[] = [];
  const objects: TiledMap['layers'][number]['objects'] = [];
  rows.forEach((row, y) => {
    expect(row.length).toBe(width);
    [...row].forEach((ch, x) => {
      data.push(ch === '#' || ch === 'L' ? 1 : ch === 'e' ? TILE_EDITABLE : 0);
      if (ch === 'H' || ch === 'L') objects.push({ gid: OBJECT_LADDER, x: x * TILE_SIZE, y: (y + 1) * TILE_SIZE, visible: true });
    });
  });
  const map: TiledMap = {
    width,
    height: rows.length,
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    orientation: 'orthogonal',
    layers: [
      { name: 'Tile Layer 1', type: 'tilelayer', data },
      { name: 'Object Layer 1', type: 'objectgroup', objects },
    ],
  };
  const def: LevelDef = {
    id: 'floor-support',
    index: 0,
    title: 'floor support',
    map,
    martha: { x: () => -1000, y: () => -1000, anchored: false, flipped: false },
    willy: { x: () => willy.x, y: () => standY(willy.row), facing: willy.facing },
    explosion: { x: () => 0, y: () => 0 },
  };
  return new LevelSim(parseLevel(def));
}

/** Willy's sprite centre y when his feet are on the top of a tile row. */
const standY = (row: number): number => row * TILE_SIZE - 32;
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;
const foot = (sim: LevelSim): number => sim.willy.x + sim.willy.width / 2;

interface Sample {
  t: number;
  foot: number;
  y: number;
}

function run(sim: LevelSim, ticks: number, each?: (t: number) => void): Sample[] {
  const out: Sample[] = [];
  for (let t = 0; t < ticks; t++) {
    each?.(t);
    sim.tick();
    out.push({ t, foot: foot(sim), y: sim.spriteY });
  }
  return out;
}

const tapTile = (sim: LevelSim, tx: number, ty: number): boolean =>
  sim.pointerDown(tx * TILE_SIZE + 16 - sim.cameraX, ty * TILE_SIZE + 16 - sim.cameraY).edited;

const PLATFORM = 5;
const FLOOR = 9;
const TOP = standY(PLATFORM);
const BOTTOM = standY(FLOOR);

/** A platform on row 5 with the given cells open, walls at both ends, and a floor on row 9 to fall onto. */
function gapMap(gapCols: number[], cell: '.' | 'e', width = 18): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 10; y++) {
    let r = '';
    for (let x = 0; x < width; x++) {
      const wall = (x === 0 || x === width - 1) && y >= 3 && y <= PLATFORM;
      if (y === FLOOR || wall) r += '#';
      else if (y === PLATFORM) r += gapCols.includes(x) ? cell : '#';
      else r += '.';
    }
    rows.push(r);
  }
  return rows;
}

/**
 * Walks Willy towards the opening and checks that he drops into it: never at platform height while his foot
 * is over the opening, never at platform height beyond it, and finally standing on the floor far below.
 */
function expectFallsIntoGap(samples: Sample[], gapStart: number, gapEnd: number, dir: 1 | -1): void {
  const lo = gapStart * TILE_SIZE;
  const hi = gapEnd * TILE_SIZE;
  const overGap = samples.filter((s) => s.foot > lo && s.foot < hi);
  expect(overGap.length, 'Willy reached the opening').toBeGreaterThan(0);
  for (const s of overGap) expect(s.y, `tick ${s.t}: still at platform height over the opening (foot ${s.foot})`).toBeGreaterThan(TOP);
  const beyond = samples.filter((s) => (dir === 1 ? s.foot >= hi : s.foot <= lo));
  for (const s of beyond) expect(s.y, `tick ${s.t}: crossed the opening at platform height`).toBeGreaterThan(TOP);
  const first = overGap[0]!;
  expect(first.y - TOP, 'falls on the first tick his foot is over the opening').toBeGreaterThan(0);
  expect(Math.max(...samples.map((s) => s.y)) - TOP, 'drops well below the platform').toBeGreaterThanOrEqual(BOTTOM - TOP);
  expect(samples.at(-1)!.y).toBe(BOTTOM);
}

describe('floor support: Willy falls into every unsupported gap', () => {
  for (const cell of ['.', 'e'] as const) {
    const what = cell === '.' ? 'empty cell' : 'unfilled editable slot';
    for (const width of [1, 2, 3]) {
      const gap = Array.from({ length: width }, (_, i) => 8 + i);
      it(`${width}-tile gap of ${what}, walking right`, () => {
        const sim = makeSim(gapMap(gap, cell), { x: 3 * TILE_SIZE + 16, row: PLATFORM, facing: 1 });
        expectFallsIntoGap(run(sim, 220), gap[0]!, gap.at(-1)! + 1, 1);
      });
      it(`${width}-tile gap of ${what}, walking left`, () => {
        const sim = makeSim(gapMap(gap, cell), { x: 14 * TILE_SIZE + 16, row: PLATFORM, facing: -1 });
        expectFallsIntoGap(run(sim, 220), gap[0]!, gap.at(-1)! + 1, -1);
      });
    }
  }

  it('the one-tile gap from the bug report: no tick has Willy supported with his foot over it', () => {
    for (const dir of [1, -1] as const) {
      const sim = makeSim(gapMap([8], '.'), { x: dir === 1 ? 3 * TILE_SIZE : 13 * TILE_SIZE, row: PLATFORM, facing: dir });
      for (let t = 0; t < 200; t++) {
        sim.tick();
        const f = foot(sim);
        if (f > 8 * TILE_SIZE && f < 9 * TILE_SIZE) expect(sim.willy.blocked.down && sim.spriteY <= TOP, `dir ${dir} tick ${t}`).toBe(false);
      }
    }
  });

  it('edge-aligned and fractional starting positions do not bypass the gap', () => {
    const starts: number[] = [];
    for (let q = 0; q < 32 * 12; q++) starts.push(4 * TILE_SIZE + q / 12);
    // body flush with the near edge, foot exactly on the edge, and the foot already over the gap
    starts.push(7 * TILE_SIZE, 8 * TILE_SIZE - 16, 8 * TILE_SIZE, 8 * TILE_SIZE + 0.001, 8 * TILE_SIZE + 16, 9 * TILE_SIZE - 0.001);
    for (const x of starts) {
      const right = makeSim(gapMap([8], 'e'), { x, row: PLATFORM, facing: 1 });
      expectFallsIntoGap(run(right, 200), 8, 9, 1);
      const mirrored = 18 * TILE_SIZE - x;
      const left = makeSim(gapMap([8], 'e'), { x: mirrored, row: PLATFORM, facing: -1 });
      expectFallsIntoGap(run(left, 200), 8, 9, -1);
    }
  });

  it('a gap between two different platform heights still drops him (corners do not lift him up)', () => {
    const rows = gapMap([8], '.');
    rows[PLATFORM - 1] = rows[PLATFORM - 1]!.slice(0, 9) + '#'.repeat(8) + rows[PLATFORM - 1]!.slice(17);
    const sim = makeSim(rows, { x: 3 * TILE_SIZE + 16, row: PLATFORM, facing: 1 });
    const samples = run(sim, 220);
    for (const s of samples.filter((q) => q.foot > 8 * TILE_SIZE)) expect(s.y, `tick ${s.t}`).toBeGreaterThan(TOP);
    expect(samples.at(-1)!.y).toBe(BOTTOM);
  });
});

describe('floor support: what still holds Willy up', () => {
  it('a slot filled with a bridge is crossed normally, in both directions', () => {
    for (const dir of [1, -1] as const) {
      const sim = makeSim(gapMap([8], 'e'), { x: dir === 1 ? 3 * TILE_SIZE + 16 : 14 * TILE_SIZE + 16, row: PLATFORM, facing: dir });
      const samples = run(sim, 220, (t) => {
        if (t === 6) expect(tapTile(sim, 8, PLATFORM)).toBe(true);
      });
      for (const s of samples) expect(s.y, `dir ${dir} tick ${s.t}`).toBe(TOP);
      const far = dir === 1 ? Math.max(...samples.map((s) => s.foot)) : Math.min(...samples.map((s) => s.foot));
      if (dir === 1) expect(far).toBeGreaterThan(11 * TILE_SIZE);
      else expect(far).toBeLessThan(6 * TILE_SIZE);
    }
  });

  it('a bridge filled while Willy stands at the edge, before his foot leaves it, carries him across', () => {
    const sim = makeSim(gapMap([8, 9], 'e'), { x: 3 * TILE_SIZE + 16, row: PLATFORM, facing: 1 });
    let filled = false;
    const samples = run(sim, 160, () => {
      if (!filled && foot(sim) > 8 * TILE_SIZE - 6) {
        filled = tapTile(sim, 8, PLATFORM) && tapTile(sim, 9, PLATFORM);
      }
    });
    expect(filled).toBe(true);
    for (const s of samples) expect(s.y, `tick ${s.t}`).toBe(TOP);
    expect(Math.max(...samples.map((s) => s.foot))).toBeGreaterThan(11 * TILE_SIZE);
  });

  it('a continuous platform is walkable end to end, and walls still turn him around', () => {
    const sim = makeSim(gapMap([], '.'), { x: 3 * TILE_SIZE + 16, row: PLATFORM, facing: 1 });
    const turns: Array<{ t: number; x: number; v: number }> = [];
    let last = 0;
    const samples = run(sim, 600, (t) => {
      if (sim.velocityX !== last && sim.velocityX !== 0 && last !== 0) turns.push({ t, x: sim.willy.x, v: sim.velocityX });
      last = sim.velocityX;
    });
    for (const s of samples) expect(s.y, `tick ${s.t}`).toBe(TOP);
    expect(turns.length).toBeGreaterThanOrEqual(2);
    expect(turns[0]!.v).toBe(-WALK_SPEED);
    expect(turns[0]!.x + WILLY_BODY_W).toBeCloseTo(17 * TILE_SIZE, 6);
    expect(turns[1]!.v).toBe(WALK_SPEED);
    expect(turns[1]!.x).toBeCloseTo(1 * TILE_SIZE, 6);
  });

  it('lands on a lower platform and keeps walking on it', () => {
    const rows = gapMap([], '.');
    const lower = PLATFORM + 2;
    rows[PLATFORM] = '#'.repeat(9) + '.'.repeat(9);
    rows[lower] = '.'.repeat(9) + '#'.repeat(9);
    rows[PLATFORM - 1] = rows[PLATFORM - 1]!.slice(0, 17) + '.';
    rows[PLATFORM - 2] = rows[PLATFORM - 2]!.slice(0, 17) + '.';
    rows[lower - 1] = rows[lower - 1]!.slice(0, 17) + '#';
    const sim = makeSim(rows, { x: 3 * TILE_SIZE + 16, row: PLATFORM, facing: 1 });
    const samples = run(sim, 300);
    const landed = samples.findIndex((s) => near(s.y, standY(lower)));
    expect(landed).toBeGreaterThan(0);
    for (const s of samples.slice(0, landed)) expect(s.y).toBeLessThan(standY(lower));
    const after = samples.slice(landed, landed + 40);
    for (const s of after) expect(near(s.y, standY(lower)), `tick ${s.t}`).toBe(true);
    expect(after.at(-1)!.foot).toBeGreaterThan(after[0]!.foot + 40);
  });

  it('a lower platform under a one-tile gap catches him inside the gap', () => {
    const rows = gapMap([8], '.');
    rows[PLATFORM + 2] = '.'.repeat(8) + '#' + '.'.repeat(9);
    const sim = makeSim(rows, { x: 3 * TILE_SIZE + 16, row: PLATFORM, facing: 1 });
    const samples = run(sim, 200);
    expect(samples.at(-1)!.y).toBeCloseTo(standY(PLATFORM + 2), 6);
    expect(samples.at(-1)!.foot).toBeGreaterThan(8 * TILE_SIZE);
    expect(samples.at(-1)!.foot).toBeLessThan(9 * TILE_SIZE);
  });

  it('tapping Willy still reverses him, with the same 64 px hit area', () => {
    const sim = makeSim(gapMap([], '.'), { x: 8 * TILE_SIZE, row: PLATFORM, facing: 1 });
    run(sim, 30);
    expect(sim.willy.vx).toBe(WALK_SPEED);
    const r = sim.pointerDown(sim.spriteX + 30 - sim.cameraX, sim.spriteY - sim.cameraY);
    expect(r.turned).toBe(true);
    run(sim, 10);
    expect(sim.willy.vx).toBe(-WALK_SPEED);
    expect(sim.spriteY).toBe(TOP);
    expect(sim.willy.width).toBe(WILLY_BODY_W);
  });
});

describe('floor support: ladders', () => {
  /** Floor on row 10, upper platform on row 5 whose ladder runs from its top tile down to the floor. */
  const ladderMap = (upper: string, wall = '..............'): string[] => {
    const rows: string[] = [];
    for (let y = 0; y < 11; y++) {
      if (y === 10) rows.push('#'.repeat(14));
      else if (y === 5) rows.push(upper);
      else if (y === 4 || y === 3) rows.push(wall);
      else if (y > 5) rows.push('......H.......');
      else rows.push('..............');
    }
    return rows;
  };

  it('climbs a ladder and steps off at the top onto the platform', () => {
    const sim = makeSim(ladderMap('######L##.....', '........#.....'), { x: 11 * TILE_SIZE, row: 10, facing: -1 });
    let climbed = false;
    const samples = run(sim, 500, () => {
      if (sim.anim === 'climb') climbed = true;
    });
    expect(climbed).toBe(true);
    const firstOnTop = samples.findIndex((s) => near(s.y, standY(5)));
    expect(firstOnTop).toBeGreaterThan(0);
    const later = samples.slice(firstOnTop + 20);
    expect(later.length).toBeGreaterThan(100);
    for (const s of later) expect(near(s.y, standY(5)), `tick ${s.t}`).toBe(true);
    expect(new Set(later.map((s) => Math.sign(s.foot - later[0]!.foot))).size, 'walks both ways between the wall and the map edge').toBeGreaterThan(1);
    expect(sim.walking).toBe(true);
  });

  it('a ladder top at the end of a platform: he climbs, then walks off the edge and falls', () => {
    const sim = makeSim(ladderMap('......L#......'), { x: 11 * TILE_SIZE, row: 10, facing: -1 });
    let climbedTo = Infinity;
    const samples = run(sim, 500, () => {
      climbedTo = Math.min(climbedTo, sim.spriteY);
    });
    expect(climbedTo).toBeLessThanOrEqual(standY(5));
    const leftEdge = 6 * TILE_SIZE;
    for (const s of samples) if (s.foot < leftEdge && s.foot > leftEdge - 2 * TILE_SIZE) expect(s.y).not.toBe(standY(5));
  });
});

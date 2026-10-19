import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FixedStepper } from '../src/app/stepper';
import { TapGate, clientToView } from '../src/app/pointer';
import { Preferences } from '../src/app/preferences';
import { assetUrl } from '../src/app/config';
import { GameController } from '../src/app/controller';
import type { Presenter } from '../src/app/controller';
import { LEVELS } from '../src/levels/manifest';
import { LevelValidationError, parseLevel } from '../src/sim/level';
import type { LevelDef } from '../src/sim/level';
import { LevelSim } from '../src/sim/level-sim';
import type { SimEvent } from '../src/sim/level-sim';

const root = path.resolve(__dirname, '..');

describe('FixedStepper (frame-rate independence)', () => {
  const run = (frameMs: number, totalMs: number): number => {
    const s = new FixedStepper();
    let ticks = 0;
    let t = 1000;
    s.advance(t);
    for (let elapsed = 0; elapsed < totalMs - 1e-6; elapsed += frameMs) {
      t += frameMs;
      ticks += s.advance(t);
    }
    return ticks;
  };

  it('runs the same number of ticks per second at 30, 60, 75, 120, 144 and 240 Hz', () => {
    for (const hz of [30, 60, 75, 120, 144, 240]) {
      const ticks = run(1000 / hz, 10_000);
      expect(Math.abs(ticks - 600), `${hz} Hz gave ${ticks}`).toBeLessThanOrEqual(1);
    }
  });

  it('tolerates jittery frame times', () => {
    const s = new FixedStepper();
    let t = 0;
    let ticks = 0;
    let seed = 7;
    const rand = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    s.advance(t);
    let total = 0;
    while (total < 20_000) {
      const dt = 8 + rand() * 24;
      total += dt;
      t += dt;
      ticks += s.advance(t);
    }
    expect(Math.abs(ticks - total * 0.06)).toBeLessThan(2);
  });

  it('does not fast-forward after a long stall', () => {
    const s = new FixedStepper();
    s.advance(0);
    expect(s.advance(60_000)).toBeLessThanOrEqual(6);
    expect(s.advance(60_000 + 16.67)).toBeLessThanOrEqual(1);
  });

  it('never goes backwards and starts from zero', () => {
    const s = new FixedStepper();
    expect(s.advance(500)).toBe(0);
    expect(s.advance(400)).toBe(0);
  });
});

describe('pointer mapping', () => {
  it('maps a CSS-scaled canvas back to 448x448 view pixels', () => {
    const rect = { left: 100, top: 50, width: 896, height: 896 };
    expect(clientToView(rect, 100, 50)).toEqual({ x: 0, y: 0 });
    expect(clientToView(rect, 100 + 448, 50 + 448)).toEqual({ x: 224, y: 224 });
    expect(clientToView(rect, 100 + 895.9, 50 + 895.9)).toEqual({ x: 447, y: 447 });
  });

  it('maps a canvas smaller than its native size (phones)', () => {
    const rect = { left: 8, top: 120, width: 224, height: 224 };
    expect(clientToView(rect, 8 + 112, 120 + 112)).toEqual({ x: 224, y: 224 });
  });

  it('is independent of device pixel ratio because it works in CSS pixels', () => {
    const base = clientToView({ left: 10, top: 10, width: 448, height: 448 }, 10 + 100.5, 10 + 200.5);
    const zoomed = clientToView({ left: 20, top: 20, width: 896, height: 896 }, 20 + 201, 20 + 401);
    expect(zoomed).toEqual(base);
  });

  it('ignores positions outside the canvas', () => {
    const rect = { left: 0, top: 0, width: 448, height: 448 };
    expect(clientToView(rect, -0.1, 10)).toBeNull();
    expect(clientToView(rect, 448, 10)).toBeNull();
    expect(clientToView(rect, 10, 448)).toBeNull();
    expect(clientToView({ left: 0, top: 0, width: 0, height: 0 }, 0, 0)).toBeNull();
    expect(clientToView(rect, Number.NaN, 5)).toBeNull();
  });
});

describe('TapGate (one action per tap, multitouch ignored)', () => {
  it('accepts the primary pointer once and ignores additional pointers until it is released', () => {
    const g = new TapGate();
    expect(g.down({ pointerId: 1, isPrimary: true, button: 0 })).toBe(true);
    expect(g.down({ pointerId: 2, isPrimary: false, button: 0 })).toBe(false);
    expect(g.down({ pointerId: 1, isPrimary: true, button: 0 })).toBe(false);
    g.release(2);
    expect(g.down({ pointerId: 1, isPrimary: true, button: 0 })).toBe(false);
    g.release(1);
    expect(g.down({ pointerId: 3, isPrimary: true, button: 0 })).toBe(true);
  });

  it('ignores secondary mouse buttons', () => {
    const g = new TapGate();
    expect(g.down({ pointerId: 1, isPrimary: true, button: 2 })).toBe(false);
    expect(g.down({ pointerId: 1, isPrimary: true, button: 1 })).toBe(false);
  });
});

describe('preferences', () => {
  it('persists mute and survives broken storage', () => {
    const mem = new Map<string, string>();
    const prefs = new Preferences({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) });
    expect(prefs.muted).toBe(false);
    prefs.muted = true;
    expect(new Preferences({ getItem: (k) => mem.get(k) ?? null, setItem: () => undefined }).muted).toBe(true);
    const broken = new Preferences({
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(() => (broken.muted = true)).not.toThrow();
    expect(broken.muted).toBe(false);
    expect(new Preferences(null).muted).toBe(false);
  });

  it('stores only the mute flag', () => {
    const mem = new Map<string, string>();
    const prefs = new Preferences({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) });
    prefs.muted = true;
    expect([...mem.keys()]).toEqual(['noeyeswilly:muted']);
  });
});

describe('asset URLs', () => {
  it('derive from the app base, wherever it is hosted', () => {
    expect(assetUrl('assets/x.png', './', 'https://example.com/games/willy/')).toBe('https://example.com/games/willy/assets/x.png');
    expect(assetUrl('assets/x.png', './', 'https://example.com/games/willy/index.html')).toBe('https://example.com/games/willy/assets/x.png');
    expect(assetUrl('/assets/x.png', '/', 'https://example.com/anything/here')).toBe('https://example.com/assets/x.png');
    expect(assetUrl('assets/x.png', '/sub/', 'https://example.com/')).toBe('https://example.com/sub/assets/x.png');
  });
});

describe('levels as data', () => {
  it('has the original eight stages in order, all valid', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['Level_0_0', 'Level_0_1', 'Level_0_2', 'Level_0_3', 'Level_0_4', 'Level_0_5', 'Level_0_6', 'Level_0_7']);
    LEVELS.forEach((l, i) => expect(l.index).toBe(i));
    for (const def of LEVELS) expect(() => parseLevel(def)).not.toThrow();
  });

  it('keeps map data and art byte-identical to the 2014 originals', () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/legacy-asset-hashes.json'), 'utf8')) as {
      files: Record<string, { sha256: string }>;
    };
    const entries = Object.entries(fixture.files);
    expect(entries.length).toBeGreaterThanOrEqual(31);
    for (const [file, { sha256 }] of entries) {
      const hash = createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
      expect(hash, file).toBe(sha256);
    }
  });

  it('rejects malformed maps with a clear error', () => {
    const base = LEVELS[0]!;
    const withMap = (map: LevelDef['map']): LevelDef => ({ ...base, map });
    const clone = (): LevelDef['map'] => JSON.parse(JSON.stringify(base.map)) as LevelDef['map'];
    expect(() => parseLevel(withMap({ ...clone(), orientation: 'isometric' }))).toThrow(LevelValidationError);
    expect(() => parseLevel(withMap({ ...clone(), tilewidth: 16 }))).toThrow(/32x32/);
    const noTiles = clone();
    noTiles.layers = noTiles.layers.filter((l) => l.type !== 'tilelayer');
    expect(() => parseLevel(withMap(noTiles))).toThrow(/tile layer/);
    const noObjects = clone();
    noObjects.layers = noObjects.layers.filter((l) => l.type !== 'objectgroup');
    expect(() => parseLevel(withMap(noObjects))).toThrow(/object layer/);
    const badSize = clone();
    badSize.layers[0]!.data = [1, 2, 3];
    expect(() => parseLevel(withMap(badSize))).toThrow(/size/);
    const badGid = clone();
    badGid.layers[0]!.data![0] = 99;
    expect(() => parseLevel(withMap(badGid))).toThrow(/gid 99/);
    const bridge = clone();
    bridge.layers[0]!.data![0] = 20;
    expect(() => parseLevel(withMap(bridge))).toThrow(/gid 20/);
    const badObject = clone();
    badObject.layers.find((l) => l.objects)!.objects![0]!.gid = 77;
    expect(() => parseLevel(withMap(badObject))).toThrow(/object gid 77/);
  });
});

class StubPresenter implements Presenter {
  shown = 0;
  cleared = 0;
  events: SimEvent[] = [];
  showLevel(): void {
    this.shown++;
  }
  clearLevel(): void {
    this.cleared++;
  }
  handleEvents(events: SimEvent[]): void {
    this.events.push(...events);
  }
  render(): void {}
}

function readyController(): { c: GameController; p: StubPresenter } {
  const p = new StubPresenter();
  const c = new GameController(p);
  c.markReady();
  c.manual = true;
  return { c, p };
}

describe('GameController lifecycle', () => {
  it('cannot begin before assets are ready, or after an error', () => {
    const p = new StubPresenter();
    const c = new GameController(p);
    c.start();
    expect(c.phase).toBe('loading');
    c.markReady();
    c.markError();
    c.start();
    expect(c.phase).toBe('error');
  });

  it('builds a brand-new simulation on every start, restart and advance, discarding the previous one', () => {
    const { c, p } = readyController();
    c.start();
    const first = c.sim;
    c.step(200);
    c.tap(10, 10);
    c.restart();
    expect(c.sim).not.toBe(first);
    expect(c.sim!.tickCount).toBe(0);
    expect(p.shown).toBe(2);
    expect(p.cleared).toBe(2);
    expect(c.state.attempt).toBe(2);
  });

  it('restores edited tiles on restart (the original kept them)', () => {
    const { c } = readyController();
    c.begin(0);
    c.step(10);
    const sim = c.sim!;
    const gap = findGap(sim);
    expect(c.tap(gap.vx, gap.vy)).toBe(true);
    expect(c.sim!.editedTiles().length).toBe(1);
    c.restart();
    expect(c.sim!.editedTiles()).toEqual([]);
  });

  it('ten thousand restarts leave nothing behind', () => {
    const { c, p } = readyController();
    c.begin(2);
    for (let i = 0; i < 10_000; i++) c.restart();
    expect(p.shown).toBe(10_001);
    expect(p.cleared).toBe(10_001);
    expect(c.sim!.tickCount).toBe(0);
  });

  it('does not tick or accept taps while paused, and resumes where it left off', () => {
    const { c } = readyController();
    c.start();
    c.step(30);
    expect(c.pause()).toBe(true);
    const x = c.sim!.spriteX;
    c.step(60);
    expect(c.sim!.spriteX).toBe(x);
    expect(c.tap(100, 100)).toBe(false);
    expect(c.pause()).toBe(false);
    expect(c.resume()).toBe(true);
    c.step(30);
    expect(c.sim!.tickCount).toBe(60);
  });

  it('only advances after a win, and the last level has no next', () => {
    const { c } = readyController();
    c.begin(0);
    c.next();
    expect(c.levelIndex).toBe(0);
    const s = c.sim!;
    s.outcome = 'won';
    (c as unknown as { phase: string }).phase = 'won';
    c.next();
    expect(c.levelIndex).toBe(1);
    c.begin(7);
    (c as unknown as { phase: string }).phase = 'won';
    c.next();
    expect(c.levelIndex).toBe(7);
  });

  it('rejects unknown levels', () => {
    const { c } = readyController();
    expect(() => c.begin(8)).toThrow(RangeError);
    expect(() => c.begin(-1)).toThrow(RangeError);
    expect(() => c.begin(1.5)).toThrow(RangeError);
  });

  it('frame clock produces the same state at any refresh rate', () => {
    const states = [30, 60, 144].map((hz) => {
      const p = new StubPresenter();
      const c = new GameController(p);
      c.markReady();
      c.begin(0);
      let t = 0;
      c.frame(t);
      for (let i = 0; i < hz * 3; i++) {
        t += 1000 / hz;
        c.frame(t);
      }
      return c.sim!.tickCount;
    });
    for (const n of states) expect(Math.abs(n - 180)).toBeLessThanOrEqual(1);
  });
});

function findGap(sim: LevelSim): { vx: number; vy: number } {
  for (let y = 0; y < sim.grid.height; y++) {
    for (let x = 0; x < sim.grid.width; x++) {
      if (sim.grid.tileAt(x, y)?.index === 19) {
        const vx = x * 32 + 16 - sim.cameraX;
        const vy = y * 32 + 16 - sim.cameraY;
        if (vx >= 0 && vx < 448 && vy >= 0 && vy < 448) return { vx, vy };
      }
    }
  }
  throw new Error('no visible gap');
}

describe('simulation edge cases', () => {
  const fresh = (i: number): LevelSim => new LevelSim(parseLevel(LEVELS[i]!));

  it('ignores taps outside the map and non-finite coordinates', () => {
    const s = fresh(0);
    s.tick();
    expect(s.pointerDown(Number.NaN, 5)).toEqual({ edited: false, turned: false });
    expect(s.pointerDown(-50, -50)).toEqual({ edited: false, turned: false });
    expect(s.pointerDown(100000, 100000)).toEqual({ edited: false, turned: false });
    expect(s.editedTiles()).toEqual([]);
  });

  it('fills a gap once, one way: a second tap does nothing', () => {
    const s = fresh(0);
    s.tick();
    const g = findGap(s);
    expect(s.pointerDown(g.vx, g.vy).edited).toBe(true);
    expect(s.pointerDown(g.vx, g.vy).edited).toBe(false);
    expect(s.editedTiles()).toHaveLength(1);
  });

  it('taps just outside Willy\'s 64x64 frame do not turn him; just inside do', () => {
    const s = fresh(2);
    for (let i = 0; i < 40; i++) s.tick();
    const cx = s.spriteX - s.cameraX;
    const cy = s.spriteY - s.cameraY;
    const dir = s.willy.vx;
    expect(s.pointerDown(Math.floor(cx + 33), Math.floor(cy)).turned).toBe(false);
    expect(s.pointerDown(Math.floor(cx - 33), Math.floor(cy)).turned).toBe(false);
    expect(s.pointerDown(Math.floor(cx), Math.floor(cy - 33)).turned).toBe(false);
    expect(s.willy.vx).toBe(dir);
    expect(s.pointerDown(Math.floor(cx) + 31, Math.floor(cy) + 31).turned).toBe(true);
  });

  it('taps do nothing before Willy has started moving', () => {
    const s = fresh(0);
    s.tick();
    expect(s.pointerDown(s.spriteX - s.cameraX, s.spriteY - s.cameraY).turned).toBe(false);
  });

  it('death is reported exactly once however long the sim keeps running', () => {
    const s = fresh(0);
    const outcomes: SimEvent[] = [];
    for (let i = 0; i < 4000; i++) {
      s.tick();
      outcomes.push(...s.drainEvents().filter((e) => e.type === 'outcome'));
    }
    expect(outcomes.length).toBeLessThanOrEqual(1);
  });

  it('clones are independent', () => {
    const a = fresh(0);
    for (let i = 0; i < 20; i++) a.tick();
    const b = a.clone();
    const g = findGap(a);
    b.pointerDown(g.vx, g.vy);
    for (let i = 0; i < 50; i++) b.tick();
    expect(a.editedTiles()).toEqual([]);
    expect(a.tickCount).toBe(20);
    expect(b.editedTiles()).toHaveLength(1);
    const c = a.clone();
    for (let i = 0; i < 100; i++) {
      a.tick();
      c.tick();
    }
    expect(c.spriteX).toBe(a.spriteX);
    expect(c.spriteY).toBe(a.spriteY);
  });

  it('batching ticks differently gives identical results (time is only ticks)', () => {
    const a = fresh(1);
    const b = fresh(1);
    for (let i = 0; i < 600; i++) a.tick();
    for (let chunk = 0; chunk < 60; chunk++) for (let i = 0; i < 10; i++) b.tick();
    expect(b.spriteX).toBe(a.spriteX);
    expect(b.spriteY).toBe(a.spriteY);
    expect(b.cameraX).toBe(a.cameraX);
  });
});

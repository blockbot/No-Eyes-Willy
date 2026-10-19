/**
 * Breadth-first route search over the real level rules.
 *
 * It only ever uses the two verbs the player has: a tap on Willy (reverse direction) and a tap on an
 * editable gap tile (fill it, one way). The simulation is Markov apart from the tick counter, so states
 * are deduplicated exactly (no quantisation) and the first win found is the shortest in ticks for the
 * search's action set. Routes found here are only candidates: they are re-verified from scratch in the
 * unit tests, in the original Phaser 2 build and in the production build.
 *
 *   npx tsx tools/routes/solve.ts [levelIndex ...]   (writes routes/level-N.json)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { LEVELS } from '../../src/levels/manifest';
import { LevelSim } from '../../src/sim/level-sim';
import { parseLevel } from '../../src/sim/level';
import { TILE_EDITABLE, TILE_SIZE, VIEW_HEIGHT, VIEW_WIDTH } from '../../src/sim/constants';

/** Taps are never scheduled in the first few frames: the original's camera only snaps to Willy after its first update. */
export const FIRST_TAP_TICK = 6;

export interface RouteAction {
  tick: number;
  /** Tap position in world pixels (camera position at that tick plus the on-screen position). */
  worldX: number;
  worldY: number;
  /** Informational: what the tap is meant to do. */
  intent: 'reverse' | 'fill';
  tile?: [number, number];
}

export interface RouteFile {
  level: number;
  id: string;
  winTick: number;
  ticks: number;
  actions: RouteAction[];
}

interface Gap {
  tiles: Array<[number, number]>;
}

interface Node {
  sim: LevelSim;
  queue: Array<[number, number]>;
}

interface Parent {
  key: string | null;
  action: RouteAction | null;
}

const num = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(9));

function stateKey(sim: LevelSim, queue: ReadonlyArray<[number, number]>, edits: string): string {
  const w = sim.willy;
  return [
    num(sim.spriteX),
    num(sim.spriteY),
    num(w.vx),
    num(w.vy),
    num(w.x),
    num(w.y),
    sim.velocityX,
    sim.walking ? 1 : 0,
    sim.didWin ? 1 : 0,
    sim.isClimbing ? 1 : 0,
    sim.wasClimbing ? 1 : 0,
    Math.min(sim.ladderCheck, 1),
    num(sim.posX),
    sim.direction,
    Math.min(sim.wait, 1),
    Math.min(sim.endCheck, 1),
    sim.alive ? 1 : 0,
    sim.exists ? 1 : 0,
    sim.timerSignature(),
    Math.min(sim.tickCount, FIRST_TAP_TICK),
    edits,
    queue.map(([x, y]) => `${x},${y}`).join(';'),
  ].join('|');
}

function findGaps(sim: LevelSim): Gap[] {
  const gaps: Gap[] = [];
  for (let y = 0; y < sim.grid.height; y++) {
    let run: Array<[number, number]> = [];
    for (let x = 0; x <= sim.grid.width; x++) {
      if (sim.grid.tileAt(x, y)?.index === TILE_EDITABLE) run.push([x, y]);
      else {
        if (run.length) gaps.push({ tiles: run });
        run = [];
      }
    }
  }
  return gaps;
}

function tileVisible(sim: LevelSim, tx: number, ty: number): { vx: number; vy: number } | null {
  const vx = tx * TILE_SIZE + TILE_SIZE / 2 - sim.cameraX;
  const vy = ty * TILE_SIZE + TILE_SIZE / 2 - sim.cameraY;
  if (vx < 0 || vx >= VIEW_WIDTH || vy < 0 || vy >= VIEW_HEIGHT) return null;
  return { vx, vy };
}

/** A tap point on Willy's sprite that does not accidentally fill a gap tile under it. */
function willyTapPoint(sim: LevelSim): { vx: number; vy: number } | null {
  const cx = sim.spriteX - sim.cameraX;
  const cy = sim.spriteY - sim.cameraY;
  const offsets: Array<[number, number]> = [
    [0, 0],
    [0, -20],
    [0, 20],
    [-20, 0],
    [20, 0],
    [-20, -20],
    [20, -20],
    [-20, 20],
    [20, 20],
  ];
  for (const [dx, dy] of offsets) {
    const vx = Math.round(cx + dx);
    const vy = Math.round(cy + dy);
    if (vx < 0 || vx >= VIEW_WIDTH || vy < 0 || vy >= VIEW_HEIGHT) continue;
    const tile = sim.grid.tileAt(Math.floor((sim.cameraX + vx) / TILE_SIZE), Math.floor((sim.cameraY + vy) / TILE_SIZE));
    if (tile && tile.index === TILE_EDITABLE) continue;
    return { vx, vy };
  }
  return null;
}

export interface SolveOptions {
  maxTicks?: number;
  maxStates?: number;
  /** Maximum horizontal distance, in tiles, between Willy and the nearest tile of a gap he may start filling. */
  reach?: number;
  verbose?: boolean;
  /** Gap subset to fill as soon as it is within reach; undefined means the free (exhaustive) search. */
  fillSet?: ReadonlySet<number>;
}

export function gapCount(index: number): number {
  return findGaps(new LevelSim(parseLevel(LEVELS[index]!))).length;
}

export function solveLevel(index: number, opts: SolveOptions = {}): RouteFile | null {
  const def = LEVELS[index];
  if (!def) throw new Error(`no level ${index}`);
  const level = parseLevel(def);
  const maxTicks = opts.maxTicks ?? 9000;
  const maxStates = opts.maxStates ?? 1_500_000;
  const reach = opts.reach ?? 6;

  const root = new LevelSim(level);
  const gaps = findGaps(root);
  const gapOf = new Map<string, number>();
  gaps.forEach((g, i) => g.tiles.forEach(([x, y]) => gapOf.set(`${x},${y}`, i)));
  const editString = (sim: LevelSim): string => {
    let s = '';
    for (const g of gaps) s += g.tiles.every(([x, y]) => sim.grid.tileAt(x, y)?.index !== TILE_EDITABLE) ? '1' : g.tiles.some(([x, y]) => sim.grid.tileAt(x, y)?.index !== TILE_EDITABLE) ? 'p' : '0';
    return s;
  };

  const visited = new Map<string, Parent>();
  let frontier: Array<{ node: Node; key: string }> = [];
  const rootNode: Node = { sim: root, queue: [] };
  const rootKey = stateKey(root, [], editString(root));
  visited.set(rootKey, { key: null, action: null });
  frontier.push({ node: rootNode, key: rootKey });

  const consider = (parentKey: string, parent: Node, action: RouteAction | null, mutate: (sim: LevelSim) => Array<[number, number]>, next: Array<{ node: Node; key: string }>): string | 'win' | null => {
    const sim = parent.sim.clone();
    const queue = mutate(sim);
    sim.tick();
    if (sim.outcome === 'dead' || !sim.alive) return null;
    const key = stateKey(sim, queue, editString(sim));
    if (visited.has(key)) return null;
    visited.set(key, { key: parentKey, action });
    if (sim.outcome === 'won') return key;
    next.push({ node: { sim, queue }, key });
    return null;
  };

  const winRoute = (winKey: string): RouteFile => {
    const actions: RouteAction[] = [];
    let k: string | null = winKey;
    while (k) {
      const p: Parent = visited.get(k)!;
      if (p.action) actions.push(p.action);
      k = p.key;
    }
    actions.reverse();
    return { level: index, id: def.id, winTick: -1, ticks: -1, actions };
  };

  const startForced = (node: Node, key: string, results: Array<string | null>, next: Array<{ node: Node; key: string }>): boolean => {
    const sim = node.sim;
    const wtx = sim.spriteX / TILE_SIZE;
    const wty = sim.spriteY / TILE_SIZE;
    for (const gi of opts.fillSet!) {
      const g = gaps[gi]!;
      const open = g.tiles.filter(([x, y]) => sim.grid.tileAt(x, y)?.index === TILE_EDITABLE);
      if (open.length === 0) continue;
      const nearest = Math.min(...open.map(([x]) => Math.abs(x + 0.5 - wtx)));
      const dy = Math.min(...open.map(([, y]) => Math.abs(y + 0.5 - wty)));
      if (nearest > reach || dy > 6) continue;
      const ordered = open.slice().sort((a, b) => Math.abs(a[0] + 0.5 - wtx) - Math.abs(b[0] + 0.5 - wtx));
      const [fx, fy] = ordered[0]!;
      const vis = tileVisible(sim, fx, fy);
      if (!vis) continue;
      const action: RouteAction = { tick: sim.tickCount, worldX: sim.cameraX + vis.vx, worldY: sim.cameraY + vis.vy, intent: 'fill', tile: [fx, fy] };
      results.push(
        consider(key, node, action, (s) => {
          s.pointerDown(vis.vx, vis.vy);
          return ordered.slice(1);
        }, next),
      );
      return true;
    }
    return false;
  };

  for (let tick = 0; tick < maxTicks && frontier.length; tick++) {
    const next: Array<{ node: Node; key: string }> = [];
    for (const { node, key } of frontier) {
      const { sim, queue } = node;
      const results: Array<string | null> = [];
      const tickNow = sim.tickCount;

      if (queue.length) {
        const [tx, ty] = queue[0]!;
        const vis = tileVisible(sim, tx, ty);
        if (!vis) continue;
        const action: RouteAction = { tick: tickNow, worldX: sim.cameraX + vis.vx, worldY: sim.cameraY + vis.vy, intent: 'fill', tile: [tx, ty] };
        results.push(
          consider(key, node, action, (s) => {
            s.pointerDown(vis.vx, vis.vy);
            return queue.slice(1);
          }, next),
        );
      } else if (tickNow < FIRST_TAP_TICK) {
        results.push(consider(key, node, null, () => [], next));
      } else if (opts.fillSet && startForced(node, key, results, next)) {
        // a fill from the chosen subset is due; it is the only action this tick
      } else {
        results.push(consider(key, node, null, () => [], next));

        const wv = sim.willy.vx;
        if (wv === 100 || wv === -100) {
          const pt = willyTapPoint(sim);
          if (pt) {
            const action: RouteAction = { tick: tickNow, worldX: sim.cameraX + pt.vx, worldY: sim.cameraY + pt.vy, intent: 'reverse' };
            results.push(consider(key, node, action, (s) => (s.pointerDown(pt.vx, pt.vy), []), next));
          }
        }

        const wtx = sim.spriteX / TILE_SIZE;
        const wty = sim.spriteY / TILE_SIZE;
        if (!opts.fillSet) gaps.forEach((g) => {
          const open = g.tiles.filter(([x, y]) => sim.grid.tileAt(x, y)?.index === TILE_EDITABLE);
          if (open.length === 0) return;
          const nearest = Math.min(...open.map(([x]) => Math.abs(x + 0.5 - wtx)));
          const dy = Math.min(...open.map(([, y]) => Math.abs(y + 0.5 - wty)));
          if (nearest > reach || dy > 6) return;
          const ordered = open.slice().sort((a, b) => Math.abs(a[0] + 0.5 - wtx) - Math.abs(b[0] + 0.5 - wtx));
          const [fx, fy] = ordered[0]!;
          const vis = tileVisible(sim, fx, fy);
          if (!vis) return;
          const action: RouteAction = { tick: tickNow, worldX: sim.cameraX + vis.vx, worldY: sim.cameraY + vis.vy, intent: 'fill', tile: [fx, fy] };
          results.push(
            consider(key, node, action, (s) => {
              s.pointerDown(vis.vx, vis.vy);
              return ordered.slice(1);
            }, next),
          );
        });
      }

      const win = results.find((r) => r !== null);
      if (win) {
        const route = winRoute(win);
        const verify = replayRoute(index, route);
        route.winTick = verify.winTick;
        route.ticks = verify.winTick;
        return route;
      }
    }
    frontier = next;
    if (opts.verbose && tick % 500 === 0) console.error(`level ${index} tick ${tick} frontier ${frontier.length} visited ${visited.size}`);
    if (visited.size > maxStates) {
      console.error(`level ${index}: state limit reached at tick ${tick}`);
      return null;
    }
  }
  return null;
}

/** Applies a route to a fresh simulation (the same thing the unit tests and browser replay do) and returns the win tick. */
export function replayRoute(index: number, route: Pick<RouteFile, 'actions'>, extraTicks = 0): { winTick: number; sim: LevelSim } {
  const level = parseLevel(LEVELS[index]!);
  const sim = new LevelSim(level);
  let winTick = -1;
  const byTick = new Map<number, RouteAction[]>();
  for (const a of route.actions) byTick.set(a.tick, [...(byTick.get(a.tick) ?? []), a]);
  const last = Math.max(...route.actions.map((a) => a.tick), 0);
  for (let t = 0; t < last + 20000 && winTick < 0; t++) {
    for (const a of byTick.get(t) ?? []) sim.pointerDown(a.worldX - sim.cameraX, a.worldY - sim.cameraY);
    sim.tick();
    if (sim.outcome === 'won') winTick = t;
    if (sim.outcome === 'dead') break;
  }
  for (let t = 0; t < extraTicks; t++) sim.tick();
  return { winTick, sim };
}

export function solveWithSubsets(index: number, maxStates: number): { route: RouteFile; fillSet: number[] } | null {
  const n = gapCount(index);
  const masks = Array.from({ length: 1 << n }, (_, m) => m);
  const pop = (m: number): number => m.toString(2).replace(/0/g, '').length;
  masks.sort((a, b) => pop(b) - pop(a) || a - b);
  let tried = 0;
  for (const m of masks) {
    const fillSet = new Set<number>();
    for (let i = 0; i < n; i++) if (m & (1 << i)) fillSet.add(i);
    tried++;
    const route = solveLevel(index, { fillSet, maxStates, maxTicks: 6000 });
    if (route) {
      console.error(`level ${index}: subset ${[...fillSet].join(',')} after ${tried} tries`);
      return { route, fillSet: [...fillSet] };
    }
  }
  return null;
}

if (process.argv[1] && process.argv[1].endsWith('solve.ts')) {
  const only = process.argv.slice(2).map(Number);
  mkdirSync('routes', { recursive: true });
  for (const def of LEVELS) {
    if (only.length && !only.includes(def.index)) continue;
    const t0 = Date.now();
    let found = solveWithSubsets(def.index, 400_000);
    if (!found) {
      console.error(`level ${def.index}: subset search failed, trying the free search`);
      const route = solveLevel(def.index, { maxStates: 5_000_000 });
      if (route) found = { route, fillSet: [] };
    }
    if (!found) {
      console.log(`level ${def.index}: NO ROUTE FOUND`);
      continue;
    }
    const { route } = found;
    writeFileSync(`routes/level-${def.index}.json`, JSON.stringify(route, null, 1) + '\n');
    console.log(`level ${def.index}: win at tick ${route.winTick}, ${route.actions.length} taps (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
}

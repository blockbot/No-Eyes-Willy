/**
 * Authoritative gameplay state for one attempt at one level.
 *
 * This is a line-by-line behavioural port of the original per-level `update` function and the
 * `Setup` helpers (js/game.js, js/levels.js), running on fixed 1/60 s ticks. It owns every piece of
 * gameplay state and every delayed callback, so discarding the instance discards all of them.
 * It has no knowledge of Phaser, DOM, audio or time sources.
 */
import { Body, TileGrid, bodyPreUpdate, collideBodies, collideTiles, intersects } from './arcade';
import type { Bounds } from './arcade';
import {
  DANCE_DELAY_TICKS,
  DEATH_DELAY_TICKS,
  DT,
  START_DELAY_TICKS,
  TILE_BRIDGE,
  TILE_EDITABLE,
  TILE_SIZE,
  TILE_SOLID_FIRST,
  TILE_SOLID_LAST,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  WALK_SPEED,
  WILLY_BODY_H,
  WILLY_BODY_W,
  WILLY_FRAME,
  WILLY_GRAVITY,
} from './constants';
import type { ParsedLevel } from './level';

export type SoundName = 'explosion' | 'select' | 'death' | 'splash' | 'powerup';
export type AnimName = 'walk' | 'climb' | 'dance' | 'dead';
export type Outcome = 'playing' | 'dead' | 'won';

export type SimEvent =
  | { type: 'sound'; name: SoundName }
  | { type: 'explosion' }
  | { type: 'blood'; x: number; y: number }
  | { type: 'marthaSplash' }
  | { type: 'marthaIdle' }
  | { type: 'outcome'; outcome: 'dead' | 'won' }
  | { type: 'tileEdited'; tx: number; ty: number };

export interface PointerResult {
  edited: boolean;
  turned: boolean;
}

type TimerKind = 'start' | 'death' | 'dance';

interface Timer {
  due: number;
  kind: TimerKind;
}

export class LevelSim {
  readonly level: ParsedLevel;
  grid: TileGrid;
  readonly willy: Body;
  readonly martha: Body;
  readonly ladders: Body[];
  readonly spikes: Body[];
  private readonly bounds: Bounds;

  /** Willy's sprite centre. The body is a 32x64 box centred on it. */
  spriteX: number;
  spriteY: number;
  scaleX: -1 | 1 = 1;
  alive = true;
  /** False once the sprite has been killed; it then neither moves nor receives taps. */
  exists = true;
  anim: AnimName = 'walk';
  animStartTick = 0;
  marthaSplashTick: number | null = null;
  marthaIdle = false;

  velocityX = 0;
  walking = true;
  didWin = false;
  isClimbing = false;
  wasClimbing = false;
  ladderCheck = 0;
  posX = 0;
  direction: 'left' | 'right' = 'left';
  endCheck = 0;
  wait = 0;
  outcome: Outcome = 'playing';
  /** Tick on which the outcome was reached, for UI timing. */
  outcomeTick = -1;

  cameraX = 0;
  cameraY = 0;
  tickCount = 0;

  private gridShared = false;
  private timers: Timer[] = [];
  private deathScheduled = false;
  private events: SimEvent[] = [];

  constructor(level: ParsedLevel, template?: LevelSim) {
    this.level = level;
    this.bounds = { x: 0, y: 0, right: level.widthPx, bottom: level.heightPx };
    if (template) {
      this.grid = template.grid;
      this.gridShared = true;
      this.willy = template.willy.clone();
      this.martha = template.martha;
      this.ladders = template.ladders;
      this.spikes = template.spikes;
      this.spriteX = template.spriteX;
      this.spriteY = template.spriteY;
      return;
    }
    this.grid = new TileGrid(level.tiles, level.width, level.height);
    this.grid.setCollisionBetween(TILE_SOLID_FIRST, TILE_SOLID_LAST);
    this.grid.setCollision(TILE_BRIDGE);

    this.spriteX = level.willy.x;
    this.spriteY = level.willy.y;
    this.willy = new Body(this.spriteX - WILLY_BODY_W / 2, this.spriteY - WILLY_BODY_H / 2, WILLY_BODY_W, WILLY_BODY_H);
    this.willy.gravityY = WILLY_GRAVITY;
    this.willy.collideWorldBounds = true;
    this.willy.checkCollision.up = false;

    this.martha = new Body(level.martha.x, level.martha.y, level.martha.w, level.martha.h);
    this.martha.immovable = true;

    this.ladders = level.ladders.map((r) => new Body(r.x, r.y, r.w, r.h));
    this.spikes = level.spikes.map((r) => new Body(r.x, r.y, r.w, r.h));

    this.updateCamera();
  }

  /**
   * Independent copy of the full simulation state, used by the route search and by tests. The tile grid is
   * shared copy-on-write, because only a world edit ever mutates it.
   */
  clone(): LevelSim {
    this.gridShared = true;
    const copy = new LevelSim(this.level, this);
    copy.spriteX = this.spriteX;
    copy.spriteY = this.spriteY;
    copy.scaleX = this.scaleX;
    copy.alive = this.alive;
    copy.exists = this.exists;
    copy.anim = this.anim;
    copy.animStartTick = this.animStartTick;
    copy.marthaSplashTick = this.marthaSplashTick;
    copy.marthaIdle = this.marthaIdle;
    copy.velocityX = this.velocityX;
    copy.walking = this.walking;
    copy.didWin = this.didWin;
    copy.isClimbing = this.isClimbing;
    copy.wasClimbing = this.wasClimbing;
    copy.ladderCheck = this.ladderCheck;
    copy.posX = this.posX;
    copy.direction = this.direction;
    copy.endCheck = this.endCheck;
    copy.wait = this.wait;
    copy.outcome = this.outcome;
    copy.outcomeTick = this.outcomeTick;
    copy.cameraX = this.cameraX;
    copy.cameraY = this.cameraY;
    copy.tickCount = this.tickCount;
    copy.timers = this.timers.map((t) => ({ ...t }));
    copy.deathScheduled = this.deathScheduled;
    copy.events = this.events.slice();
    return copy;
  }

  /** Pending delayed callbacks relative to now, for state de-duplication in tools. */
  timerSignature(): string {
    return this.timers.map((t) => `${t.kind}${t.due - this.tickCount}`).sort().join(',');
  }

  private ownGrid(): void {
    if (this.gridShared) {
      this.grid = this.grid.clone();
      this.gridShared = false;
    }
  }

  /** Drains events produced since the last call. */
  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Advances the simulation by exactly one fixed step. */
  tick(): void {
    if (this.exists) {
      if (this.tickCount > 0) this.resyncBodyToSprite();
      this.willy.prevX = this.willy.x;
      this.willy.prevY = this.willy.y;
      bodyPreUpdate(this.willy, DT, this.bounds);
    }
    this.update();
    if (this.exists) {
      this.spriteX += this.willy.deltaX();
      this.spriteY += this.willy.deltaY();
    }
    this.updateCamera();
    this.fireTimers();
    this.tickCount++;
  }

  /**
   * Phaser 2 rebuilt the body position every frame from the sprite's camera-relative world transform,
   * which rounds slightly differently from simply keeping the previous value. When Willy lands exactly
   * on a tile edge (frequent, because 100 u/s at 60 Hz steps by 5/3 px) that rounding decides whether the
   * tile is touched on this tick or the next, so the same expression is reproduced for tick-exact parity.
   * Writing sprite.x/y in the post-update phase also made Phaser reset the body's "previous" position to
   * this recomputed start position on the following frame, so per-frame deltas are measured from it.
   */
  private resyncBodyToSprite(): void {
    const cx = this.cameraX;
    const cy = this.cameraY;
    this.willy.x = cx + (this.spriteX - cx) - WILLY_BODY_W / 2;
    this.willy.y = cy + (this.spriteY - cy) - WILLY_BODY_H / 2;
  }

  private update(): void {
    const w = this.willy;
    if (this.wait < 1) {
      this.scaleX = this.level.willy.facing;
      this.events.push({ type: 'explosion' }, { type: 'sound', name: 'explosion' });
      this.schedule(START_DELAY_TICKS, 'start');
    }
    this.wait++;

    if (this.exists) {
      if (collideBodies(w, this.martha)) {
        this.didWin = true;
        this.walking = false;
      }
      collideTiles(w, this.grid);
      for (const ladder of this.ladders) if (intersects(w, ladder)) this.climbLadder();
      for (const spike of this.spikes) if (intersects(w, spike)) this.death();
    }

    w.vx = this.velocityX;

    if (this.walking) this.setAnim('walk');

    if (w.blocked.left) this.velocityX = WALK_SPEED;
    else if (w.blocked.right) this.velocityX = -WALK_SPEED;

    if (this.velocityX === -WALK_SPEED) this.scaleX = -1;
    else if (this.velocityX === WALK_SPEED) this.scaleX = 1;

    this.isClimbing = this.exists && this.ladders.some((l) => intersects(w, l));
    if (!this.isClimbing) this.climbingFinish();

    if (this.didWin) this.endScreen();

    if (!this.alive) {
      this.setAnim('dead');
      this.velocityX = 0;
      w.vy = 100;
    }
  }

  private setAnim(name: AnimName): void {
    if (this.anim !== name) {
      this.anim = name;
      this.animStartTick = this.tickCount;
    }
  }

  private climbLadder(): void {
    const w = this.willy;
    if (this.ladderCheck < 1) {
      this.posX = w.x;
      this.direction = this.velocityX === -WALK_SPEED ? 'left' : 'right';
    }
    this.ladderCheck++;
    const climb = (): void => {
      this.velocityX = 0;
      w.vy = -100;
      this.wasClimbing = true;
      this.walking = false;
      this.setAnim('climb');
    };
    if (w.x <= this.posX - TILE_SIZE && this.direction === 'left') climb();
    else if (w.x >= this.posX + TILE_SIZE && this.direction === 'right') climb();
  }

  private climbingFinish(): void {
    if (this.wasClimbing) {
      this.wasClimbing = false;
      this.velocityX = -WALK_SPEED;
      this.ladderCheck = 0;
      this.walking = true;
    }
  }

  private death(): void {
    this.alive = false;
    if (this.deathScheduled) return;
    this.deathScheduled = true;
    this.schedule(DEATH_DELAY_TICKS, 'death');
  }

  private endScreen(): void {
    if (this.endCheck < 1) {
      if (!this.alive) {
        this.events.push({ type: 'sound', name: 'death' }, { type: 'outcome', outcome: 'dead' });
        this.outcome = 'dead';
      } else {
        this.marthaSplashTick = this.tickCount;
        this.events.push({ type: 'marthaSplash' }, { type: 'sound', name: 'splash' }, { type: 'outcome', outcome: 'won' });
        this.outcome = 'won';
        this.schedule(DANCE_DELAY_TICKS, 'dance');
      }
      this.outcomeTick = this.tickCount;
    }
    this.endCheck++;
  }

  private schedule(delayTicks: number, kind: TimerKind): void {
    this.timers.push({ due: this.tickCount + delayTicks, kind });
  }

  private fireTimers(): void {
    if (this.timers.length === 0) return;
    const due = this.timers.filter((t) => t.due <= this.tickCount);
    this.timers = this.timers.filter((t) => t.due > this.tickCount);
    for (const t of due) {
      if (t.kind === 'start') {
        this.velocityX = this.level.willy.facing * WALK_SPEED;
      } else if (t.kind === 'death') {
        this.events.push({ type: 'blood', x: this.spriteX, y: this.spriteY });
        this.exists = false;
        this.alive = false;
        this.endScreen();
      } else {
        this.marthaIdle = true;
        this.events.push({ type: 'marthaIdle' }, { type: 'sound', name: 'powerup' });
        this.setAnim('dance');
      }
    }
  }

  private updateCamera(): void {
    let x = Math.round(this.spriteX - VIEW_WIDTH / 2);
    let y = Math.round(this.spriteY - VIEW_HEIGHT / 2);
    if (x <= 0) x = 0;
    if (x + VIEW_WIDTH >= this.level.widthPx) x = this.level.widthPx - VIEW_WIDTH;
    if (y <= 0) y = 0;
    if (y + VIEW_HEIGHT >= this.level.heightPx) y = this.level.heightPx - VIEW_HEIGHT;
    this.cameraX = Math.floor(x);
    this.cameraY = Math.floor(y);
  }

  /**
   * A tap or click at a position in the camera view (0..448 on both axes). Applies, in the original
   * order, the world-edit action (empty slot to bridge, one way) and the "tap Willy" action (reverse
   * direction). The hit area for Willy is his whole 64x64 sprite frame (not the 32x64 body), exclusive
   * of its border, as in the original input system.
   */
  pointerDown(viewX: number, viewY: number): PointerResult {
    const result: PointerResult = { edited: false, turned: false };
    if (!Number.isFinite(viewX) || !Number.isFinite(viewY)) return result;

    const worldX = this.cameraX + viewX;
    const worldY = this.cameraY + viewY;
    const tx = Math.floor(worldX / TILE_SIZE);
    const ty = Math.floor(worldY / TILE_SIZE);
    const tile = this.grid.tileAt(tx, ty);
    if (tile && tile.index === TILE_EDITABLE) {
      this.ownGrid();
      this.grid.putTile(TILE_BRIDGE, tx, ty);
      this.events.push({ type: 'sound', name: 'select' }, { type: 'tileEdited', tx, ty });
      result.edited = true;
    }

    if (this.exists) {
      const half = WILLY_FRAME / 2;
      const localX = viewX - (this.spriteX - this.cameraX);
      const localY = viewY - (this.spriteY - this.cameraY);
      if (localX > -half && localX < half && localY > -half && localY < half) {
        if (this.willy.vx === -WALK_SPEED) {
          this.velocityX = WALK_SPEED;
          result.turned = true;
        } else if (this.willy.vx === WALK_SPEED) {
          this.velocityX = -WALK_SPEED;
          result.turned = true;
        }
      }
    }
    return result;
  }

  /** Coordinates of every tile currently converted to a bridge, for tests and traces. */
  editedTiles(): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        if (this.grid.tileAt(x, y)?.index === TILE_BRIDGE) out.push([x, y]);
      }
    }
    return out;
  }
}

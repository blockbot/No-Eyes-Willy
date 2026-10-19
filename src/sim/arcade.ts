/**
 * Minimal, explicit port of the parts of Phaser 2.0.3 Arcade physics and Tilemap that the original
 * game exercised. The original gameplay feel (collision push-out order, tile-face rules, bias values)
 * lives in the engine, so it is reproduced here instead of relying on a newer engine's physics.
 * Everything below is renderer-free and deterministic.
 */
import { OVERLAP_BIAS, TILE_BIAS, TILE_SIZE } from './constants';

export interface Tile {
  index: number;
  x: number;
  y: number;
  collideLeft: boolean;
  collideRight: boolean;
  collideUp: boolean;
  collideDown: boolean;
  faceTop: boolean;
  faceBottom: boolean;
  faceLeft: boolean;
  faceRight: boolean;
}

const collides = (t: Tile): boolean => t.collideLeft || t.collideRight || t.collideUp || t.collideDown;

export class TileGrid {
  readonly width: number;
  readonly height: number;
  readonly data: Array<Array<Tile | null>>;
  private readonly collideIndexes: number[] = [];

  constructor(gids: readonly number[], width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = [];
    for (let y = 0; y < height; y++) {
      const row: Array<Tile | null> = [];
      for (let x = 0; x < width; x++) {
        const gid = gids[y * width + x] ?? 0;
        row.push(
          gid === 0
            ? null
            : {
                index: gid,
                x,
                y,
                collideLeft: false,
                collideRight: false,
                collideUp: false,
                collideDown: false,
                faceTop: false,
                faceBottom: false,
                faceLeft: false,
                faceRight: false,
              },
        );
      }
      this.data.push(row);
    }
  }

  get widthPx(): number {
    return this.width * TILE_SIZE;
  }
  get heightPx(): number {
    return this.height * TILE_SIZE;
  }

  tileAt(x: number, y: number): Tile | null {
    return this.data[y]?.[x] ?? null;
  }

  setCollisionBetween(start: number, stop: number): void {
    for (let index = start; index <= stop; index++) this.setCollisionByIndex(index, false);
    this.calculateFaces();
  }

  setCollision(index: number): void {
    this.setCollisionByIndex(index, true);
  }

  private setCollisionByIndex(index: number, recalculate: boolean): void {
    this.collideIndexes.push(index);
    for (const row of this.data) {
      for (const tile of row) {
        if (tile && tile.index === index) {
          tile.collideLeft = tile.collideRight = tile.collideUp = tile.collideDown = true;
          tile.faceTop = tile.faceBottom = tile.faceLeft = tile.faceRight = true;
        }
      }
    }
    if (recalculate) this.calculateFaces();
  }

  /** Replaces the index of an existing tile (Phaser's putTile on an occupied cell) and refreshes edge flags. */
  putTile(index: number, x: number, y: number): Tile | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    const tile = this.data[y]?.[x];
    if (!tile) return null;
    tile.index = index;
    if (this.collideIndexes.includes(index)) {
      tile.collideLeft = tile.collideRight = tile.collideUp = tile.collideDown = true;
    } else {
      tile.collideLeft = tile.collideRight = tile.collideUp = tile.collideDown = false;
      tile.faceTop = tile.faceBottom = tile.faceLeft = tile.faceRight = false;
    }
    this.calculateFaces();
    return tile;
  }

  calculateFaces(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.data[y]?.[x];
        if (!tile) continue;
        const above = y > 0 ? this.data[y - 1]?.[x] : null;
        const below = y < this.height - 1 ? this.data[y + 1]?.[x] : null;
        const left = x > 0 ? this.data[y]?.[x - 1] : null;
        const right = x < this.width - 1 ? this.data[y]?.[x + 1] : null;
        if (collides(tile)) {
          tile.faceTop = tile.faceBottom = tile.faceLeft = tile.faceRight = true;
        }
        if (above && collides(above)) tile.faceTop = false;
        if (below && collides(below)) tile.faceBottom = false;
        if (left && collides(left)) tile.faceLeft = false;
        if (right && collides(right)) tile.faceRight = false;
      }
    }
  }

  /** Tiles overlapping a pixel rectangle, in the original row-major order (including its one-tile overscan). */
  getTiles(px: number, py: number, w: number, h: number): Tile[] {
    const fix = (v: number): number => (v < 0 ? 0 : v);
    const x = fix(px);
    const y = fix(py);
    if (w > this.widthPx) w = this.widthPx;
    if (h > this.heightPx) h = this.heightPx;
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    const tw = (Math.ceil(w / TILE_SIZE) * TILE_SIZE + TILE_SIZE) / TILE_SIZE;
    const th = (Math.ceil(h / TILE_SIZE) * TILE_SIZE + TILE_SIZE) / TILE_SIZE;
    const out: Tile[] = [];
    for (let wy = ty; wy < ty + th; wy++) {
      for (let wx = tx; wx < tx + tw; wx++) {
        const tile = this.data[wy]?.[wx];
        if (tile) out.push(tile);
      }
    }
    return out;
  }
}

export interface Bounds {
  x: number;
  y: number;
  right: number;
  bottom: number;
}

export interface Flags4 {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export class Body {
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  readonly width: number;
  readonly height: number;
  gravityY = 0;
  immovable = false;
  collideWorldBounds = false;
  readonly checkCollision: Flags4 = { left: true, right: true, up: true, down: true };
  readonly blocked: Flags4 = { left: false, right: false, up: false, down: false };

  constructor(x: number, y: number, width: number, height: number) {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.width = width;
    this.height = height;
  }

  get right(): number {
    return this.x + this.width;
  }
  get bottom(): number {
    return this.y + this.height;
  }
  deltaX(): number {
    return this.x - this.prevX;
  }
  deltaY(): number {
    return this.y - this.prevY;
  }
}

const MAX_VELOCITY = 10000;

/** Body.preUpdate: reset contact flags, integrate gravity-driven velocity, move, clamp to world bounds. */
export function bodyPreUpdate(body: Body, dt: number, bounds: Bounds): void {
  body.blocked.left = body.blocked.right = body.blocked.up = body.blocked.down = false;
  let vy = body.vy + body.gravityY * dt;
  if (vy > MAX_VELOCITY) vy = MAX_VELOCITY;
  else if (vy < -MAX_VELOCITY) vy = -MAX_VELOCITY;
  body.vy = vy;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  if (body.collideWorldBounds) {
    if (body.x < bounds.x) {
      body.x = bounds.x;
      body.vx *= -0;
      body.blocked.left = true;
    } else if (body.right > bounds.right) {
      body.x = bounds.right - body.width;
      body.vx *= -0;
      body.blocked.right = true;
    }
    if (body.y < bounds.y) {
      body.y = bounds.y;
      body.vy *= -0;
      body.blocked.up = true;
    } else if (body.bottom > bounds.bottom) {
      body.y = bounds.bottom - body.height;
      body.vy *= -0;
      body.blocked.down = true;
    }
  }
}

export function intersects(a: Body, b: Body): boolean {
  if (a.right <= b.x) return false;
  if (a.bottom <= b.y) return false;
  if (a.x >= b.right) return false;
  if (a.y >= b.bottom) return false;
  return true;
}

const abs = Math.abs;

function separateX(b1: Body, b2: Body): boolean {
  if (b1.immovable && b2.immovable) return false;
  let overlap = 0;
  if (intersects(b1, b2)) {
    const maxOverlap = abs(b1.deltaX()) + abs(b2.deltaX()) + OVERLAP_BIAS;
    if (b1.deltaX() === 0 && b2.deltaX() === 0) {
      /* embedded: no separation */
    } else if (b1.deltaX() > b2.deltaX()) {
      overlap = b1.right - b2.x;
      if (overlap > maxOverlap || !b1.checkCollision.right || !b2.checkCollision.left) overlap = 0;
    } else if (b1.deltaX() < b2.deltaX()) {
      overlap = b1.x - b2.width - b2.x;
      if (-overlap > maxOverlap || !b1.checkCollision.left || !b2.checkCollision.right) overlap = 0;
    }
    if (overlap !== 0) {
      const v1 = b1.vx;
      const v2 = b2.vx;
      if (!b1.immovable && b2.immovable) {
        b1.x = b1.x - overlap;
        b1.vx = v2 - v1 * 0;
      } else if (!b2.immovable && b1.immovable) {
        b2.x += overlap;
        b2.vx = v1 - v2 * 0;
      }
      return true;
    }
  }
  return false;
}

function separateY(b1: Body, b2: Body): boolean {
  if (b1.immovable && b2.immovable) return false;
  let overlap = 0;
  if (intersects(b1, b2)) {
    const maxOverlap = abs(b1.deltaY()) + abs(b2.deltaY()) + OVERLAP_BIAS;
    if (b1.deltaY() === 0 && b2.deltaY() === 0) {
      /* embedded: no separation */
    } else if (b1.deltaY() > b2.deltaY()) {
      overlap = b1.bottom - b2.y;
      if (overlap > maxOverlap || !b1.checkCollision.down || !b2.checkCollision.up) overlap = 0;
    } else if (b1.deltaY() < b2.deltaY()) {
      overlap = b1.y - b2.bottom;
      if (-overlap > maxOverlap || !b1.checkCollision.up || !b2.checkCollision.down) overlap = 0;
    }
    if (overlap !== 0) {
      const v1 = b1.vy;
      const v2 = b2.vy;
      if (!b1.immovable && b2.immovable) {
        b1.y = b1.y - overlap;
        b1.vy = v2 - v1 * 0;
        b1.x += b2.x - b2.prevX;
      } else if (!b2.immovable && b1.immovable) {
        b2.y += overlap;
        b2.vy = v1 - v2 * 0;
        b2.x += b1.x - b1.prevX;
      }
      return true;
    }
  }
  return false;
}

/** Body versus body (Willy versus Martha). Gravity is vertical, so the Y axis is tried first. */
export function collideBodies(b1: Body, b2: Body): boolean {
  if (!intersects(b1, b2)) return false;
  return separateY(b1, b2) || separateX(b1, b2);
}

function tileIntersects(tile: Tile, x: number, y: number, right: number, bottom: number): boolean {
  const wx = tile.x * TILE_SIZE;
  const wy = tile.y * TILE_SIZE;
  if (right <= wx) return false;
  if (bottom <= wy) return false;
  if (x >= wx + TILE_SIZE) return false;
  if (y >= wy + TILE_SIZE) return false;
  return true;
}

function tileCheckX(body: Body, tile: Tile): number {
  let ox = 0;
  const wx = tile.x * TILE_SIZE;
  if (body.deltaX() < 0 && !body.blocked.left && tile.collideRight && body.checkCollision.left) {
    if (tile.faceRight && body.x < wx + TILE_SIZE) {
      ox = body.x - (wx + TILE_SIZE);
      if (ox < -TILE_BIAS) ox = 0;
    }
  } else if (body.deltaX() > 0 && !body.blocked.right && tile.collideLeft && body.checkCollision.right) {
    if (tile.faceLeft && body.right > wx) {
      ox = body.right - wx;
      if (ox > TILE_BIAS) ox = 0;
    }
  }
  if (ox !== 0) {
    if (ox < 0) body.blocked.left = true;
    else if (ox > 0) body.blocked.right = true;
    body.x -= ox;
    body.vx = 0;
  }
  return ox;
}

function tileCheckY(body: Body, tile: Tile): number {
  let oy = 0;
  const wy = tile.y * TILE_SIZE;
  if (body.deltaY() < 0 && !body.blocked.up && tile.collideDown && body.checkCollision.up) {
    if (tile.faceBottom && body.y < wy + TILE_SIZE) {
      oy = body.y - (wy + TILE_SIZE);
      if (oy < -TILE_BIAS) oy = 0;
    }
  } else if (body.deltaY() > 0 && !body.blocked.down && tile.collideUp && body.checkCollision.down) {
    if (tile.faceTop && body.bottom > wy) {
      oy = body.bottom - wy;
      if (oy > TILE_BIAS) oy = 0;
    }
  }
  if (oy !== 0) {
    if (oy < 0) body.blocked.up = true;
    else if (oy > 0) body.blocked.down = true;
    body.y -= oy;
    body.vy = 0;
  }
  return oy;
}

function separateTile(body: Body, tile: Tile): boolean {
  if (!tileIntersects(tile, body.x, body.y, body.right, body.bottom)) return false;
  if (!tile.faceLeft && !tile.faceRight && !tile.faceTop && !tile.faceBottom) return false;

  let ox = 0;
  let oy = 0;
  let minX = 0;
  let minY = 1;
  if (abs(body.deltaX()) > abs(body.deltaY())) minX = -1;
  else if (abs(body.deltaX()) < abs(body.deltaY())) minY = -1;

  if (body.deltaX() !== 0 && body.deltaY() !== 0 && (tile.faceLeft || tile.faceRight) && (tile.faceTop || tile.faceBottom)) {
    const wx = tile.x * TILE_SIZE;
    const wy = tile.y * TILE_SIZE;
    minX = Math.min(abs(body.x - (wx + TILE_SIZE)), abs(body.right - wx));
    minY = Math.min(abs(body.y - (wy + TILE_SIZE)), abs(body.bottom - wy));
  }

  if (minX < minY) {
    if (tile.faceLeft || tile.faceRight) {
      ox = tileCheckX(body, tile);
      if (ox !== 0 && !tileIntersects(tile, body.x, body.y, body.right, body.bottom)) return true;
    }
    if (tile.faceTop || tile.faceBottom) oy = tileCheckY(body, tile);
  } else {
    if (tile.faceTop || tile.faceBottom) {
      oy = tileCheckY(body, tile);
      if (oy !== 0 && !tileIntersects(tile, body.x, body.y, body.right, body.bottom)) return true;
    }
    if (tile.faceLeft || tile.faceRight) ox = tileCheckX(body, tile);
  }
  return ox !== 0 || oy !== 0;
}

/** Body versus tile layer; tiles are processed in the original order and the body is pushed out as it goes. */
export function collideTiles(body: Body, grid: TileGrid): void {
  const tiles = grid.getTiles(body.x, body.y, body.width, body.height);
  for (const tile of tiles) separateTile(body, tile);
}

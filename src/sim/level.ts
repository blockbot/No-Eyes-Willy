import {
  OBJECT_LADDER,
  OBJECT_SPIKES,
  OBJECT_SIZE,
  TILE_BRIDGE,
  TILE_EDITABLE,
  TILE_SIZE,
  TILE_SOLID_FIRST,
  TILE_SOLID_LAST,
} from './constants';

/** Subset of the Tiled JSON the game relies on. */
export interface TiledObject {
  gid: number;
  x: number;
  y: number;
  visible: boolean;
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  orientation: string;
  layers: Array<{
    name: string;
    type: string;
    data?: number[];
    objects?: TiledObject[];
  }>;
}

export interface Placement {
  /** Sprite centre in world pixels (anchor 0.5) or top-left for an unanchored sprite. */
  x: number;
  y: number;
}

export interface LevelDef {
  id: string;
  /** Position in the campaign, 0-based. */
  index: number;
  title: string;
  map: TiledMap;
  /** Martha's sprite position, whether her sprite is anchored at its centre, and whether it is mirrored. */
  martha: { x: (w: number, h: number) => number; y: (w: number, h: number) => number; anchored: boolean; flipped: boolean };
  willy: { x: (w: number, h: number) => number; y: (w: number, h: number) => number; facing: -1 | 1 };
  explosion: { x: (w: number, h: number) => number; y: (w: number, h: number) => number };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ParsedLevel {
  id: string;
  index: number;
  width: number;
  height: number;
  widthPx: number;
  heightPx: number;
  /** Row-major tile gids, 0 = empty. */
  tiles: number[];
  /** Hazard and ladder boxes in world pixels (Tiled y is bottom-left, converted by the sprite height). */
  ladders: Rect[];
  spikes: Rect[];
  martha: Rect & { sprite: Placement };
  willy: { x: number; y: number; facing: -1 | 1 };
  explosion: Placement;
  marthaFlipped: boolean;
  marthaAnchored: boolean;
}

export class LevelValidationError extends Error {}

const TILE_LAYER = 'Tile Layer 1';
const OBJECT_LAYER = 'Object Layer 1';

/** Validates a Tiled map and converts it to the data the simulation consumes. Throws on anything unexpected. */
export function parseLevel(def: LevelDef): ParsedLevel {
  const { map } = def;
  const fail = (msg: string): never => {
    throw new LevelValidationError(`${def.id}: ${msg}`);
  };
  if (map.orientation !== 'orthogonal') fail(`unsupported orientation ${map.orientation}`);
  if (map.tilewidth !== TILE_SIZE || map.tileheight !== TILE_SIZE) fail('tiles must be 32x32');
  const tileLayer = map.layers.find((l) => l.name === TILE_LAYER && l.type === 'tilelayer');
  const objLayer = map.layers.find((l) => l.name === OBJECT_LAYER && l.type === 'objectgroup');
  if (!tileLayer?.data) return fail(`missing tile layer "${TILE_LAYER}"`);
  if (!objLayer?.objects) return fail(`missing object layer "${OBJECT_LAYER}"`);
  const { width, height } = map;
  if (width < 1 || height < 1) fail('empty map');
  if (tileLayer.data.length !== width * height) fail('tile layer size does not match map size');
  for (const gid of tileLayer.data) {
    const known = gid === 0 || (gid >= TILE_SOLID_FIRST && gid <= TILE_SOLID_LAST) || gid === TILE_EDITABLE;
    if (!known) fail(`unsupported tile gid ${gid}`);
    if (gid === TILE_BRIDGE) fail('bridge tile must only appear through play');
  }
  const ladders: Rect[] = [];
  const spikes: Rect[] = [];
  for (const o of objLayer.objects) {
    const box: Rect = { x: o.x, y: o.y - OBJECT_SIZE, w: OBJECT_SIZE, h: OBJECT_SIZE };
    if (o.gid === OBJECT_LADDER) ladders.push(box);
    else if (o.gid === OBJECT_SPIKES) spikes.push(box);
    else fail(`unsupported object gid ${o.gid}`);
  }
  const widthPx = width * TILE_SIZE;
  const heightPx = height * TILE_SIZE;
  const marthaX = def.martha.x(widthPx, heightPx);
  const marthaY = def.martha.y(widthPx, heightPx);
  const half = def.martha.anchored ? 32 : 0;
  return {
    id: def.id,
    index: def.index,
    width,
    height,
    widthPx,
    heightPx,
    tiles: tileLayer.data.slice(),
    ladders,
    spikes,
    martha: { x: marthaX - half, y: marthaY - half, w: 64, h: 64, sprite: { x: marthaX, y: marthaY } },
    willy: { x: def.willy.x(widthPx, heightPx), y: def.willy.y(widthPx, heightPx), facing: def.willy.facing },
    explosion: { x: def.explosion.x(widthPx, heightPx), y: def.explosion.y(widthPx, heightPx) },
    marthaFlipped: def.martha.flipped,
    marthaAnchored: def.martha.anchored,
  };
}

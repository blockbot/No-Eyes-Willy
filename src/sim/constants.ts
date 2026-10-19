/** Tile and physics constants, taken from the original Phaser 2.0.3 game and its Arcade physics defaults. */

export const TILE_SIZE = 32;

/** Camera viewport of the original game (not the size of every level). */
export const VIEW_WIDTH = 448;
export const VIEW_HEIGHT = 448;

/** Fixed simulation rate. The legacy loop used the real frame delta; 60 Hz is its nominal behaviour. */
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const DT = 1 / TICK_RATE;

/** Tile semantics (Tiled gids in the map layer). */
export const TILE_SOLID_FIRST = 1;
export const TILE_SOLID_LAST = 18;
/** Empty slot Willy can bridge. Tapping it converts it, one way, into TILE_BRIDGE. */
export const TILE_EDITABLE = 19;
export const TILE_BRIDGE = 20;

/** Object-layer gids. */
export const OBJECT_LADDER = 25;
export const OBJECT_SPIKES = 26;

export const WALK_SPEED = 100;
export const WILLY_GRAVITY = 1000;
export const WILLY_BODY_W = 32;
export const WILLY_BODY_H = 64;
/** Willy's sprite frame; the tap target for "turn around" is the full frame, not the narrower body. */
export const WILLY_FRAME = 64;
export const MARTHA_FRAME = 64;
export const OBJECT_SIZE = 32;

/** Arcade physics tuning constants, unchanged from Phaser 2.0.3. */
export const OVERLAP_BIAS = 4;
export const TILE_BIAS = 16;

/** The legacy game used wall-clock setTimeout; converted to ticks. */
export const START_DELAY_TICKS = Math.round(200 / TICK_MS);
export const DEATH_DELAY_TICKS = Math.round(200 / TICK_MS);
export const DANCE_DELAY_TICKS = Math.round(500 / TICK_MS);

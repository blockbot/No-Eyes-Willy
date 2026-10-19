import type { LevelDef, TiledMap } from '../sim/level';
import test from './maps/test.json';
import level1 from './maps/level0_1.json';
import level2 from './maps/level0_2.json';
import level3 from './maps/level0_3.json';
import level4 from './maps/level0_4.json';
import level5 from './maps/level0_5.json';
import level6 from './maps/level0_6.json';
import level7 from './maps/level0_7.json';

type Fn = (w: number, h: number) => number;
const c =
  (n: number): Fn =>
  () =>
    n;
const fromRight =
  (n: number): Fn =>
  (w) =>
    w - n;
const fromBottom =
  (n: number): Fn =>
  (_w, h) =>
    h - n;

/**
 * The eight stages in their original order. Map data is the untouched Tiled JSON from the 2014 game;
 * only the per-stage placements that lived in the duplicated legacy level scripts are expressed here.
 * `test.json` is the first playable stage ("Level_0_0") and stays in the campaign.
 */
export const LEVELS: readonly LevelDef[] = [
  {
    id: 'Level_0_0',
    index: 0,
    title: 'Level 1',
    map: test as TiledMap,
    martha: { x: c(0), y: c(0), anchored: false, flipped: false },
    willy: { x: c(448), y: fromBottom(96), facing: -1 },
    explosion: { x: c(384), y: c(320) },
  },
  {
    id: 'Level_0_1',
    index: 1,
    title: 'Level 2',
    map: level1 as TiledMap,
    martha: { x: fromRight(32), y: c(160), anchored: true, flipped: true },
    willy: { x: fromRight(0), y: fromBottom(96), facing: -1 },
    explosion: { x: fromRight(64), y: fromBottom(128) },
  },
  {
    id: 'Level_0_2',
    index: 2,
    title: 'Level 3',
    map: level2 as TiledMap,
    martha: { x: fromRight(32), y: fromBottom(64), anchored: true, flipped: true },
    willy: { x: fromRight(192), y: fromBottom(64), facing: -1 },
    explosion: { x: fromRight(256), y: fromBottom(96) },
  },
  {
    id: 'Level_0_3',
    index: 3,
    title: 'Level 4',
    map: level3 as TiledMap,
    martha: { x: c(96), y: c(32), anchored: true, flipped: true },
    willy: { x: fromRight(0), y: c(0), facing: -1 },
    explosion: { x: fromRight(64), y: c(0) },
  },
  {
    id: 'Level_0_4',
    index: 4,
    title: 'Level 5',
    map: level4 as TiledMap,
    martha: { x: fromRight(382), y: fromBottom(64), anchored: true, flipped: true },
    willy: { x: fromRight(0), y: fromBottom(64), facing: -1 },
    explosion: { x: fromRight(64), y: fromBottom(96) },
  },
  {
    id: 'Level_0_5',
    index: 5,
    title: 'Level 6',
    map: level5 as TiledMap,
    martha: { x: fromRight(32), y: c(64), anchored: true, flipped: true },
    willy: { x: c(0), y: fromBottom(96), facing: 1 },
    explosion: { x: c(0), y: fromBottom(96) },
  },
  {
    id: 'Level_0_6',
    index: 6,
    title: 'Level 7',
    map: level6 as TiledMap,
    martha: { x: fromRight(96), y: c(64), anchored: true, flipped: false },
    willy: { x: fromRight(192), y: c(64), facing: -1 },
    explosion: { x: fromRight(224), y: c(32) },
  },
  {
    id: 'Level_0_7',
    index: 7,
    title: 'Level 8',
    map: level7 as TiledMap,
    martha: { x: fromRight(192), y: c(32), anchored: true, flipped: false },
    willy: { x: fromRight(32), y: fromBottom(96), facing: -1 },
    explosion: { x: fromRight(64), y: fromBottom(128) },
  },
];

// Writes tests/fixtures/legacy-asset-hashes.json: sha256 of every original asset in the archive tag, mapped to its new location.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const TAG = 'legacy-phaser2-final';
const MAP = [
  ['assets/tilemaps/test.json', 'src/levels/maps/test.json'],
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => [`assets/tilemaps/level0_${n}.json`, `src/levels/maps/level0_${n}.json`]),
  ...['blood', 'clean', 'explosion', 'martha', 'skull', 'willy'].map((n) => [`assets/sprites/${n}.png`, `public/game/sprites/${n}.png`]),
  ...['btn-next', 'btn-play', 'btn-restart', 'btn-retry', 'title'].map((n) => [`assets/sprites/${n}.png`, `src/assets/ui/${n}.png`]),
  ...['ladders', 'spikes', 'tiles'].map((n) => [`assets/tiles/${n}.png`, `public/game/tiles/${n}.png`]),
  ...['death', 'explosion', 'powerup', 'select', 'splash'].map((n) => [`assets/sounds/${n}.wav`, `public/game/sounds/${n}.wav`]),
  ...['directions', 'martha-callout', 'game-frame'].map((n) => [`images/${n}.png`, `src/assets/ui/${n}.png`]),
  ['fonts/04b_03__-webfont.woff', 'src/assets/fonts/04b_03__-webfont.woff'],
];
const out = {};
for (const [from, to] of MAP) {
  const buf = execFileSync('git', ['show', `${TAG}:${from}`], { maxBuffer: 1 << 28 });
  out[to] = { legacyPath: from, sha256: createHash('sha256').update(buf).digest('hex') };
}
fs.writeFileSync('tests/fixtures/legacy-asset-hashes.json', JSON.stringify({ tag: TAG, files: out }, null, 1) + '\n');
console.log(`hashed ${Object.keys(out).length} files`);

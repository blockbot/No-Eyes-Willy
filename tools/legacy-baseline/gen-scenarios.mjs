// Seeded fuzz scenarios used to differentially compare the legacy engine and the new simulation.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureLegacy } from './serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const MAPS = ['test', 'level0_1', 'level0_2', 'level0_3', 'level0_4', 'level0_5', 'level0_6', 'level0_7'];

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const root = ensureLegacy();
const scenarios = [];
for (let level = 0; level < 8; level++) {
  const map = JSON.parse(fs.readFileSync(path.join(root, 'assets/tilemaps', MAPS[level] + '.json'), 'utf8'));
  const { width, height } = map;
  const editable = [];
  map.layers[0].data.forEach((g, i) => { if (g === 19) editable.push([i % width, Math.floor(i / width)]); });
  scenarios.push({ name: `L${level}-passive`, level, ticks: 1500, actions: [] });
  for (let seed = 1; seed <= 4; seed++) {
    const rnd = mulberry32(level * 1000 + seed);
    const actions = [];
    let t = 15 + Math.floor(rnd() * 30);
    while (t < 1500) {
      const r = rnd();
      if (r < 0.34) actions.push({ t, type: 'willy' });
      else if (r < 0.64 && editable.length) {
        const [tx, ty] = editable[Math.floor(rnd() * editable.length)];
        actions.push({ t, type: 'tile', tx, ty });
      } else if (r < 0.84) {
        const d = [-34, -33, -32, -31, -20, 0, 20, 31, 32, 33, 34];
        actions.push({ t, type: 'rel', dx: d[Math.floor(rnd() * d.length)], dy: d[Math.floor(rnd() * d.length)] });
      } else {
        actions.push({ t, type: 'tile', tx: Math.floor(rnd() * width), ty: Math.floor(rnd() * height) });
      }
      t += 3 + Math.floor(rnd() * 70);
    }
    scenarios.push({ name: `L${level}-fuzz${seed}`, level, ticks: 1500, actions });
  }
}
fs.writeFileSync(path.join(here, 'scenarios.json'), JSON.stringify(scenarios));
console.log('scenarios', scenarios.length);

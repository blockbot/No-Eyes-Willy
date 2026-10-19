// Turns routes/level-N.json into scenario files that the legacy recorder (tools/legacy-baseline/record.mjs) can replay.
import fs from 'node:fs';
const out = process.argv[2] ?? 'parity/route-scenarios.json';
const list = [];
for (let n = 0; n < 8; n++) {
  const file = `routes/level-${n}.json`;
  if (!fs.existsSync(file)) continue;
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  list.push({
    name: `route-L${n}`,
    level: n,
    ticks: r.winTick + 120,
    actions: r.actions.map((a) => ({ t: a.tick, type: 'world', wx: a.worldX, wy: a.worldY })),
  });
}
fs.writeFileSync(out, JSON.stringify(list));
console.log(`wrote ${list.length} scenarios to ${out}`);

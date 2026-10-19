import { LEVELS } from '../../src/levels/manifest';
import { parseLevel } from '../../src/sim/level';

const only = process.argv[2] ? Number(process.argv[2]) : undefined;
for (const def of LEVELS) {
  if (only !== undefined && def.index !== only) continue;
  const lv = parseLevel(def);
  const rows: string[][] = [];
  for (let y = 0; y < lv.height; y++) {
    const r: string[] = [];
    for (let x = 0; x < lv.width; x++) {
      const g = lv.tiles[y * lv.width + x]!;
      r.push(g === 0 ? '  .' : String(g).padStart(3));
    }
    rows.push(r);
  }
  const mark = (px: number, py: number, ch: string): void => {
    const tx = Math.floor(px / 32), ty = Math.floor(py / 32);
    const row = rows[ty];
    if (row && tx >= 0 && tx < lv.width) row[tx] = row[tx]!.slice(0, 2) + ch;
  };
  for (const l of lv.ladders) mark(l.x + 16, l.y + 16, 'H');
  for (const s of lv.spikes) mark(s.x + 16, s.y + 16, '^');
  mark(lv.martha.x + 32, lv.martha.y + 32, 'M');
  mark(lv.willy.x, lv.willy.y, 'W');
  console.log(`\n=== ${def.id} (${def.title}) ${lv.width}x${lv.height} willy=(${lv.willy.x},${lv.willy.y}) facing=${lv.willy.facing} martha=(${lv.martha.x},${lv.martha.y})`);
  console.log('    ' + Array.from({ length: lv.width }, (_, i) => String(i).padStart(3)).join(''));
  rows.forEach((r, y) => console.log(String(y).padStart(2) + '  ' + r.join('')));
}

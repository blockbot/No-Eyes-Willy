# Migration record: Phaser 2.0.3 to TypeScript + Vite + Phaser 4

## References

| | |
| --- | --- |
| Baseline commit (legacy, untouched) | `fc63f8e0e9d1b6fa94035046fc7d294669356ba1` ("Initial Commit") |
| Archive ref | annotated tag `legacy-phaser2-final` (tag object `57fdd7b01802dbc09ffdd69728aaee063075fb46`, points at the baseline commit) |
| Tag preserved on the remote | Yes. `git ls-remote --tags origin` lists it. |
| History | Not rewritten. The migration is ordinary commits on `cursor/modernize-no-eyes-willy-ae46`. |

The archive is only in git. It is not in `dist/`, not linked from the game, and not a game mode. `e2e/build.spec.ts` fails if the production output contains the legacy engine, level scripts, tilemap JSON or anything named `legacy`.

## What was removed from the tree

All of it is recoverable with `git checkout legacy-phaser2-final`.

- `js/` (Phaser 2.0.3 builds, `custom/` Ninja and p2 physics, `config.php`, `modernizr.js`, the eight copies in `levels.js`, `boot.js`, `game.js`, `player.js`, `enemies.js`, `npc.js`)
- `src/` (the vendored Phaser 2 engine sources, `Intro.js`, `Outro.js`, `Phaser.js`), `css/`, `fonts/` (eot, svg, ttf), the old `index.html`, and the bitmap font under `assets/fonts/zerofourbee`

## What moved (old to new)

| Old | New |
| --- | --- |
| `assets/tilemaps/*.json` | `src/levels/maps/` |
| `assets/sprites/{blood,clean,explosion,martha,skull,willy}.png` | `public/game/sprites/` |
| `assets/tiles/*.png` | `public/game/tiles/` |
| `assets/sounds/*.wav` | `public/game/sounds/` |
| `assets/sprites/{btn-next,btn-play,btn-restart,btn-retry,title}.png`, `images/{directions,martha-callout,game-frame}.png` | `src/assets/ui/` |
| `fonts/04b_03__-webfont.woff` | `src/assets/fonts/` |

`tests/fixtures/legacy-asset-hashes.json` records the sha256 of all 31 carried-over files from the tag. `tests/app.test.ts` checks that the new files are byte-identical.

## How parity was established

The oracle is the original game, not a reading of its code.

1. `tools/legacy-baseline/` serves the tagged build and drives it deterministically in Google Chrome 154 (frame stepping, injected clicks) and records per-tick state: sprite and body position, velocity, blocked flags, camera, animation state, game globals, tile edits.
2. `src/sim/` is a renderer-free port of the Phaser 2.0.3 Arcade physics and tilemap semantics at 60 ticks per second (including its prev-position quirks, tile bias and camera rounding). Timers are converted to ticks (200 ms = 12, 500 ms = 30).
3. `tests/parity.test.ts` replays **48 legacy traces** (per level: one passive run and four seeded fuzz runs, 40 in all, plus the 8 route traces) against the sim and requires every recorded value to match on every tick.
4. `tools/routes/solve.ts` searches the sim (breadth-first by tick, exact state de-duplication) for a winning sequence of the original verbs only: tap Willy, tap an empty box. Each route is replayed in the **legacy engine** (`parity/traces/route-L*.json.gz`), which reaches Martha on the same tick as the sim. `tests/routes.test.ts` asserts that.
5. `e2e/routes.spec.ts` plays each route in the production build through real pointer events (mouse and touch) and checks the recorded win tick.
6. `tools/visual/compare.mjs` renders the original and the new build side by side at nine moments. Remaining pixel difference is 0.00 to 0.03 percent (blood particles are random in the original and seeded here).

## Winning routes (original verbs only)

| Level | Win tick | Seconds | Taps | Turns | Fills |
| --- | --- | --- | --- | --- | --- |
| 1 | 760 | 12.7 | 10 | 1 | 9 |
| 2 | 2174 | 36.2 | 29 | 6 | 24 |
| 3 | 897 | 14.9 | 24 | 8 | 16 |
| 4 | 881 | 14.7 | 25 | 1 | 24 |
| 5 | 1366 | 22.8 | 39 | 6 | 33 |
| 6 | 1685 | 28.1 | 36 | 7 | 29 |
| 7 | 471 | 7.8 | 13 | 2 | 11 |
| 8 | 1734 | 28.9 | 29 | 2 | 27 |

(Level 2 has one tap that both fills a box and turns Willy, so taps can be fewer than turns plus fills.) Routes are in `routes/level-N.json` as `{tick, worldX, worldY, intent}`.

## Known discrepancies from the original

Gameplay rules, speeds, layouts, level order and collision are unchanged. These differences exist, and none of them is reachable in normal play unless stated:

1. **Bugs fixed on purpose.** Controls were registered again on every level start. The climb globals were only partly reset. Timeouts survived restarts and level changes. Death could be queued repeatedly. Tile edits stayed after a restart. Each start now builds a fresh sim, so none of these can happen.
2. **End screen.** The original's end-check counted queued death timeouts. The new game shows the end screen once.
3. **Taps outside the map** threw errors in the original. They are ignored now.
4. **Tick 0.** The original camera is stale until its first update, so a tap in the first 6 ticks maps differently. A user cannot tap that early, and the routes start at tick 6.
5. **Blood spray** is a seeded 500-particle approximation of the original's random emitter.
6. **Level Select** is new UI that the brief requires. It allows jumping to any of the 8 levels. The original had no such menu, and no progress is saved, so there is no unlock logic.
7. **Controls and layout** (Start, Pause, Restart, Level Select, Mute, responsive scaling) are DOM elements outside the canvas. Pointer input is unified and ignores extra touches. Willy still cannot be moved by keyboard, as in the original.
8. Route taps are machine-timed, for instance one tile filled per frame. A person plays them slower but with the same effect.

## Verification (run on this branch)

Environment: Linux, Node v22.14.0, npm 10.9.9, Playwright 1.64.1 (Chromium headless shell 156.0.8078.4, WebKit 27.2 Linux build), Google Chrome 154.0.8037.92 for the legacy recording and visual tools.

```
npm ci
npm run typecheck          # tsc (TypeScript 7), no errors
npm test                   # vitest 5.0.5: 3 files, 89 tests passed
npm run build              # tsc + vite 8.3.4
npx playwright test        # 129 passed, 11 skipped (140 tests across 4 projects)
```

The 11 skips are intended: multitouch needs CDP touch injection, so it runs only in Chromium mobile (3 skips), and the four resize layouts are skipped on the two mobile profiles because the device profile fixes the viewport (8 skips). Separately, one assertion inside the sub-path test (that the sounds are requested) is not applied in WebKit, because the Linux WebKit build has no WAV decoder or audio device.

Not verified: real iOS Safari or any real phone, audio on real devices, and WebGL context loss.

To regenerate the oracle (needs Google Chrome at `CHROME_PATH` or `/usr/local/bin/google-chrome`):

```
node tools/legacy-baseline/record.mjs tools/legacy-baseline/scenarios.json parity/traces
npm run routes:solve
```

## Rollback

- Before merge: close the PR. Nothing else has changed.
- After merge: revert the merge commit, or `git checkout legacy-phaser2-final` for the exact original tree. The original game needs a web server that serves it under `/games/noeyeswilly/` (its asset URLs are absolute).

## Hosting observations (no ownership inferred)

- The GitHub repository has no homepage set, no recorded deployments and no Pages site.
- `https://blockbot.com/games/noeyeswilly/` answered with a 301 redirect to `/home` when it was checked. The legacy code requests assets under `/games/noeyeswilly/`. Who runs that domain, and whether it serves this repository, was not determined.
- The new build uses relative asset URLs (`base: './'`), so it works at the root or under any sub-path.
- `vercel.json` is prepared. No project was created or linked, and no DNS or deployment was changed.

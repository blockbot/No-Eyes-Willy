# No Eyes Willy

Willy cannot see, so you guide him. He walks on his own, and your clicks are the only control. Click Willy to turn him around. Click an empty box to fill it with a bridge piece, and get him safely to Martha. Each stage is a puzzle of timing and placement.

This is a TypeScript, Vite and [Phaser](https://phaser.io) rebuild of the 2014 Phaser 2.0.3 game. Gameplay, levels, art and sound are unchanged. The previous implementation is archived at the git tag `legacy-phaser2-final` (see [docs/MIGRATION.md](docs/MIGRATION.md)).

## How to play

- Click or tap **Willy** to make him walk the other way.
- Click or tap an empty box to fill it with a bridge piece. The edit is one-way, and the stage resets when you restart it.
- Willy climbs ladders by himself. Spikes and falls kill him. Reach Martha to clear the stage.
- Controls below the game: Start, Pause/Resume, Restart, Level Select, Mute. Mute is remembered on this device. Nothing else is saved.

## Requirements

- Node.js 22.12 or newer (`.nvmrc` pins 22.14.0, which is what the project was tested with) and npm.
- For the browser tests, the Playwright browsers: `npx playwright install chromium webkit`.

## Commands

| Command | What it does |
| --- | --- |
| `npm ci` | Install the locked dependencies |
| `npm run dev` | Dev server |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (vitest): sim parity against recorded legacy traces, routes, app logic |
| `npm run test:e2e` | Playwright against the production build (desktop Chrome, mobile Chrome, WebKit desktop, iPhone emulation) |
| `npm run verify` | All of the above, in order |
| `npm run routes:solve [levels]` | Re-solve the winning routes in `routes/` |
| `npm run parity:assets` | Re-hash the original assets against the archive tag |
| `npm run visual:compare` / `visual:screenshots` | Visual comparison against the original / screenshots. Run `npm run build` first. |

Add `?test=1` to the URL to expose `window.__nsw`, the deterministic hook used by the browser tests. It does nothing otherwise.

## Layout

```
index.html, src/styles     page shell, original art via CSS
src/main.ts                boot
src/sim/                   renderer-free, fixed-step (60 Hz) port of the Phaser 2 Arcade/tilemap behaviour
src/app/                   controller (lifecycle), fixed-step loop, pointer mapping, preferences, config
src/view/scene.ts          Phaser scene: draws what the sim says
src/ui/shell.ts            DOM controls, dialogs, announcements
src/levels/                typed manifest + the original tilemaps
public/game/               original sprites, tiles, sounds (copied as-is)
routes/                    one recorded winning route per level (tap, tick, action)
parity/traces/             legacy Phaser 2 traces used as the test oracle
e2e/, tests/               browser and unit tests
tools/                     solver, legacy recorder, visual tools
```

Every start, restart or next-level builds a fresh simulation, so tile edits, timers and the death flow cannot leak between attempts. Asset URLs are derived from the app base, so the build can be served from a sub-path.

## Deployment

A static site: `npm ci && npm run build`, output `dist/`. `vercel.json` encodes that. See [docs/CUTOVER.md](docs/CUTOVER.md) for the switch-over checklist. Deployment has not been performed.

## Credits

See [CREDITS.md](CREDITS.md).

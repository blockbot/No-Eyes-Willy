# Credits

- **No Eyes Willy**: game, levels, sprites, tiles and sound effects, (c) 2014 blockbot. Shipped here unchanged (`public/game/`, `src/levels/maps/`, `src/assets/ui/`). Hashes against the original are checked by `tests/fixtures/legacy-asset-hashes.json`.
- **[Phaser](https://phaser.io)** 4.2.1 by Phaser Studio, MIT License. The 2014 build used Phaser 2.0.3 (Photon Storm, MIT), which is no longer shipped.
- **Typeface 04b_03** by Yuji Oshimoto (04.jp.org). The webfont file is the one the original game shipped (`src/assets/fonts/04b_03__-webfont.woff`). The repository does not contain that font's licence terms, and they have not been verified.
- **Sound effects**: the repository does not record who made them or under what terms. They are the original files, unmodified.

The simulation in `src/sim/` re-implements behaviour of Phaser 2.0.3's Arcade physics and tilemap collision (MIT, (c) 2014 Photon Storm Ltd) so that the game plays identically.

If any attribution above is incomplete or wrong, please correct it here.

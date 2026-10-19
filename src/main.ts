import Phaser from 'phaser';
import './styles/main.css';
import { GameController } from './app/controller';
import { Preferences } from './app/preferences';
import { Shell } from './ui/shell';
import { GameScene } from './view/scene';
import { installTestHook } from './testing/hook';

function boot(): void {
  const scene = new GameScene();
  const controller = new GameController(scene);
  const prefs = new Preferences();
  let shell: Shell | null = null;

  scene.attach(controller, {
    onProgress: (f) => shell?.setLoadProgress(f),
    onLoadError: (missing) => shell?.showError(missing),
    onReady: () => {
      if (shell) shell.attachCanvas(game.canvas);
      scene.setMuted(prefs.muted);
      controller.markReady();
    },
  });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: 448,
    height: 448,
    parent: 'game',
    backgroundColor: '#c0dbe2',
    pixelArt: true,
    banner: false,
    disableContextMenu: true,
    scale: { mode: Phaser.Scale.NONE },
    input: { mouse: false, touch: false, keyboard: false, gamepad: false },
    scene,
  });

  shell = new Shell(controller, { setMuted: (m) => scene.setMuted(m), unlock: () => scene.unlockAudio() }, prefs);

  installTestHook({ controller, scene, shell });
}

boot();

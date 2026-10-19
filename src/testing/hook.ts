import type { GameController } from '../app/controller';
import type { Shell } from '../ui/shell';
import type { GameScene } from '../view/scene';

export interface TestHookTargets {
  controller: GameController;
  scene: GameScene;
  shell: Shell;
}

export interface NswSnapshot {
  phase: string;
  levelIndex: number;
  attempt: number;
  tick: number;
  spriteX: number;
  spriteY: number;
  cameraX: number;
  cameraY: number;
  vx: number;
  scaleX: number;
  outcome: string;
  outcomeTick: number;
  alive: boolean;
  exists: boolean;
  anim: string;
  edits: Array<[number, number]>;
  counts: ReturnType<GameScene['debugCounts']> & { shellListeners: number };
}

/**
 * Browser-test hook, installed only when the page URL has `?test=1`. It never changes game rules: it can
 * switch the frame clock off so tests advance exact ticks, convert view positions to client coordinates for
 * real pointer events, and read state back.
 */
export function installTestHook({ controller, scene, shell }: TestHookTargets): void {
  if (!new URLSearchParams(window.location.search).has('test')) return;
  const api = {
    setManual: (on: boolean): void => {
      controller.manual = on;
    },
    step: (n: number): void => controller.step(n),
    begin: (i: number): void => controller.begin(i),
    snapshot: (): NswSnapshot => {
      const s = controller.sim;
      return {
        phase: controller.phase,
        levelIndex: controller.levelIndex,
        attempt: controller.attempt,
        tick: s?.tickCount ?? 0,
        spriteX: s?.spriteX ?? 0,
        spriteY: s?.spriteY ?? 0,
        cameraX: s?.cameraX ?? 0,
        cameraY: s?.cameraY ?? 0,
        vx: s?.willy.vx ?? 0,
        scaleX: s?.scaleX ?? 1,
        outcome: s?.outcome ?? 'none',
        outcomeTick: s?.outcomeTick ?? -1,
        alive: s?.alive ?? true,
        exists: s?.exists ?? true,
        anim: s?.anim ?? 'walk',
        edits: s?.editedTiles() ?? [],
        counts: { ...scene.debugCounts(), shellListeners: shell.registeredListeners },
      };
    },
    viewToClient: (x: number, y: number): { x: number; y: number } => shell.viewToClient(x, y),
  };
  (window as unknown as { __nsw: typeof api }).__nsw = api;
}

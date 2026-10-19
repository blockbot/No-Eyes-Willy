import Phaser from 'phaser';
import { assetUrl, SOUND_KEYS } from '../app/config';
import type { GameController, Presenter } from '../app/controller';
import type { ParsedLevel } from '../sim/level';
import type { LevelSim, SimEvent, SoundName } from '../sim/level-sim';
import { TILE_BRIDGE, TILE_SIZE } from '../sim/constants';

const SKY = '#c0dbe2';
const WALK_FRAMES = [2, 3, 2, 4];
const DANCE_FRAMES = [0, 0, 1, 1];
const CLIMB_FRAMES = [5, 5, 6, 6];
const DEAD_FRAME = 7;
/** Registering animations in the original left each sprite on the first frame of the last one added: Willy on the climb pose, Martha on the first splash frame. */
const WILLY_INITIAL_FRAME = 5;
const MARTHA_INITIAL_FRAME = 1;
const MARTHA_SPLASH_FRAMES = [1, 2, 3, 4];
const BLOOD_COUNT = 500;
const BLOOD_LIFE_TICKS = 180;
const BLOOD_GRAVITY = 200;

interface Particle {
  image: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  age: number;
}

export interface SceneHooks {
  onReady(): void;
  onLoadError(missing: string[]): void;
  onProgress(fraction: number): void;
}

/** Small deterministic generator so the blood spray is reproducible in screenshots and tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The single, reusable gameplay scene. It draws whatever `LevelSim` it is given; the level's data (tile map,
 * placements) comes from the sim, so the scene has no per-level code. All per-level display objects are tracked
 * and destroyed in `clearLevel()`, so restarting or advancing leaves nothing behind.
 */
export class GameScene extends Phaser.Scene implements Presenter {
  static readonly KEY = 'game';

  private controller: GameController | null = null;
  private hooks: SceneHooks | null = null;
  private readonly missing: string[] = [];

  private levelObjects: Phaser.GameObjects.GameObject[] = [];
  private tileImages = new Map<number, Phaser.GameObjects.Image>();
  private willy: Phaser.GameObjects.Sprite | null = null;
  private martha: Phaser.GameObjects.Sprite | null = null;
  private explosion: Phaser.GameObjects.Sprite | null = null;
  private banner: Phaser.GameObjects.Sprite | null = null;
  private particles: Particle[] = [];
  private lastParticleTick = 0;
  private rng: () => number = mulberry32(1);
  private level: ParsedLevel | null = null;
  private shown = 0;
  private muted = false;
  private shownFrame = WILLY_INITIAL_FRAME;
  private frameAnim = '';
  private frameAnimStart = -1;

  constructor() {
    super(GameScene.KEY);
  }

  attach(controller: GameController, hooks: SceneHooks): void {
    this.controller = controller;
    this.hooks = hooks;
  }

  preload(): void {
    this.load.on('loaderror', (file: Phaser.Loader.File) => this.missing.push(file.key));
    this.load.on('progress', (value: number) => this.hooks?.onProgress(value));

    const url = (p: string): string => assetUrl(`assets/${p}`);
    this.load.spritesheet('tiles', url('tiles/tiles.png'), { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE });
    this.load.image('ladders', url('tiles/ladders.png'));
    this.load.image('spikes', url('tiles/spikes.png'));
    this.load.image('blood', url('sprites/blood.png'));
    this.load.image('skull', url('sprites/skull.png'));
    this.load.spritesheet('martha', url('sprites/martha.png'), { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('explosion', url('sprites/explosion.png'), { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('willy', url('sprites/willy.png'), { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('clean', url('sprites/clean.png'), { frameWidth: 128, frameHeight: 192 });
    for (const name of SOUND_KEYS) this.load.audio(name, url(`sounds/${name}.wav`));
  }

  create(): void {
    this.cameras.main.setBackgroundColor(SKY);
    this.sound.mute = this.muted;
    if (this.missing.length > 0) this.hooks?.onLoadError([...this.missing]);
    else this.hooks?.onReady();
  }

  override update(): void {
    this.controller?.frame(performance.now());
  }

  /** Counts used by the lifecycle tests: these must be identical after any number of restarts. */
  debugCounts(): { displayObjects: number; tracked: number; particles: number; sceneListeners: number; levelsShown: number } {
    const events = this.events as unknown as { listenerCount(name: string): number; eventNames(): Array<string | symbol> };
    let sceneListeners = 0;
    for (const name of events.eventNames()) sceneListeners += events.listenerCount(name as string);
    return {
      displayObjects: this.children.length,
      tracked: this.levelObjects.length,
      particles: this.particles.length,
      sceneListeners,
      levelsShown: this.shown,
    };
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.sound) this.sound.mute = muted;
  }

  /** Resumes the Web Audio context from inside a user gesture (browsers keep it suspended until then). */
  unlockAudio(): void {
    const ctx = (this.sound as unknown as { context?: AudioContext }).context;
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  }

  showLevel(sim: LevelSim, level: ParsedLevel): void {
    this.level = level;
    this.shown++;
    this.shownFrame = WILLY_INITIAL_FRAME;
    this.frameAnim = '';
    this.frameAnimStart = -1;
    this.rng = mulberry32(level.index + 1);
    const track = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.levelObjects.push(o);
      return o;
    };

    for (let ty = 0; ty < level.height; ty++) {
      for (let tx = 0; tx < level.width; tx++) {
        const gid = level.tiles[ty * level.width + tx] ?? 0;
        if (gid === 0) continue;
        const img = track(this.add.image(tx * TILE_SIZE, ty * TILE_SIZE, 'tiles', gid - 1).setOrigin(0, 0));
        this.tileImages.set(ty * level.width + tx, img);
      }
    }
    for (const r of level.ladders) track(this.add.image(r.x, r.y, 'ladders').setOrigin(0, 0));
    for (const r of level.spikes) track(this.add.image(r.x, r.y, 'spikes').setOrigin(0, 0));

    const m = level.martha.sprite;
    this.martha = track(this.add.sprite(m.x, m.y, 'martha', MARTHA_INITIAL_FRAME));
    this.martha.setOrigin(level.marthaAnchored ? 0.5 : 0, level.marthaAnchored ? 0.5 : 0);
    if (level.marthaFlipped) this.martha.setScale(-1, 1);

    this.willy = track(this.add.sprite(sim.spriteX, sim.spriteY, 'willy', WILLY_INITIAL_FRAME));
    this.explosion = track(this.add.sprite(level.explosion.x, level.explosion.y, 'explosion', 0).setOrigin(0, 0));

    this.lastParticleTick = sim.tickCount;
    this.cameras.main.setScroll(sim.cameraX, sim.cameraY);
  }

  clearLevel(): void {
    for (const o of this.levelObjects) o.destroy();
    this.levelObjects = [];
    for (const p of this.particles) p.image.destroy();
    this.particles = [];
    this.banner?.destroy();
    this.banner = null;
    this.tileImages.clear();
    this.willy = this.martha = this.explosion = null;
    this.level = null;
  }

  handleEvents(events: SimEvent[], sim: LevelSim): void {
    for (const e of events) {
      switch (e.type) {
        case 'sound':
          this.playSound(e.name);
          break;
        case 'tileEdited': {
          const img = this.level ? this.tileImages.get(e.ty * this.level.width + e.tx) : undefined;
          img?.setFrame(TILE_BRIDGE - 1);
          break;
        }
        case 'blood':
          this.spawnBlood(e.x, e.y);
          break;
        case 'outcome':
          this.showBanner(e.outcome);
          break;
        default:
          break;
      }
    }
    void sim;
  }

  render(sim: LevelSim): void {
    const cam = this.cameras.main;
    cam.setScroll(sim.cameraX, sim.cameraY);

    if (this.willy) {
      this.willy.setPosition(sim.spriteX, sim.spriteY);
      this.willy.setScale(sim.scaleX, 1);
      this.willy.setVisible(sim.exists);
      this.willy.setFrame(this.willyFrame(sim));
    }
    if (this.martha) this.martha.setFrame(this.marthaFrame(sim));
    if (this.explosion) this.explosion.setFrame(Math.min(5, Math.floor(Math.max(0, sim.tickCount - 2) / 6)));
    if (this.banner) {
      const sinceOutcome = sim.tickCount - sim.outcomeTick;
      if (sim.outcome === 'won') this.banner.setFrame(sinceOutcome >= 30 ? 1 : 0);
    }
    this.stepParticles(sim.tickCount);
  }

  /**
   * Phaser 2 started every animation one frame-delay late: for the first 8 ticks after `play()` the previous
   * texture frame stayed on screen, then the sequence continued from its second entry. Matching that keeps the
   * walk, climb and dance cycles in phase with the original.
   */
  private willyFrame(sim: LevelSim): number {
    const elapsed = Math.max(0, sim.tickCount - 1 - sim.animStartTick);
    const step = Math.floor((elapsed * 8) / 60);
    if (this.frameAnim !== sim.anim || this.frameAnimStart !== sim.animStartTick) {
      this.frameAnim = sim.anim;
      this.frameAnimStart = sim.animStartTick;
    }
    if (sim.anim === 'dead') return this.rememberFrame(DEAD_FRAME);
    if (step < 1) return this.shownFrame;
    const seq = sim.anim === 'climb' ? CLIMB_FRAMES : sim.anim === 'dance' ? DANCE_FRAMES : WALK_FRAMES;
    return this.rememberFrame(seq[step % seq.length] ?? 0);
  }

  private rememberFrame(frame: number): number {
    this.shownFrame = frame;
    return frame;
  }

  private marthaFrame(sim: LevelSim): number {
    if (sim.marthaIdle) return 0;
    if (sim.marthaSplashTick === null) return MARTHA_INITIAL_FRAME;
    const elapsed = Math.max(0, sim.tickCount - 1 - sim.marthaSplashTick);
    const idx = Math.min(MARTHA_SPLASH_FRAMES.length - 1, Math.floor((elapsed * 16) / 60));
    return MARTHA_SPLASH_FRAMES[idx] ?? MARTHA_INITIAL_FRAME;
  }

  private showBanner(outcome: 'dead' | 'won'): void {
    this.banner?.destroy();
    const key = outcome === 'dead' ? 'skull' : 'clean';
    const b = this.add.sprite(160, 60, key, outcome === 'dead' ? undefined : 0).setOrigin(0, 0).setScrollFactor(0).setDepth(1000);
    this.banner = b;
  }

  private playSound(name: SoundName): void {
    try {
      this.sound.play(name);
    } catch {
      /* a sound that cannot play must never interrupt the game */
    }
  }

  private spawnBlood(x: number, y: number): void {
    for (const p of this.particles) p.image.destroy();
    this.particles = [];
    for (let i = 0; i < BLOOD_COUNT; i++) {
      const image = this.add.image(x, y, 'blood').setDepth(900);
      this.particles.push({ image, vx: (this.rng() * 2 - 1) * 100, vy: (this.rng() * 2 - 1) * 100, age: 0 });
    }
  }

  private stepParticles(tick: number): void {
    const steps = tick - this.lastParticleTick;
    this.lastParticleTick = tick;
    if (this.particles.length === 0 || steps <= 0) return;
    for (let s = 0; s < steps; s++) {
      for (const p of this.particles) {
        p.vy += BLOOD_GRAVITY / 60;
        p.image.x += p.vx / 60;
        p.image.y += p.vy / 60;
        p.age++;
      }
    }
    if (this.particles[0] && this.particles[0].age >= BLOOD_LIFE_TICKS) {
      for (const p of this.particles) p.image.destroy();
      this.particles = [];
    }
  }
}

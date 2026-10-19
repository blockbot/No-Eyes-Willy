import { LEVELS } from '../levels/manifest';
import { parseLevel } from '../sim/level';
import type { ParsedLevel } from '../sim/level';
import { LevelSim } from '../sim/level-sim';
import type { SimEvent } from '../sim/level-sim';
import { FINAL_LEVEL_INDEX } from './config';
import { FixedStepper } from './stepper';

export type Phase = 'loading' | 'title' | 'playing' | 'paused' | 'dead' | 'won' | 'error';

/** What the controller needs from whatever draws and sounds the game (Phaser in production, a stub in tests). */
export interface Presenter {
  showLevel(sim: LevelSim, level: ParsedLevel): void;
  clearLevel(): void;
  handleEvents(events: SimEvent[], sim: LevelSim): void;
  render(sim: LevelSim): void;
}

export interface ControllerState {
  phase: Phase;
  levelIndex: number;
  levelCount: number;
  attempt: number;
}

type Listener = (state: ControllerState) => void;

const parsedCache = new Map<number, ParsedLevel>();
function parsed(index: number): ParsedLevel {
  let level = parsedCache.get(index);
  if (!level) {
    const def = LEVELS[index];
    if (!def) throw new RangeError(`unknown level ${index}`);
    level = parseLevel(def);
    parsedCache.set(index, level);
  }
  return level;
}

/**
 * Owns the game lifecycle: which level is loaded, whether time is running, and the single live simulation.
 * Starting, restarting or advancing always builds a brand-new `LevelSim` (so map edits, climb state and every
 * delayed callback are reset by construction) and tells the presenter to throw away the previous level.
 */
export class GameController {
  phase: Phase = 'loading';
  levelIndex = 0;
  attempt = 0;
  sim: LevelSim | null = null;
  /** When true the frame clock is ignored and only `step()` advances time (used by the automated tests). */
  manual = false;

  private readonly stepper = new FixedStepper();
  private readonly listeners = new Set<Listener>();
  private resumePhase: 'playing' | 'dead' | 'won' = 'playing';

  constructor(private readonly presenter: Presenter) {}

  get state(): ControllerState {
    return { phase: this.phase, levelIndex: this.levelIndex, levelCount: LEVELS.length, attempt: this.attempt };
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const state = this.state;
    for (const l of this.listeners) l(state);
  }

  private setPhase(phase: Phase): void {
    if (this.phase !== phase) {
      this.phase = phase;
      this.emit();
    }
  }

  markReady(): void {
    if (this.phase === 'loading') this.setPhase('title');
  }

  markError(): void {
    this.presenter.clearLevel();
    this.sim = null;
    this.setPhase('error');
  }

  /** Begins a fresh attempt at `index` from its initial state. */
  begin(index: number): void {
    if (this.phase === 'loading' || this.phase === 'error') return;
    if (!Number.isInteger(index) || index < 0 || index >= LEVELS.length) throw new RangeError(`unknown level ${index}`);
    this.presenter.clearLevel();
    this.levelIndex = index;
    this.attempt++;
    const level = parsed(index);
    this.sim = new LevelSim(level);
    this.stepper.reset();
    this.presenter.showLevel(this.sim, level);
    this.presenter.render(this.sim);
    this.phase = 'playing';
    this.emit();
  }

  /** "Start": a new game from the first stage. */
  start(): void {
    this.begin(0);
  }

  restart(): void {
    if (this.sim) this.begin(this.levelIndex);
  }

  next(): void {
    if (this.phase === 'won' && this.levelIndex < FINAL_LEVEL_INDEX) this.begin(this.levelIndex + 1);
  }

  /** Back to the title screen (no level loaded). */
  toTitle(): void {
    if (this.phase === 'loading' || this.phase === 'error') return;
    this.presenter.clearLevel();
    this.sim = null;
    this.setPhase('title');
  }

  get running(): boolean {
    return this.phase === 'playing' || this.phase === 'dead' || this.phase === 'won';
  }

  pause(): boolean {
    if (!this.running) return false;
    this.resumePhase = this.phase as 'playing' | 'dead' | 'won';
    this.setPhase('paused');
    return true;
  }

  resume(): boolean {
    if (this.phase !== 'paused') return false;
    this.stepper.reset();
    this.setPhase(this.resumePhase);
    return true;
  }

  togglePause(): void {
    if (this.phase === 'paused') this.resume();
    else this.pause();
  }

  /** A tap at integer view coordinates. Returns whether the tap was accepted while time is running. */
  tap(viewX: number, viewY: number): boolean {
    if (!this.running || !this.sim) return false;
    this.sim.pointerDown(viewX, viewY);
    this.presenter.handleEvents(this.sim.drainEvents(), this.sim);
    return true;
  }

  /** Called every display frame with a monotonic clock in milliseconds. */
  frame(nowMs: number): void {
    if (this.running && this.sim && !this.manual) {
      const ticks = this.stepper.advance(nowMs);
      for (let i = 0; i < ticks; i++) this.tickOnce();
    }
    if (this.sim) this.presenter.render(this.sim);
  }

  /** Advances exactly `count` ticks regardless of the clock (only while running). */
  step(count: number): void {
    for (let i = 0; i < count && this.running && this.sim; i++) this.tickOnce();
    if (this.sim) this.presenter.render(this.sim);
  }

  private tickOnce(): void {
    const sim = this.sim;
    if (!sim) return;
    sim.tick();
    this.presenter.handleEvents(sim.drainEvents(), sim);
    if (this.phase === 'playing') {
      if (sim.outcome === 'dead') this.setPhase('dead');
      else if (sim.outcome === 'won') this.setPhase('won');
    }
  }
}

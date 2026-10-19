import { FINAL_LEVEL_INDEX } from '../app/config';
import type { ControllerState, GameController } from '../app/controller';
import { clientToView, TapGate } from '../app/pointer';
import type { Preferences } from '../app/preferences';
import { LEVELS } from '../levels/manifest';

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
}

export interface ShellAudio {
  setMuted(muted: boolean): void;
  unlock(): void;
}

/**
 * Everything around the canvas: the visible controls, title/end screens, pause and level-select UI,
 * loading and error messages, and the single pointer pipeline into the game. Every listener is registered
 * exactly once, through `listen`, and removed together by `dispose()`.
 */
export class Shell {
  private readonly abort = new AbortController();
  private readonly gate = new TapGate();
  private listenerCount = 0;
  private canvas: HTMLCanvasElement | null = null;
  private dialogPausedGame = false;
  private lastAnnounced = '';

  private readonly stage = must('stage');
  private readonly title = must('title-screen');
  private readonly end = must('end-screen');
  private readonly paused = must('paused-screen');
  private readonly loading = must('loading-screen');
  private readonly loadingText = must('loading-text');
  private readonly errorScreen = must('error-screen');
  private readonly errorDetail = must('error-detail');
  private readonly levelIndicator = must('level-indicator');
  private readonly announcer = must('announcer');
  private readonly startBtn = must<HTMLButtonElement>('start-button');
  private readonly pauseBtn = must<HTMLButtonElement>('pause-button');
  private readonly restartBtn = must<HTMLButtonElement>('restart-level-button');
  private readonly levelsBtn = must<HTMLButtonElement>('levels-button');
  private readonly muteBtn = must<HTMLButtonElement>('mute-button');
  private readonly nextBtn = must<HTMLButtonElement>('next-button');
  private readonly retryBtn = must<HTMLButtonElement>('retry-button');
  private readonly restartGameBtn = must<HTMLButtonElement>('restart-button');
  private readonly playBtn = must<HTMLButtonElement>('play-button');
  private readonly reloadBtn = must<HTMLButtonElement>('reload-button');
  private readonly dialog = must<HTMLDialogElement>('levels-dialog');
  private readonly levelList = must('level-list');

  constructor(
    private readonly controller: GameController,
    private readonly audio: ShellAudio,
    private readonly prefs: Preferences,
  ) {
    this.buildLevelList();
    this.wire();
    this.audio.setMuted(this.prefs.muted);
    this.controller.onChange((s) => this.sync(s));
    this.sync(this.controller.state);
  }

  private listen(target: EventTarget, type: string, fn: (e: never) => void, options: AddEventListenerOptions = {}): void {
    this.listenerCount++;
    target.addEventListener(type, fn as EventListener, { ...options, signal: this.abort.signal });
  }

  get registeredListeners(): number {
    return this.listenerCount;
  }

  dispose(): void {
    this.abort.abort();
  }

  setLoadProgress(fraction: number): void {
    this.loadingText.textContent = `Loading… ${Math.round(fraction * 100)}%`;
  }

  showError(missing: string[]): void {
    this.errorDetail.textContent = `Missing files: ${missing.join(', ')}. Check your connection and reload.`;
    this.controller.markError();
  }

  /** Called once the Phaser canvas exists. */
  attachCanvas(canvas: HTMLCanvasElement): void {
    if (this.canvas) return;
    this.canvas = canvas;
    this.listen(canvas, 'pointerdown', (e: PointerEvent) => this.onPointerDown(e));
    const release = (e: PointerEvent): void => this.gate.release(e.pointerId);
    this.listen(window, 'pointerup', release);
    this.listen(window, 'pointercancel', release);
    this.listen(canvas, 'contextmenu', (e: Event) => e.preventDefault());
  }

  private onPointerDown(e: PointerEvent): void {
    this.audio.unlock();
    if (!this.canvas || !this.gate.down(e)) return;
    e.preventDefault();
    const p = clientToView(this.canvas.getBoundingClientRect(), e.clientX, e.clientY);
    if (p) this.controller.tap(p.x, p.y);
  }

  /** Converts a game-view position back to client coordinates (used by the automated browser tests). */
  viewToClient(x: number, y: number): { x: number; y: number } {
    if (!this.canvas) throw new Error('canvas not ready');
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((x + 0.5) / 448) * r.width, y: r.top + ((y + 0.5) / 448) * r.height };
  }

  private buildLevelList(): void {
    this.levelList.replaceChildren();
    for (const def of LEVELS) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ui-btn';
      b.textContent = def.title;
      b.dataset.level = String(def.index);
      li.append(b);
      this.levelList.append(li);
    }
  }

  private wire(): void {
    const c = this.controller;
    const gesture = (): void => this.audio.unlock();
    this.listen(document, 'pointerdown', gesture, { capture: true });
    this.listen(document, 'keydown', gesture, { capture: true });

    this.listen(this.startBtn, 'click', () => c.start());
    this.listen(this.playBtn, 'click', () => c.start());
    this.listen(this.pauseBtn, 'click', () => c.togglePause());
    this.listen(this.restartBtn, 'click', () => c.restart());
    this.listen(this.retryBtn, 'click', () => c.restart());
    this.listen(this.nextBtn, 'click', () => c.next());
    this.listen(this.restartGameBtn, 'click', () => c.start());
    this.listen(this.reloadBtn, 'click', () => window.location.reload());
    this.listen(this.levelsBtn, 'click', () => this.openLevelSelect());
    this.listen(this.muteBtn, 'click', () => {
      this.prefs.muted = !this.prefs.muted;
      this.audio.setMuted(this.prefs.muted);
      this.syncMute();
    });
    this.listen(this.levelList, 'click', (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-level]');
      if (!target) return;
      this.dialogPausedGame = false;
      this.dialog.close();
      c.begin(Number(target.dataset.level));
    });
    this.listen(this.dialog, 'close', () => {
      if (this.dialogPausedGame) c.resume();
      this.dialogPausedGame = false;
      this.levelsBtn.focus();
    });
    this.listen(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') c.pause();
    });
    this.listen(window, 'pagehide', () => {
      c.pause();
    });
  }

  private openLevelSelect(): void {
    if (this.dialog.open) return;
    this.dialogPausedGame = this.controller.pause();
    this.levelList.querySelectorAll<HTMLElement>('[data-level]').forEach((b) => {
      const current = this.controller.sim !== null && Number(b.dataset.level) === this.controller.levelIndex;
      if (current) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    this.dialog.showModal();
  }

  private syncMute(): void {
    const muted = this.prefs.muted;
    this.muteBtn.textContent = muted ? 'Unmute' : 'Mute';
  }

  private announce(text: string): void {
    if (text === this.lastAnnounced) return;
    this.lastAnnounced = text;
    this.announcer.textContent = text;
  }

  private sync(s: ControllerState): void {
    const { phase } = s;
    const sim = this.controller.sim;
    this.stage.dataset.phase = phase;

    this.loading.hidden = phase !== 'loading';
    this.errorScreen.hidden = phase !== 'error';
    this.title.hidden = phase !== 'title';
    this.paused.hidden = phase !== 'paused';

    const ended = sim !== null && sim.outcome !== 'playing' && (phase === 'dead' || phase === 'won' || phase === 'paused');
    this.end.hidden = !ended;
    if (ended && sim) {
      const won = sim.outcome === 'won';
      this.end.dataset.mode = won ? 'won' : 'dead';
      const last = s.levelIndex === FINAL_LEVEL_INDEX;
      this.nextBtn.hidden = !(won && !last);
      this.restartGameBtn.hidden = !(won && last);
      this.retryBtn.hidden = won && last;
    }

    const interactive = phase !== 'loading' && phase !== 'error';
    this.startBtn.disabled = !interactive;
    this.levelsBtn.disabled = !interactive;
    this.restartBtn.disabled = !(interactive && phase !== 'title');
    const canPause = phase === 'playing' || phase === 'dead' || phase === 'won';
    this.pauseBtn.disabled = !(canPause || phase === 'paused');
    this.pauseBtn.textContent = phase === 'paused' ? 'Resume' : 'Pause';
    this.syncMute();

    const inLevel = phase !== 'title' && phase !== 'loading' && phase !== 'error';
    this.levelIndicator.textContent = inLevel ? `${LEVELS[s.levelIndex]?.title ?? ''} of ${s.levelCount}` : phase === 'loading' ? 'Loading…' : phase === 'error' ? 'Something went wrong' : 'Press Play to begin';

    if (phase === 'dead') this.announce('Willy was impaled. Retry the level.');
    else if (phase === 'won') this.announce(s.levelIndex === FINAL_LEVEL_INDEX ? 'You cleaned up Willy. That was the last level.' : 'Willy reached Martha. Level complete.');
    else if (phase === 'paused') this.announce('Paused.');
    else if (phase === 'playing') this.announce(`${LEVELS[s.levelIndex]?.title ?? ''} started.`);
    else this.lastAnnounced = '';

    if (ended && phase !== 'paused' && sim) {
      const primary = sim.outcome === 'won' && s.levelIndex !== FINAL_LEVEL_INDEX ? this.nextBtn : sim.outcome === 'won' ? this.restartGameBtn : this.retryBtn;
      primary.focus({ preventScroll: true });
    }
    if (phase === 'title') this.playBtn.focus({ preventScroll: true });
  }
}

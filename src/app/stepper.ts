/**
 * Turns variable display frame times into whole fixed simulation ticks.
 * The same elapsed time yields the same number of ticks at any refresh rate; long stalls (a backgrounded tab,
 * a debugger pause) are clamped so the game never fast-forwards to catch up.
 */
export class FixedStepper {
  private last: number | null = null;
  private accumulator = 0;

  constructor(
    private readonly stepMs: number = 1000 / 60,
    private readonly maxFrameMs: number = 100,
    private readonly maxTicksPerFrame: number = 6,
  ) {}

  reset(): void {
    this.last = null;
    this.accumulator = 0;
  }

  /** Returns how many ticks to run for the frame that starts at `nowMs` (any monotonic millisecond clock). */
  advance(nowMs: number): number {
    if (this.last === null) {
      this.last = nowMs;
      return 0;
    }
    const dt = Math.min(Math.max(nowMs - this.last, 0), this.maxFrameMs);
    this.last = nowMs;
    this.accumulator += dt;
    let ticks = Math.floor(this.accumulator / this.stepMs + 1e-9);
    this.accumulator -= ticks * this.stepMs;
    if (ticks > this.maxTicksPerFrame) {
      ticks = this.maxTicksPerFrame;
      this.accumulator = 0;
    }
    return ticks;
  }
}

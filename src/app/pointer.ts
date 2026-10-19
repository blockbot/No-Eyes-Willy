import { VIEW_HEIGHT, VIEW_WIDTH } from '../sim/constants';

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Maps a client-space position to integer pixels in the 448x448 game view. It uses the element's live
 * bounding box, so CSS scaling, page zoom, device pixel ratio and letterboxing (pass the content box) are
 * all handled. Camera scroll is deliberately not applied: the simulation adds its own camera position.
 * Returns null outside the view.
 */
export function clientToView(rect: RectLike, clientX: number, clientY: number): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const nx = (clientX - rect.left) / rect.width;
  const ny = (clientY - rect.top) / rect.height;
  if (!(nx >= 0 && nx < 1 && ny >= 0 && ny < 1)) return null;
  return { x: Math.floor(nx * VIEW_WIDTH), y: Math.floor(ny * VIEW_HEIGHT) };
}

export interface PointerLike {
  pointerId: number;
  isPrimary: boolean;
  button: number;
}

/**
 * Decides which pointer-down events count as a tap: only the primary pointer's main button, and only while
 * no other pointer is held down. Extra fingers and extra buttons are ignored, so one tap is one action.
 */
export class TapGate {
  private active: number | null = null;

  down(e: PointerLike): boolean {
    if (!e.isPrimary || e.button !== 0) return false;
    if (this.active !== null) return false;
    this.active = e.pointerId;
    return true;
  }

  release(pointerId: number): void {
    if (this.active === pointerId) this.active = null;
  }

  reset(): void {
    this.active = null;
  }
}

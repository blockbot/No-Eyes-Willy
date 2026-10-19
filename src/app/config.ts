import { VIEW_HEIGHT, VIEW_WIDTH } from '../sim/constants';

export const VIEW_SIZE = { width: VIEW_WIDTH, height: VIEW_HEIGHT } as const;

/** Resolves a path under `public/` against the deployed app base, so the game works from any sub-path. */
export function assetUrl(path: string, base: string = import.meta.env.BASE_URL, documentBase: string = document.baseURI): string {
  return new URL(path.replace(/^\/+/, ''), new URL(base, documentBase)).href;
}

export const STORAGE_KEYS = {
  muted: 'noeyeswilly:muted',
} as const;

export const SOUND_KEYS = ['explosion', 'select', 'death', 'splash', 'powerup'] as const;

export const FINAL_LEVEL_INDEX = 7;

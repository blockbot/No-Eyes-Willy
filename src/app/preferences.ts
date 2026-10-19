import { STORAGE_KEYS } from './config';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Non-gameplay preferences only. Storage can be unavailable (private mode, blocked cookies), so every access is guarded. */
export class Preferences {
  constructor(private readonly store: KeyValueStore | null = Preferences.defaultStore()) {}

  private static defaultStore(): KeyValueStore | null {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  get muted(): boolean {
    try {
      return this.store?.getItem(STORAGE_KEYS.muted) === '1';
    } catch {
      return false;
    }
  }

  set muted(value: boolean) {
    try {
      this.store?.setItem(STORAGE_KEYS.muted, value ? '1' : '0');
    } catch {
      /* preference simply is not remembered */
    }
  }
}

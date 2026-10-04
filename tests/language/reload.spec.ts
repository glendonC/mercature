import { expect, test } from '@playwright/test';
import { reloadForUpdate } from '../../src/language/reload';

test('a page that outlived its build loads again once, then waits, and never offline', () => {
  const kept = new Map<string, string>(), saved = { sessionStorage: globalThis.sessionStorage, location: globalThis.location, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  let reloads = 0, online = true;
  Object.assign(globalThis, { sessionStorage: { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => kept.set(key, value) }, location: { reload: () => { reloads++; } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, get: () => ({ onLine: online }) });
  try {
    const now = 1_800_000_000_000;
    expect(reloadForUpdate(now)).toBe(true);
    expect(reloadForUpdate(now + 1000)).toBe(false);
    expect(reloadForUpdate(now + 6 * 60_000)).toBe(true);
    online = false;
    expect(reloadForUpdate(now + 20 * 60_000)).toBe(false);
    expect(reloads).toBe(2);
  } finally {
    Object.assign(globalThis, { sessionStorage: saved.sessionStorage, location: saved.location });
    if (saved.navigator) Object.defineProperty(globalThis, 'navigator', saved.navigator);
  }
});

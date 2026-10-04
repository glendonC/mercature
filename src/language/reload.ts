/**
 * Loads the page again when its code no longer matches the app on the server, as when a deploy lands while a page
 * is open or kept by the phone: the page asks for a code file the server no longer has, and a fresh load gets the
 * current build. At most once every few minutes in a tab, so a page that fails for another reason never loops, and
 * never offline, where loading again brings back the same page.
 */
const KEY = 'mercature.reloaded-for-update.v1';
const QUIET_MS = 5 * 60_000;

/** True when the page is loading again now. */
export function reloadForUpdate(now = Date.now()): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    if (now - Number(sessionStorage.getItem(KEY) ?? 0) < QUIET_MS) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    return false;
  }
  location.reload();
  return true;
}

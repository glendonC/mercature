/** Walks built on this device, kept in IndexedDB so they reopen offline. Nothing leaves the device. */
import type { Built, PlacePackage } from './build.ts';
import type { RoutePlace } from '../site/route.ts';

const DB = 'mercature-walks', STORE = 'walks';
export type SavedWalk = { id: string; title: string; target: string; area: string; savedAt: string };
type Row = { id: string; savedAt: string; place: PlacePackage; spots: RoutePlace };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('blocked'));
  });
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(db => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode), request = work(transaction.objectStore(STORE));
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error ?? request.error); };
  }));
}

/** A row read back is checked before use: a walk the device kept badly is left out, never opened half-read. */
function valid(row: unknown): row is Row {
  const r = row as Partial<Row> | null;
  return !!r && typeof r.id === 'string' && r.place?.schema === 'mercature-place/1' && r.place.id === r.id && Array.isArray(r.place.stretches) && Array.isArray(r.place.route?.line)
    && r.place.route.line.length > 1 && Array.isArray(r.spots?.features) && r.spots.id === r.id;
}

/** Keeps a built walk; false when this device would not (private browsing, no space). */
export async function saveWalk(built: Built): Promise<boolean> {
  try { await run('readwrite', store => store.put({ id: built.place.id, savedAt: new Date().toISOString(), place: built.place, spots: built.spots } satisfies Row)); return true; }
  catch { return false; }
}

export async function loadWalk(id: string): Promise<Built | null> {
  try { const row = await run('readonly', store => store.get(id)); return valid(row) ? { place: row.place, spots: row.spots } : null; }
  catch { return null; }
}

/** Every walk kept here, newest first. */
export async function listWalks(): Promise<SavedWalk[]> {
  try {
    const rows = await run<unknown[]>('readonly', store => store.getAll());
    return rows.filter(valid).map(row => ({ id: row.id, title: row.place.title, target: row.place.request.destination.name, area: row.place.place, savedAt: row.savedAt }))
      .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  } catch { return []; }
}

export async function forgetWalk(id: string): Promise<void> {
  try { await run('readwrite', store => store.delete(id)); } catch { /* Nothing kept, nothing to forget. */ }
}

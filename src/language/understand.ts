import type { IssueCategory, MessageKind, Site } from '../site/contracts';

/** Understanding needs only a place's id and named features; a full Site also fits. */
export type Place = Pick<Site, 'id' | 'features'>;
import { LANGUAGE_LIMITS, normalizeLanguageText } from './index';
import { ENCODER } from './model';
import { buildIndex, decide, looksSupported, passageTexts, prepareHeads, queryText, score, type FeatureIndex, type Heads, type PreparedHeads } from './policy';

/** Identity of the model that produced a result, so a saved decision can name its source. */
export type ModelInfo = { readonly id: string; readonly revision: string; readonly bytes: number };

export type ModelState =
  | { readonly status: 'absent' }
  | { readonly status: 'downloading'; readonly loadedBytes: number; readonly totalBytes: number }
  | { readonly status: 'ready'; readonly model: ModelInfo }
  | { readonly status: 'failed'; readonly error: string };

/** Why a person has to decide. */
export type UnsureReason = 'unclear-kind' | 'unclear-place' | 'no-place';

/**
 * ready: the model answered from its fixed lists.
 * unsure: it answered, but a person must decide; candidates may still be offered.
 *   unclear-kind: the message kind, or a problem's issue type, is unclear (that field is null),
 *     or the message does not look like English, Spanish or Korean.
 *   no-place: the message is not about a part of the site (price, booking, taste); no candidates.
 *   unclear-place: the top features are too close to call; candidates are offered in order.
 * unavailable: no usable model on this device; the manual workflow continues.
 * invalid: the message cannot be processed.
 */
export type Understanding = {
  readonly status: 'ready' | 'unsure' | 'unavailable' | 'invalid';
  readonly kind: MessageKind | null;
  /** Set only for problems. */
  readonly category: IssueCategory | null;
  /** Site feature ids, best first, at most three. Order only; never shown as a probability. */
  readonly candidates: readonly string[];
  readonly reason?: UnsureReason | 'model-missing' | 'model-failed' | 'invalid-input';
  readonly model?: ModelInfo;
  readonly elapsedMs?: number;
};

type Store = {
  readonly read: (key: string, count: number) => Promise<ArrayLike<number>[] | null>;
  readonly write: (key: string, vectors: readonly ArrayLike<number>[]) => Promise<void>;
};

type Loaded = {
  readonly embed: (text: string) => Promise<number[]>;
  /** Model set and revision, the prefix of every stored passage embedding. */
  readonly scope: string;
  readonly store: Store;
  readonly heads: PreparedHeads;
  readonly model: ModelInfo;
};

let state: ModelState = { status: 'absent' };
let preparing: Promise<ModelState> | null = null;
let loading: Promise<Loaded> | null = null;
const listeners = new Set<(state: ModelState) => void>();
type SiteIndex = {
  promise: Promise<FeatureIndex>;
  done: number;
  settled: boolean;
  /** Read from vectors stored in an earlier session rather than embedded now. */
  stored: boolean;
  readonly total: number;
  readonly listeners: Set<(done: number, total: number) => void>;
};
const indexCache = new Map<string, SiteIndex>();

function publish(next: ModelState) {
  state = next;
  for (const listener of listeners) listener(next);
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function modelState(): ModelState {
  return state;
}

/** True when the model is already stored on this device, so preparing it needs no connection. */
export async function modelStored(): Promise<boolean> {
  try {
    return await (await import('./encoder')).isProvisioned();
  } catch {
    return false;
  }
}

/**
 * Bytes prepareModel() would download from here: the smaller files when this origin serves them,
 * otherwise the Hub files, minus anything already stored; 0 when the model is on the device.
 * Null where it cannot be told, such as a browser without Cache Storage.
 */
export async function modelDownloadBytes(): Promise<number | null> {
  try {
    return await (await import('./encoder')).downloadBytes();
  } catch {
    return null;
  }
}

/** Reads the stored model into memory. Never downloads. */
function load(): Promise<Loaded> {
  loading ??= (async () => {
    const [encoder, heads] = await Promise.all([import('./encoder'), import('./heads.json')]);
    const { embed, set } = await encoder.loadEncoder();
    const weights = heads.default as unknown as Heads;
    const scope = `${set.name}:${ENCODER.revision}`;
    const store: Store = {
      read: (key, count) => encoder.readVectors(`${scope}:${key}`, count).catch(() => null),
      write: (key, vectors) => encoder.writeVectors(`${scope}:${key}`, vectors).catch(() => undefined),
    };
    const labelTexts = [...weights.kind.prototypes, ...weights.category.prototypes].flat();
    const labelKey = `labels:${hash(JSON.stringify(labelTexts))}`;
    const stored = await store.read(labelKey, labelTexts.length);
    const prepared = await prepareHeads(weights, stored ? storedEmbed(labelTexts, stored) : embed);
    if (!stored) await store.write(labelKey, [...prepared.kindVectors.flat(), ...prepared.categoryVectors.flat()]);
    const vocabulary = set.name === 'latin-hangul' ? '+latin-hangul' : '';
    const model: ModelInfo = { id: ENCODER.id, revision: `${ENCODER.revision}${vocabulary}+heads.${weights.version}`, bytes: set.modelBytes };
    publish({ status: 'ready', model });
    return { embed, scope, store, heads: prepared, model };
  })().catch(error => {
    loading = null;
    throw error;
  });
  return loading;
}

/** Downloads and caches the model once; later calls work offline. */
export async function prepareModel(onProgress?: (state: ModelState) => void): Promise<ModelState> {
  if (onProgress) listeners.add(onProgress);
  try {
    if (state.status === 'ready') {
      onProgress?.(state);
      return state;
    }
    preparing ??= (async () => {
      try {
        const encoder = await import('./encoder');
        if (!(await encoder.isProvisioned())) {
          await encoder.provision((loadedBytes, totalBytes) => publish({ status: 'downloading', loadedBytes, totalBytes }));
        }
        await load();
      } catch (error) {
        publish({ status: 'failed', error: errorText(error) });
      } finally {
        preparing = null;
      }
      return state;
    })();
    return await preparing;
  } finally {
    if (onProgress) listeners.delete(onProgress);
  }
}

/** 53-bit string hash (cyrb53); a cache key, not a security check. */
function hash(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Serves passage embeddings computed in an earlier session, in the order they were stored. */
function storedEmbed(texts: readonly string[], vectors: readonly ArrayLike<number>[]) {
  const byText = new Map(texts.map((text, i) => [text, vectors[i]]));
  return async (text: string) => {
    const vector = byText.get(text);
    if (!vector) throw new Error('A stored passage embedding is missing.');
    return vector;
  };
}

/** The site index is keyed by model set and revision, site id and the exact feature passages. */
function siteIndex(site: Place, loaded: Loaded): SiteIndex {
  const passages = site.features.map(feature => [feature.id, passageTexts(feature)] as const);
  const key = `${loaded.scope}:${site.id}:${hash(JSON.stringify(passages))}`;
  const existing = indexCache.get(key);
  if (existing) return existing;
  const texts = passages.flatMap(([, texts]) => [texts.full, ...texts.lists]);
  const storeKey = `place:${site.id}:${hash(JSON.stringify(passages))}`;
  const entry: SiteIndex = { promise: Promise.resolve([]), done: 0, settled: false, stored: false, total: site.features.length, listeners: new Set() };
  entry.promise = (async () => {
    const stored = await loaded.store.read(storeKey, texts.length);
    if (stored) {
      entry.stored = true;
      return buildIndex(site.features, storedEmbed(texts, stored));
    }
    const index = await buildIndex(site.features, loaded.embed, () => {
      entry.done++;
      for (const listener of entry.listeners) listener(entry.done, entry.total);
    });
    await loaded.store.write(storeKey, index.flatMap(feature => [feature.full, ...feature.lists]));
    return index;
  })().then(index => {
    entry.settled = true;
    return index;
  });
  entry.promise.catch(() => indexCache.delete(key));
  indexCache.set(key, entry);
  return entry;
}

/**
 * Embeds a site's features ahead of the first message, with one progress tick per feature.
 * Works only on an already loaded model: it never downloads and never loads.
 */
export async function prepareSite(site: Place, onProgress?: (done: number, total: number) => void): Promise<'embedded' | 'cached' | 'unavailable'> {
  if (state.status !== 'ready' || !loading || !site?.features?.length) return 'unavailable';
  try {
    const entry = siteIndex(site, await loading);
    if (entry.settled) return 'cached';
    if (onProgress) entry.listeners.add(onProgress);
    try {
      await entry.promise;
    } finally {
      if (onProgress) entry.listeners.delete(onProgress);
    }
    return entry.stored ? 'cached' : 'embedded';
  } catch {
    return 'unavailable';
  }
}

export async function understand(message: string, site: Place): Promise<Understanding> {
  const length = typeof message === 'string' ? Array.from(message).length : 0;
  if (!length || length > LANGUAGE_LIMITS.messageCodePoints || !normalizeLanguageText(message) || !site?.features?.length) {
    return { status: 'invalid', kind: null, category: null, candidates: [], reason: 'invalid-input' };
  }
  const started = performance.now();
  if (state.status !== 'ready' && !(await modelStored())) {
    return { status: 'unavailable', kind: null, category: null, candidates: [], reason: 'model-missing' };
  }
  try {
    const loaded = await load();
    const index = await siteIndex(site, loaded).promise;
    const query = await loaded.embed(queryText(message));
    const decision = decide(score(query, index, loaded.heads), loaded.heads, looksSupported(message));
    return { ...decision, model: loaded.model, elapsedMs: Math.round(performance.now() - started) };
  } catch (error) {
    if (state.status !== 'ready') publish({ status: 'failed', error: errorText(error) });
    return { status: 'unavailable', kind: null, category: null, candidates: [], reason: 'model-failed' };
  }
}


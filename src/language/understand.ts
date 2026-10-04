import type { IssueCategory, MessageKind, Site } from '../site/contracts';

/** Understanding needs only a place's id and named features; a full Site also fits. */
export type Place = Pick<Site, 'id' | 'features'>;
import { LANGUAGE_LIMITS, normalizeLanguageText } from './index';
import type { StoredExample } from './encoder';
import { recall, remembered, sketch } from './memory';
import { reloadForUpdate } from './reload';
import { ENCODER } from './model';
import { decide, looksSupported, passageTexts, prepareHeads, queryText, score, type FeatureIndex, type Heads, type PreparedHeads } from './policy';

/** Identity of the model that produced a result, so a saved decision can name its source. */
export type ModelInfo = { readonly id: string; readonly revision: string; readonly bytes: number };

export type ModelState =
  | { readonly status: 'absent' }
  | { readonly status: 'downloading'; readonly loadedBytes: number; readonly totalBytes: number }
  | { readonly status: 'ready'; readonly model: ModelInfo }
  | { readonly status: 'failed'; readonly error: string }
  /** This page's code is older than the app on the server, so the model's code cannot load until the page loads again. The stored model is fine. */
  | { readonly status: 'outdated' };

/** Why a person has to decide. */
export type UnsureReason = 'unclear-kind' | 'unclear-place' | 'no-place' | 'remembered';

/**
 * ready: the model answered from its fixed lists.
 * unsure: it answered, but a person must decide; candidates may still be offered.
 *   unclear-kind: the message kind, or a problem's issue type, is unclear (that field is null),
 *     or the message does not look like English, Spanish or Korean.
 *   no-place: the message is not about a part of the site (price, booking, taste); no candidates.
 *   unclear-place: the top features are too close to call; candidates are offered in order.
 *   remembered: the message does not look like English, Spanish or Korean, and its first
 *     candidate comes from a similar message the operator linked to a spot before (remember()).
 *     Kind and issue type stay null.
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
  /** The examples kept for one place; writing throws when the device cannot store them. */
  readonly examples: {
    readonly read: (placeId: string) => Promise<StoredExample[]>;
    readonly write: (placeId: string, examples: readonly StoredExample[]) => Promise<void>;
  };
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
  /** Every spot came from vectors kept earlier; none was embedded now. */
  stored: boolean;
  readonly total: number;
  readonly listeners: Set<(done: number, total: number) => void>;
};
const indexCache = new Map<string, SiteIndex>();
type SpotVectors = { readonly vectors: readonly ArrayLike<number>[]; readonly embedded: boolean };
/** Each spot's passage vectors, by model set, revision and its exact passages, shared by every place and edit. */
const spotCache = new Map<string, Promise<SpotVectors>>();

function publish(next: ModelState) {
  state = next;
  for (const listener of listeners) listener(next);
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * A piece of the model's code, loaded on first use and asked for once more if that fails. When both fail, the page
 * outlived its build: it loads again once (reload.ts), or else the model is 'outdated', never 'absent'.
 */
async function code<T>(load: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      // A cancelled preload error, while the page loads again, gives undefined rather than the module.
      const module = await load();
      if (module) return module;
      throw new Error('The model code did not load.');
    } catch (error) {
      // Without Cache Storage the model cannot be kept here at all, so its code not loading says nothing about the build.
      if (typeof caches === 'undefined') throw error;
      if (attempt === 0) continue;
      if (!reloadForUpdate()) publish({ status: 'outdated' });
      throw error;
    }
  }
}
const encoderCode = () => code(() => import('./encoder'));

export function modelState(): ModelState {
  return state;
}

/** True when the model is already stored on this device, so preparing it needs no connection. */
export async function modelStored(): Promise<boolean> {
  try {
    return await (await encoderCode()).isProvisioned();
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
    return await (await encoderCode()).downloadBytes();
  } catch {
    return null;
  }
}

/** Reads the stored model into memory. Never downloads. */
function load(): Promise<Loaded> {
  loading ??= (async () => {
    const [encoder, heads] = await Promise.all([encoderCode(), code(() => import('./heads.json'))]);
    const { embed, set } = await encoder.loadEncoder();
    const weights = heads.default as unknown as Heads;
    const scope = `${set.name}:${ENCODER.revision}`;
    const store: Store = {
      read: (key, count) => encoder.readVectors(`${scope}:${key}`, count).catch(() => null),
      write: (key, vectors) => encoder.writeVectors(`${scope}:${key}`, vectors).catch(() => undefined),
    };
    const examples = {
      read: (placeId: string) => encoder.readExamples(memoryKey(scope, placeId)).catch(() => []),
      write: (placeId: string, list: readonly StoredExample[]) => encoder.writeExamples(memoryKey(scope, placeId), list),
    };
    const labelTexts = [...weights.kind.prototypes, ...weights.category.prototypes].flat();
    const labelKey = `labels:${hash(JSON.stringify(labelTexts))}`;
    const stored = await store.read(labelKey, labelTexts.length);
    const prepared = await prepareHeads(weights, stored ? storedEmbed(labelTexts, stored) : embed);
    if (!stored) await store.write(labelKey, [...prepared.kindVectors.flat(), ...prepared.categoryVectors.flat()]);
    const vocabulary = set.name === 'latin-hangul' ? '+latin-hangul' : '';
    const model: ModelInfo = { id: ENCODER.id, revision: `${ENCODER.revision}${vocabulary}+heads.${weights.version}`, bytes: set.modelBytes };
    publish({ status: 'ready', model });
    return { embed, scope, store, examples, heads: prepared, model };
  })().catch(error => {
    loading = null;
    throw error;
  });
  return loading;
}

/**
 * After a load that failed: when reading the stored files back finds broken ones, they are gone and the model is
 * absent again, so she is offered the download instead of an error she cannot leave. Otherwise the failure stands.
 */
async function settleFailure(error: unknown): Promise<void> {
  if (state.status === 'outdated') return;
  const repaired = await encoderCode().then(encoder => encoder.repairStored()).catch(() => false);
  // Loading the code for the repair can itself find the page outdated.
  if (modelState().status === 'outdated') return;
  if (repaired) publish({ status: 'absent' });
  else publish({ status: 'failed', error: errorText(error) });
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
        const encoder = await encoderCode();
        if (!(await encoder.isProvisioned())) {
          await encoder.provision((loadedBytes, totalBytes) => publish({ status: 'downloading', loadedBytes, totalBytes }));
        }
        await load();
      } catch (error) {
        await settleFailure(error);
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

/**
 * A spot's vectors: from this session, else from the device, else embedded now and kept. Keyed by
 * its passages only, so editing a place embeds just the spots whose passages changed.
 */
function spotVectors(texts: readonly string[], loaded: Loaded): Promise<SpotVectors> {
  const storeKey = `spot:${hash(JSON.stringify(texts))}`;
  const key = `${loaded.scope}:${storeKey}`;
  let entry = spotCache.get(key);
  if (!entry) {
    entry = (async () => {
      const stored = await loaded.store.read(storeKey, texts.length);
      if (stored) return { vectors: stored, embedded: false };
      const vectors = [];
      for (const text of texts) vectors.push(await loaded.embed(text));
      await loaded.store.write(storeKey, vectors);
      return { vectors, embedded: true };
    })();
    entry.catch(() => spotCache.delete(key));
    spotCache.set(key, entry);
  }
  return entry;
}

/** The site index is keyed by model set and revision, site id and the exact feature passages. */
function siteIndex(site: Place, loaded: Loaded): SiteIndex {
  const passages = site.features.map(feature => [feature.id, passageTexts(feature)] as const);
  const key = `${loaded.scope}:${site.id}:${hash(JSON.stringify(passages))}`;
  const existing = indexCache.get(key);
  if (existing) return existing;
  const entry: SiteIndex = { promise: Promise.resolve([]), done: 0, settled: false, stored: true, total: site.features.length, listeners: new Set() };
  entry.promise = (async () => {
    // Same order and vectors as buildIndex(): the full passage, then one word list per language.
    const index = [];
    for (const [id, texts] of passages) {
      const { vectors, embedded } = await spotVectors([texts.full, ...texts.lists], loaded);
      if (embedded) entry.stored = false;
      index.push({ id, full: vectors[0], lists: vectors.slice(1) });
      entry.done++;
      for (const listener of entry.listeners) listener(entry.done, entry.total);
    }
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
 * Embeds a site's features ahead of the first message, with one progress tick per feature; a
 * feature whose passages were embedded before (in any place, on this device) ticks at once.
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

const validMessage = (message: string) => {
  const length = typeof message === 'string' ? Array.from(message).length : 0;
  return length > 0 && length <= LANGUAGE_LIMITS.messageCodePoints && !!normalizeLanguageText(message);
};

export async function understand(message: string, site: Place): Promise<Understanding> {
  if (!validMessage(message) || !site?.features?.length) {
    return { status: 'invalid', kind: null, category: null, candidates: [], reason: 'invalid-input' };
  }
  const started = performance.now();
  if (state.status !== 'ready' && !(await modelStored())) {
    return { status: 'unavailable', kind: null, category: null, candidates: [], reason: state.status === 'outdated' ? 'model-failed' : 'model-missing' };
  }
  try {
    const loaded = await load();
    const index = await siteIndex(site, loaded).promise;
    const query = await loaded.embed(queryText(message));
    const scores = score(query, index, loaded.heads);
    const supported = looksSupported(message);
    let decision = decide(scores, loaded.heads, supported);
    // Only messages that fail the language check: on held-out messages the English, Spanish and
    // Korean recall once put a wrong spot first (docs/language.md), and it gained nothing there.
    const examples = supported ? [] : await examplesOf(loaded, site.id);
    if (examples.length) {
      const recalled = recall({ vector: query, grams: sketch(message) }, examples, new Set(index.map(feature => feature.id)), supported);
      decision = remembered(decision, scores, recalled, supported);
    }
    return { ...decision, model: loaded.model, elapsedMs: Math.round(performance.now() - started) };
  } catch (error) {
    if (state.status !== 'ready') await settleFailure(error);
    return { status: 'unavailable', kind: null, category: null, candidates: [], reason: state.status === 'absent' ? 'model-missing' : 'model-failed' };
  }
}

/** At most this many examples are kept per place; the oldest go first. */
const MEMORY_LIMIT = 100;
const memoryKey = (scope: string, placeId: string) => `${scope}:memory:${placeId}`;
/** Examples read once per model and place, then kept up to date in memory. */
const memories = new Map<string, Promise<StoredExample[]>>();
/** Changes to the memory run one at a time, in call order. */
let memoryQueue: Promise<unknown> = Promise.resolve();
const queued = <T>(change: () => Promise<T>): Promise<T> => {
  const result = memoryQueue.then(change);
  memoryQueue = result.catch(() => undefined);
  return result;
};

function examplesOf(loaded: Loaded, placeId: string): Promise<StoredExample[]> {
  const key = memoryKey(loaded.scope, placeId);
  let entry = memories.get(key);
  if (!entry) {
    entry = loaded.examples.read(placeId);
    memories.set(key, entry);
  }
  return entry;
}

/**
 * Keeps a message the operator linked to a spot ("Yes, this spot") so that close new messages
 * about this place rank that spot first. Stores the message's embedding, a sketch of its spelling,
 * the spot and the time, never the text; linking the same message again replaces its example.
 * Loads a stored model when needed and never downloads. False when nothing was kept.
 */
export async function remember(message: string, place: Place, spotId: string): Promise<boolean> {
  if (!validMessage(message) || !place?.features?.some(feature => feature.id === spotId)) return false;
  try {
    if (state.status !== 'ready' && !(await modelStored())) return false;
    const id = hash(normalizeLanguageText(message));
    // Queued as a whole, so a later forgetPlace() cannot run before this example is kept.
    return await queued(async () => {
      const loaded = await load();
      const vector = await loaded.embed(queryText(message));
      const kept = await examplesOf(loaded, place.id);
      const next = [...kept.filter(example => example.id !== id), { id, spot: spotId, at: new Date().toISOString(), vector, grams: sketch(message) }].slice(-MEMORY_LIMIT);
      await loaded.examples.write(place.id, next);
      memories.set(memoryKey(loaded.scope, place.id), Promise.resolve(next));
      return true;
    });
  } catch {
    return false;
  }
}

/** Deletes every example kept for a place, for example when the operator starts over. */
export async function forgetPlace(placeId: string): Promise<void> {
  await queued(async () => {
    try {
      await (await encoderCode()).deleteExamples(placeId);
    } finally {
      // After the stored copy is gone, so no read in between can bring it back.
      for (const key of memories.keys()) if (key.endsWith(`:memory:${placeId}`)) memories.delete(key);
    }
  }).catch(() => undefined);
}

/** How many examples are kept for a place with the model stored on this device. */
export async function rememberedCount(placeId: string): Promise<number> {
  try {
    await memoryQueue;
    if (loading && state.status === 'ready') return (await examplesOf(await loading, placeId)).length;
    const encoder = await encoderCode();
    const set = await encoder.storedSetName();
    return set ? (await encoder.readExamples(memoryKey(`${set}:${ENCODER.revision}`, placeId))).length : 0;
  } catch {
    return 0;
  }
}

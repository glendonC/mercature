import type { IssueCategory, MessageKind, Site } from '../site/contracts';
import { LANGUAGE_LIMITS, normalizeLanguageText } from './index';
import { ENCODER, ENCODER_BYTES } from './model';
import { buildIndex, decide, passageTexts, prepareHeads, queryText, score, type FeatureIndex, type Heads, type PreparedHeads } from './policy';

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
 *   unclear-kind: the message kind, or a problem's issue type, is unclear (that field is null).
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

type Loaded = {
  readonly embed: (text: string) => Promise<number[]>;
  readonly heads: PreparedHeads;
  readonly model: ModelInfo;
};

let state: ModelState = { status: 'absent' };
let preparing: Promise<ModelState> | null = null;
let loading: Promise<Loaded> | null = null;
const listeners = new Set<(state: ModelState) => void>();
const indexCache = new Map<string, Promise<FeatureIndex>>();

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

/** Reads the stored model into memory. Never downloads. */
function load(): Promise<Loaded> {
  loading ??= (async () => {
    const [encoder, heads] = await Promise.all([import('./encoder'), import('./heads.json')]);
    const { embed } = await encoder.loadEncoder();
    const weights = heads.default as unknown as Heads;
    const prepared = await prepareHeads(weights, embed);
    const model: ModelInfo = { id: ENCODER.id, revision: `${ENCODER.revision}+heads.${weights.version}`, bytes: ENCODER_BYTES };
    publish({ status: 'ready', model });
    return { embed, heads: prepared, model };
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

function siteIndex(site: Site, loaded: Loaded): Promise<FeatureIndex> {
  const key = `${site.id}\u0000${JSON.stringify(site.features.map(feature => [feature.id, passageTexts(feature)]))}`;
  let index = indexCache.get(key);
  if (!index) {
    index = buildIndex(site.features, loaded.embed);
    index.catch(() => indexCache.delete(key));
    indexCache.set(key, index);
  }
  return index;
}

export async function understand(message: string, site: Site): Promise<Understanding> {
  const length = typeof message === 'string' ? Array.from(message).length : 0;
  if (!length || length > LANGUAGE_LIMITS.messageCodePoints || !normalizeLanguageText(message) || !site.features.length) {
    return { status: 'invalid', kind: null, category: null, candidates: [], reason: 'invalid-input' };
  }
  const started = performance.now();
  if (state.status !== 'ready' && !(await modelStored())) {
    return { status: 'unavailable', kind: null, category: null, candidates: [], reason: 'model-missing' };
  }
  try {
    const loaded = await load();
    const index = await siteIndex(site, loaded);
    const query = await loaded.embed(queryText(message));
    const decision = decide(score(query, index, loaded.heads), loaded.heads);
    return { ...decision, model: loaded.model, elapsedMs: Math.round(performance.now() - started) };
  } catch (error) {
    if (state.status !== 'ready') publish({ status: 'failed', error: errorText(error) });
    return { status: 'unavailable', kind: null, category: null, candidates: [], reason: 'model-failed' };
  }
}


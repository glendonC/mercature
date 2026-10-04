import { Tokenizer } from '@huggingface/tokenizers';
import * as ort from 'onnxruntime-web/wasm';
import runtimeGlueUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import runtimeWasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import { createEmbedder } from './embedding';
import { ENCODER, ENCODER_BYTES, RUNTIME_WASM, TRIMMED_BYTES, TRIMMED_ENCODER, encoderFileUrl, type PinnedFile } from './model';

/**
 * Browser side of the encoder. Files are downloaded once with real byte counts, checked against
 * pinned SHA-256 hashes and stored in Cache Storage. Loading reads only that cache, never the network.
 */

export const MODEL_CACHE = `mercature-model-${ENCODER.revision.slice(0, 12)}`;

const runtimeSource = new URL(runtimeWasmUrl, location.href).href;
const runtimeKey = new URL(`/language-runtime/${RUNTIME_WASM.sha256.slice(0, 16)}/${RUNTIME_WASM.path}`, location.origin).href;

type Download = { readonly file: PinnedFile; readonly key: string; readonly source: string };

/** A complete set of encoder files; the smaller same-origin set is preferred when it is served. */
export type ModelSet = { readonly name: 'latin-hangul' | 'full'; readonly modelBytes: number; readonly downloads: readonly Download[] };

const runtime: Download = { file: RUNTIME_WASM, key: runtimeKey, source: runtimeSource };
const sameOrigin = (path: string) => new URL(`${import.meta.env.BASE_URL}${TRIMMED_ENCODER.directory}${path}`, location.href).href;
const sets: readonly ModelSet[] = [
  {
    name: 'latin-hangul',
    modelBytes: TRIMMED_BYTES,
    downloads: [...TRIMMED_ENCODER.files.map(file => ({ file, key: sameOrigin(file.path), source: sameOrigin(file.path) })), runtime],
  },
  {
    name: 'full',
    modelBytes: ENCODER_BYTES,
    downloads: [...ENCODER.files.map(file => ({ file, key: encoderFileUrl(file.path), source: encoderFileUrl(file.path) })), runtime],
  },
];
const pathOf = (set: ModelSet, path: string) => set.downloads.find(item => item.file.path === path)!.key;

async function openCache(): Promise<Cache> {
  if (typeof caches === 'undefined') throw new Error('This browser has no Cache Storage, so the model cannot be kept on the device.');
  return caches.open(MODEL_CACHE);
}

async function storedBytes(cache: Cache, item: Download): Promise<number> {
  const response = await cache.match(item.key);
  return response && response.headers.get('x-mercature-sha256') === item.file.sha256 ? item.file.bytes : 0;
}

async function listedSet(cache: Cache): Promise<ModelSet | null> {
  for (const set of sets) {
    const stored = await Promise.all(set.downloads.map(item => storedBytes(cache, item)));
    if (stored.every(bytes => bytes > 0)) return set;
  }
  return null;
}

const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');

/** A stored file read back: its body's length, and with whole its pinned hash as well. */
async function intact(cache: Cache, item: Download, whole: boolean): Promise<boolean> {
  try {
    const response = await cache.match(item.key);
    if (!response || response.headers.get('x-mercature-sha256') !== item.file.sha256) return false;
    if (!whole) return (await response.blob()).size === item.file.bytes;
    const data = await response.arrayBuffer();
    return data.byteLength === item.file.bytes && hex(await crypto.subtle.digest('SHA-256', data)) === item.file.sha256;
  } catch {
    return false;
  }
}

/** Files read back and found broken this session, so a load that fails can say the model needs downloading again. */
let repaired = false;
let checked: Promise<ModelSet | null> | null = null;
/**
 * The stored set, its files' lengths read back once per session, and with whole every hash too. A browser can keep
 * a file's record after a quit while its body did not survive, so the record alone is not proof. Broken files are
 * deleted, which makes the set incomplete and offers the download again; files that read back intact are kept.
 */
function storedSet(cache: Cache, whole = false): Promise<ModelSet | null> {
  checked ??= (async () => {
    const set = await listedSet(cache);
    if (!set) return null;
    const broken: Download[] = [];
    for (const item of set.downloads) if (!(await intact(cache, item, whole))) broken.push(item);
    if (!broken.length) return set;
    for (const item of broken) await cache.delete(item.key).catch(() => false);
    repaired = true;
    return null;
  })().catch(error => {
    checked = null;
    throw error;
  });
  return checked;
}

/** Reads every stored file back whole after a load that failed, hashes included. True when broken files were found and deleted. */
export async function repairStored(): Promise<boolean> {
  if (typeof caches === 'undefined' || !(await caches.has(MODEL_CACHE))) return false;
  checked = null;
  repaired = false;
  await storedSet(await openCache(), true);
  return repaired;
}

/** True when every file of one model set is already stored and verified on this device. */
export async function isProvisioned(): Promise<boolean> {
  if (typeof caches === 'undefined' || !(await caches.has(MODEL_CACHE))) return false;
  return (await storedSet(await openCache())) !== null;
}

async function fetchVerified(item: Download, onBytes: (received: number) => void): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(item.source, { cache: 'no-store', credentials: 'omit' });
  if (!response.ok || !response.body) throw new Error(`Download failed for ${item.file.path}: HTTP ${response.status}`);
  const data = new Uint8Array(item.file.bytes);
  const reader = response.body.getReader();
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (received + value.length > item.file.bytes) {
      await reader.cancel();
      throw new Error(`Download of ${item.file.path} is larger than expected.`);
    }
    data.set(value, received);
    received += value.length;
    onBytes(received);
  }
  if (received !== item.file.bytes) throw new Error(`Download of ${item.file.path} stopped early.`);
  if (hex(await crypto.subtle.digest('SHA-256', data)) !== item.file.sha256) {
    throw new Error(`Download of ${item.file.path} does not match its pinned hash.`);
  }
  return data;
}

const store = (cache: Cache, item: Download, data: Uint8Array<ArrayBuffer>) => cache.put(item.key, new Response(data, {
  headers: { 'content-type': 'application/octet-stream', 'x-mercature-sha256': item.file.sha256 },
}));

/** The smaller set is used only if this origin serves its first file intact. */
async function chooseSet(cache: Cache): Promise<ModelSet> {
  const [trimmed, full] = sets;
  const probe = trimmed.downloads[0];
  if (await storedBytes(cache, probe)) return trimmed;
  try {
    await store(cache, probe, await fetchVerified(probe, () => undefined));
    return trimmed;
  } catch {
    return full;
  }
}

/** Bytes provision() would download now: the chosen set's files not yet stored, 0 when a set is complete. */
export async function downloadBytes(): Promise<number> {
  const cache = await openCache();
  if (await storedSet(cache)) return 0;
  const set = await chooseSet(cache);
  const stored = await Promise.all(set.downloads.map(item => storedBytes(cache, item)));
  return set.downloads.reduce((sum, item, i) => sum + (stored[i] ? 0 : item.file.bytes), 0);
}

/** Downloads missing files in order; completed files survive an interrupted provisioning. */
export async function provision(onProgress: (loadedBytes: number, totalBytes: number) => void): Promise<void> {
  const cache = await openCache();
  if (await storedSet(cache)) return;
  const set = await chooseSet(cache);
  const total = set.downloads.reduce((sum, item) => sum + item.file.bytes, 0);
  const stored = await Promise.all(set.downloads.map(item => storedBytes(cache, item)));
  let completed = stored.reduce((sum, bytes) => sum + bytes, 0);
  let reported = completed;
  onProgress(completed, total);
  for (const [i, item] of set.downloads.entries()) {
    if (stored[i]) continue;
    const data = await fetchVerified(item, received => {
      // At most one update per megabyte, plus the end of each file.
      if (completed + received - reported < 1_000_000 && received !== item.file.bytes) return;
      reported = completed + received;
      onProgress(reported, total);
    });
    await store(cache, item, data);
    completed += item.file.bytes;
  }
  // Every file was checked as it arrived, so this session needs no read-back.
  checked = Promise.resolve(set);
  repaired = false;
  keepStored();
}

/**
 * Asks once, right after a download the operator started, that the browser keep the stored files
 * under storage pressure, so a phone on a paid data bundle does not download them again. Not
 * awaited, because Firefox asks the person first.
 */
function keepStored(): void {
  try {
    const storage = navigator.storage;
    if (!storage?.persist || !storage.persisted) return;
    storage.persisted().then(persisted => persisted || storage.persist()).catch(() => false);
  } catch {
    // Keeping the files is a request the browser may refuse; the model works either way.
  }
}

const vectorUrl = (key: string) => new URL(`/language-vectors/${encodeURIComponent(key)}`, location.origin).href;

/**
 * Embeddings of fixed passages (label descriptions, a place's spots) kept on the device so later
 * sessions skip recomputing them. Answers are never stored, and a message's embedding and spelling
 * sketch only when the operator links that message to a spot (the examples below).
 */
export async function readVectors(key: string, count: number): Promise<Float64Array[] | null> {
  const response = await (await openCache()).match(vectorUrl(key));
  if (!response) return null;
  const data = new Float64Array(await response.arrayBuffer());
  const size = ENCODER.dimensions;
  if (data.length !== count * size) return null;
  return Array.from({ length: count }, (_, i) => data.subarray(i * size, (i + 1) * size));
}

export async function writeVectors(key: string, vectors: readonly ArrayLike<number>[]): Promise<void> {
  const size = ENCODER.dimensions;
  const data = new Float64Array(vectors.length * size);
  vectors.forEach((vector, i) => data.set(vector, i * size));
  await (await openCache()).put(vectorUrl(key), new Response(data, { headers: { 'content-type': 'application/octet-stream' } }));
}

/** A message the operator linked to a spot: its embedding, its spelling sketch, the spot and the time, never its text. */
export type StoredExample = {
  readonly id: string;
  readonly spot: string;
  readonly at: string;
  readonly vector: readonly number[];
  readonly grams: readonly (readonly [number, number])[];
};

const isExample = (value: unknown): value is StoredExample => {
  const item = value as StoredExample;
  return !!item && typeof item.id === 'string' && typeof item.spot === 'string' && typeof item.at === 'string' &&
    Array.isArray(item.vector) && item.vector.length === ENCODER.dimensions && item.vector.every(Number.isFinite) &&
    Array.isArray(item.grams) && item.grams.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(Number.isInteger));
};

/** A place's kept examples; an entry that does not parse counts as none. */
export async function readExamples(key: string): Promise<StoredExample[]> {
  const response = await (await openCache()).match(vectorUrl(key));
  if (!response) return [];
  const data = await response.json().catch(() => null) as { examples?: unknown } | null;
  return Array.isArray(data?.examples) && data.examples.every(isExample) ? data.examples : [];
}

export async function writeExamples(key: string, examples: readonly StoredExample[]): Promise<void> {
  await (await openCache()).put(vectorUrl(key), new Response(JSON.stringify({ examples }), { headers: { 'content-type': 'application/json' } }));
}

/** Deletes the examples kept for a place under every model set and revision. */
export async function deleteExamples(placeId: string): Promise<void> {
  if (typeof caches === 'undefined' || !(await caches.has(MODEL_CACHE))) return;
  const cache = await openCache();
  const suffix = `:memory:${placeId}`;
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/language-vectors/') && decodeURIComponent(path.slice('/language-vectors/'.length)).endsWith(suffix)) await cache.delete(request);
  }
}

/** Name of the model set stored on this device, without loading it; null when none is complete. */
export async function storedSetName(): Promise<ModelSet['name'] | null> {
  if (typeof caches === 'undefined' || !(await caches.has(MODEL_CACHE))) return null;
  return (await storedSet(await openCache()))?.name ?? null;
}

export type Encoder = { readonly embed: (text: string) => Promise<number[]>; readonly set: Pick<ModelSet, 'name' | 'modelBytes'> };

let loading: Promise<Encoder> | null = null;

/** Builds the inference session from stored files only. Fails rather than downloading. */
export function loadEncoder(): Promise<Encoder> {
  loading ??= createEncoder().catch(error => {
    loading = null;
    throw error;
  });
  return loading;
}

async function createEncoder(): Promise<Encoder> {
  const cache = await openCache();
  const set = await storedSet(cache);
  if (!set) throw new Error('The language model is not stored on this device.');
  const read = async (key: string) => {
    const response = await cache.match(key);
    if (!response) throw new Error('The language model is not stored on this device.');
    return response;
  };
  const [wasm, tokenizerJson, tokenizerConfig, weights] = await Promise.all([
    read(runtimeKey).then(response => response.arrayBuffer()),
    read(pathOf(set, 'tokenizer.json')).then(response => response.json()),
    read(pathOf(set, 'tokenizer_config.json')).then(response => response.json()),
    read(pathOf(set, 'onnx/model_quantized.onnx')).then(response => response.arrayBuffer()),
  ]);
  // The 20 KB loader is part of the app shell; the 11 MB binary comes from the device cache.
  ort.env.wasm.wasmBinary = wasm;
  ort.env.wasm.wasmPaths = { mjs: new URL(runtimeGlueUrl, location.href).href, wasm: runtimeSource };
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  const session = await ort.InferenceSession.create(new Uint8Array(weights), { executionProviders: ['wasm'] });
  return {
    embed: createEmbedder(new Tokenizer(tokenizerJson, tokenizerConfig), session, ort.Tensor),
    set: { name: set.name, modelBytes: set.modelBytes },
  };
}

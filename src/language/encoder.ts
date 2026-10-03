import { Tokenizer } from '@huggingface/tokenizers';
import * as ort from 'onnxruntime-web/wasm';
import runtimeGlueUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import runtimeWasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import { createEmbedder } from './embedding';
import { ENCODER, PROVISION_BYTES, RUNTIME_WASM, encoderFileUrl, type PinnedFile } from './model';

/**
 * Browser side of the encoder. Files are downloaded once with real byte counts, checked against
 * pinned SHA-256 hashes and stored in Cache Storage. Loading reads only that cache, never the network.
 */

export const MODEL_CACHE = `mercature-model-${ENCODER.revision.slice(0, 12)}`;

const runtimeSource = new URL(runtimeWasmUrl, location.href).href;
const runtimeKey = new URL(`/language-runtime/${RUNTIME_WASM.sha256.slice(0, 16)}/${RUNTIME_WASM.path}`, location.origin).href;

type Download = { readonly file: PinnedFile; readonly key: string; readonly source: string };

const downloads: readonly Download[] = [
  ...ENCODER.files.map(file => ({ file, key: encoderFileUrl(file.path), source: encoderFileUrl(file.path) })),
  { file: RUNTIME_WASM, key: runtimeKey, source: runtimeSource },
];

async function openCache(): Promise<Cache> {
  if (typeof caches === 'undefined') throw new Error('This browser has no Cache Storage, so the model cannot be kept on the device.');
  return caches.open(MODEL_CACHE);
}

async function storedBytes(cache: Cache, item: Download): Promise<number> {
  const response = await cache.match(item.key);
  return response && response.headers.get('x-mercature-sha256') === item.file.sha256 ? item.file.bytes : 0;
}

/** True when every pinned file is already stored and verified on this device. */
export async function isProvisioned(): Promise<boolean> {
  if (typeof caches === 'undefined' || !(await caches.has(MODEL_CACHE))) return false;
  const cache = await openCache();
  const stored = await Promise.all(downloads.map(item => storedBytes(cache, item)));
  return stored.every(bytes => bytes > 0);
}

const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');

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

/** Downloads missing files in order; completed files survive an interrupted provisioning. */
export async function provision(onProgress: (loadedBytes: number, totalBytes: number) => void): Promise<void> {
  const cache = await openCache();
  const stored = await Promise.all(downloads.map(item => storedBytes(cache, item)));
  let completed = stored.reduce((sum, bytes) => sum + bytes, 0);
  onProgress(completed, PROVISION_BYTES);
  let reported = completed;
  for (const [i, item] of downloads.entries()) {
    if (stored[i]) continue;
    const data = await fetchVerified(item, received => {
      // At most one update per megabyte, plus the end of each file.
      if (completed + received - reported < 1_000_000 && received !== item.file.bytes) return;
      reported = completed + received;
      onProgress(reported, PROVISION_BYTES);
    });
    await cache.put(item.key, new Response(data, {
      headers: { 'content-type': 'application/octet-stream', 'x-mercature-sha256': item.file.sha256 },
    }));
    completed += item.file.bytes;
  }
  await navigator.storage?.persist?.().catch(() => false);
}

export type Encoder = { readonly embed: (text: string) => Promise<number[]> };

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
  const read = async (key: string) => {
    const response = await cache.match(key);
    if (!response) throw new Error('The language model is not stored on this device.');
    return response;
  };
  const [wasm, tokenizerJson, tokenizerConfig, weights] = await Promise.all([
    read(runtimeKey).then(response => response.arrayBuffer()),
    read(encoderFileUrl('tokenizer.json')).then(response => response.json()),
    read(encoderFileUrl('tokenizer_config.json')).then(response => response.json()),
    read(encoderFileUrl('onnx/model_quantized.onnx')).then(response => response.arrayBuffer()),
  ]);
  // The 20 KB loader is part of the app shell; the 11 MB binary comes from the device cache.
  ort.env.wasm.wasmBinary = wasm;
  ort.env.wasm.wasmPaths = { mjs: new URL(runtimeGlueUrl, location.href).href, wasm: runtimeSource };
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  const session = await ort.InferenceSession.create(new Uint8Array(weights), { executionProviders: ['wasm'] });
  return { embed: createEmbedder(new Tokenizer(tokenizerJson, tokenizerConfig), session, ort.Tensor) };
}

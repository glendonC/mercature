/** Node copy of the browser encoder: same tokenizer, same ONNX Runtime wasm build, same model files. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Tokenizer } from '@huggingface/tokenizers';
import * as ort from 'onnxruntime-web/wasm';
import { createEmbedder } from '../../src/language/embedding.ts';
import { ENCODER, RUNTIME_WASM } from '../../src/language/model.ts';

export const MODEL_DIR = resolve(process.env.MERCATURE_MODEL_DIR ?? '.local/language/model');
const RUNTIME_PATH = resolve('node_modules/onnxruntime-web/dist', RUNTIME_WASM.path);

async function verified(path, file) {
  const data = await readFile(path).catch(() => {
    throw new Error(`Missing ${path}. Run: node scripts/language/provision.mjs`);
  });
  const digest = createHash('sha256').update(data).digest('hex');
  if (data.length !== file.bytes || digest !== file.sha256) throw new Error(`${path} does not match the pinned file.`);
  return data;
}

/**
 * Other published ONNX files of the same pinned export, for the size study only. Sizes and
 * SHA-256 come from the Hub's file listing at that revision; 4-bit and fp16 files are larger.
 */
export const VARIANTS = {
  int8: { path: 'onnx/model_int8.onnx', bytes: 118054593, sha256: '4d24e2bc01a447951524466ef533e52944bf48509e6552810bcee1a2711cb02c' },
  uint8: { path: 'onnx/model_uint8.onnx', bytes: 118054630, sha256: 'ee13574a23e4384619a172d4c0c8c6b825528fde30258c56130d5e3efcc9c8f1' },
};

export async function loadEncoder(variant) {
  const started = performance.now();
  const manifest = ENCODER.files.map(file => (variant && file.path.startsWith('onnx/') ? VARIANTS[variant] : file));
  const isModel = file => file.path.startsWith('onnx/');
  const pathOf = file => (variant && isModel(file) ? resolve('.local/language/variants', file.path.slice('onnx/'.length)) : resolve(MODEL_DIR, file.path));
  const files = Object.fromEntries(await Promise.all(manifest.map(async file => [isModel(file) ? 'model' : file.path, await verified(pathOf(file), file)])));
  ort.env.wasm.wasmBinary = await verified(RUNTIME_PATH, RUNTIME_WASM);
  ort.env.wasm.numThreads = 1;
  const read = performance.now();
  const session = await ort.InferenceSession.create(files.model, { executionProviders: ['wasm'] });
  const tokenizer = new Tokenizer(JSON.parse(files['tokenizer.json']), JSON.parse(files['tokenizer_config.json']));
  return {
    embed: createEmbedder(tokenizer, session, ort.Tensor),
    timing: { readAndVerifyMs: read - started, sessionMs: performance.now() - read },
    bytes: manifest.reduce((sum, file) => sum + file.bytes, 0) + RUNTIME_WASM.bytes,
  };
}

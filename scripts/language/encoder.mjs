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

export async function loadEncoder() {
  const started = performance.now();
  const files = Object.fromEntries(await Promise.all(ENCODER.files.map(async file => [file.path, await verified(resolve(MODEL_DIR, file.path), file)])));
  ort.env.wasm.wasmBinary = await verified(RUNTIME_PATH, RUNTIME_WASM);
  ort.env.wasm.numThreads = 1;
  const read = performance.now();
  const session = await ort.InferenceSession.create(files['onnx/model_quantized.onnx'], { executionProviders: ['wasm'] });
  const tokenizer = new Tokenizer(JSON.parse(files['tokenizer.json']), JSON.parse(files['tokenizer_config.json']));
  return {
    embed: createEmbedder(tokenizer, session, ort.Tensor),
    timing: { readAndVerifyMs: read - started, sessionMs: performance.now() - read },
    bytes: ENCODER.files.reduce((sum, file) => sum + file.bytes, 0) + RUNTIME_WASM.bytes,
  };
}

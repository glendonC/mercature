/**
 * Check that the trimmed encoder gives the same embeddings as the pinned one for every text the
 * evaluation uses: all messages, label passages and feature passages.
 *   node scripts/language/verify-trim.mjs [trimmed dir]
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Tokenizer } from '@huggingface/tokenizers';
import * as ort from 'onnxruntime-web/wasm';
import { createEmbedder } from '../../src/language/embedding.ts';
import { TRIMMED_ENCODER } from '../../src/language/model.ts';
import { passageTexts, queryText } from '../../src/language/policy.ts';
import { FARM_FEATURES } from '../../src/site/inventory.ts';
import { CATEGORY_PROTOTYPES, KIND_PROTOTYPES } from './labels.mjs';
import { loadMessages } from './data.mjs';

const trimmedDir = resolve(process.argv[2] ?? resolve('public', TRIMMED_ENCODER.directory));
ort.env.wasm.wasmBinary = await readFile('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm');
ort.env.wasm.numThreads = 1;
async function encoder(dir) {
  const read = name => readFile(resolve(dir, name));
  const session = await ort.InferenceSession.create(await read('onnx/model_quantized.onnx'), { executionProviders: ['wasm'] });
  const tokenizer = new Tokenizer(JSON.parse(await read('tokenizer.json')), JSON.parse(await read('tokenizer_config.json')));
  return { embed: createEmbedder(tokenizer, session, ort.Tensor), tokenizer };
}
const full = await encoder('.local/language/model');
const trimmed = await encoder(trimmedDir);
const kept = JSON.parse(await readFile(resolve('.local/language/kept-ids.json'), 'utf8'));

const { messages } = await loadMessages();
const texts = [
  ...messages.map(message => queryText(message.text)),
  ...Object.values(KIND_PROTOTYPES).flat(), ...Object.values(CATEGORY_PROTOTYPES).flat(),
  ...FARM_FEATURES.flatMap(feature => { const passages = passageTexts(feature); return [passages.full, ...passages.lists]; }),
];
let identical = 0, sameTokens = 0, maxDifference = 0;
const differing = [];
for (const text of texts) {
  const a = full.tokenizer.encode(text).ids, b = trimmed.tokenizer.encode(text).ids;
  const tokensMatch = a.length === b.length && a.every((id, i) => kept[b[i]] === id);
  sameTokens += tokensMatch;
  const [x, y] = [await full.embed(text), await trimmed.embed(text)];
  const difference = Math.max(...x.map((value, i) => Math.abs(value - y[i])));
  maxDifference = Math.max(maxDifference, difference);
  if (difference === 0) identical++; else differing.push(text);
}
console.log(`${texts.length} texts: same tokens ${sameTokens}, identical embeddings ${identical}, largest difference ${maxDifference}`);
for (const text of differing.slice(0, 10)) console.log('  differs:', text);

/**
 * Derive a smaller encoder that keeps only vocabulary tokens written entirely in Latin or Korean
 * script, digits, punctuation and symbols. Text in those scripts tokenizes to the same pieces, so
 * its embeddings are unchanged; other scripts become unknown tokens.
 *   node scripts/language/trim.mjs [source dir] [target dir]
 * Writes the new tokenizer files and slices the ONNX embedding table with scripts/language/trim_onnx.py
 * (run through uv with onnx and numpy). The default target is where the app serves it from.
 */
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TRIMMED_ENCODER } from '../../src/language/model.ts';

const source = resolve(process.argv[2] ?? '.local/language/model');
const target = resolve(process.argv[3] ?? resolve('public', TRIMMED_ENCODER.directory));
const keptPath = resolve('.local/language/kept-ids.json');
const tokenizer = JSON.parse(await readFile(resolve(source, 'tokenizer.json'), 'utf8'));
if (tokenizer.model.type !== 'Unigram' || tokenizer.model.byte_fallback) throw new Error('Expected a Unigram tokenizer without byte fallback.');

const originalSize = tokenizer.model.vocab.length;
const special = new Set(tokenizer.added_tokens.filter(token => token.content !== '<mask>').map(token => token.id));
const allowed = /^[\p{Script=Latin}\p{Script=Hangul}\p{Script=Common}\p{Script=Inherited}]*$/u;
const kept = tokenizer.model.vocab.flatMap(([piece], id) => (special.has(id) || allowed.test(piece) ? [id] : []));
const newId = new Map(kept.map((id, i) => [id, i]));
for (const id of special) if (newId.get(id) !== id) throw new Error('Special tokens must keep their ids.');

tokenizer.model.vocab = kept.map(id => tokenizer.model.vocab[id]);
tokenizer.model.unk_id = newId.get(tokenizer.model.unk_id);
tokenizer.added_tokens = tokenizer.added_tokens.filter(token => newId.has(token.id)).map(token => ({ ...token, id: newId.get(token.id) }));
for (const value of Object.values(tokenizer.post_processor?.special_tokens ?? {})) value.ids = value.ids.map(id => newId.get(id));

await mkdir(resolve(target, 'onnx'), { recursive: true });
await writeFile(resolve(target, 'tokenizer.json'), JSON.stringify(tokenizer));
await mkdir(resolve('.local/language'), { recursive: true });
await writeFile(keptPath, JSON.stringify(kept));
await copyFile(resolve(source, 'tokenizer_config.json'), resolve(target, 'tokenizer_config.json'));
console.log(`Kept ${kept.length} of ${originalSize} tokens`);
execFileSync('uv', ['run', '--quiet', '--python', '3.12', '--with', 'onnx==1.23.1', '--with', 'numpy==2.5.3', 'python', resolve('scripts/language/trim_onnx.py'),
  resolve(source, 'onnx/model_quantized.onnx'), keptPath, resolve(target, 'onnx/model_quantized.onnx')], { stdio: 'inherit' });
await rm(resolve(target, 'kept-ids.json'), { force: true });

/** Download only the pinned, hash-checked experimental export; never called by the app. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const revision = '761b726dd34fb83930e26aab4e9ac3899aa1fa78';
const target = resolve(process.argv[2] ?? '.local/language/model');
const files = [
  ['config.json', 658, 'cb99455288675345e1a4f411438d5d0adbba5fbd3a67ea4fb03c015433b996c1'],
  ['tokenizer_config.json', 443, 'a1d6bc8734a6f635dc158508bef000f8e2e5a759c7d92f984b2c86e5ff53425b'],
  ['special_tokens_map.json', 167, 'd05497f1da52c5e09554c0cd874037a083e1dc1b9cfd48034d1c717f1afc07a7'],
  ['tokenizer.json', 17082730, '0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39'],
  ['onnx/model_quantized.onnx', 118308185, 'f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193'],
];
const hash = data => createHash('sha256').update(data).digest('hex');
for (const [name, size, expected] of files) {
  const path = resolve(target, name);
  const existing = await readFile(path).catch(() => null);
  if (existing?.length === size && hash(existing) === expected) continue;
  await mkdir(dirname(path), { recursive: true });
  const response = await fetch(`https://huggingface.co/Xenova/multilingual-e5-small/resolve/${revision}/${name}`);
  if (!response.ok) throw new Error(`Provisioning failed for ${name}: ${response.status}`);
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > size) throw new Error(`Oversize file: ${name}`);
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks);
  if (data.length !== size || hash(data) !== expected) throw new Error(`Integrity failure: ${name}`);
  await writeFile(`${path}.partial`, data);
  await rename(`${path}.partial`, path);
  console.log(`${name}: ${size} bytes verified`);
}
await rm(resolve(target, 'provisioning.partial'), { force: true });
console.log(`Provisioned ${files.reduce((sum, [, size]) => sum + size, 0)} verified bytes`);

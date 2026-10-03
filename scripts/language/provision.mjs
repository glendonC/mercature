/** Download the pinned, hash-checked encoder files for the Node scripts and the browser tests. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ENCODER, encoderFileUrl } from '../../src/language/model.ts';

const target = resolve(process.argv[2] ?? '.local/language/model');
const hash = data => createHash('sha256').update(data).digest('hex');
for (const { path: name, bytes: size, sha256: expected } of ENCODER.files) {
  const path = resolve(target, name);
  const existing = await readFile(path).catch(() => null);
  if (existing?.length === size && hash(existing) === expected) continue;
  await mkdir(dirname(path), { recursive: true });
  const response = await fetch(encoderFileUrl(name));
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
console.log(`Provisioned ${ENCODER.files.reduce((sum, file) => sum + file.bytes, 0)} verified bytes in ${target}`);

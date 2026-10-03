/**
 * Fail unless public/models holds exactly the trimmed encoder the app pins, so the deployed app
 * serves it instead of falling back to the Hub, and unless it embeds every evaluation text exactly
 * as the pinned Hub files do.
 *   node scripts/release/check-model.mjs
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TRIMMED_ENCODER } from '../../src/language/model.ts';

const directory = resolve('public', TRIMMED_ENCODER.directory);
for (const file of TRIMMED_ENCODER.files) {
  const data = await readFile(resolve(directory, file.path));
  const sha256 = createHash('sha256').update(data).digest('hex');
  if (data.length !== file.bytes || sha256 !== file.sha256) {
    throw new Error(`${file.path} is ${data.length} bytes with SHA-256 ${sha256}; the app pins ${file.bytes} bytes with ${file.sha256} and would download from the Hub instead.`);
  }
  console.log(`${file.path}: ${file.bytes} bytes, pinned SHA-256`);
}
const report = execFileSync(process.execPath, ['scripts/language/verify-trim.mjs', directory], { encoding: 'utf8' });
process.stdout.write(report);
const [, texts, tokens, identical] = report.match(/^(\d+) texts: same tokens (\d+), identical embeddings (\d+)/m) ?? [];
if (!texts || tokens !== texts || identical !== texts) throw new Error('The trimmed encoder does not reproduce the pinned embeddings.');

/**
 * Assign train, dev and held-out splits by message family, so translations and paraphrases of one
 * message never cross splits. Families with a Quechua version are held out, so Quechua is never
 * used for training or thresholds. The rest are split by case type with a fixed hash order.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('./messages.json', import.meta.url);
const data = JSON.parse(await readFile(path, 'utf8'));
const families = new Map();
for (const message of data.messages) {
  const family = families.get(message.family) ?? { id: message.family, case: message.case, langs: new Set() };
  family.langs.add(message.lang);
  families.set(message.family, family);
}
const order = id => createHash('sha256').update(`mercature-split-v1:${id}`).digest('hex');
const split = new Map();
const byCase = new Map();
for (const family of families.values()) {
  if (family.langs.has('qu')) split.set(family.id, 'test');
  else byCase.set(family.case, [...(byCase.get(family.case) ?? []), family.id]);
}
for (const ids of byCase.values()) {
  ids.sort((a, b) => order(a).localeCompare(order(b)));
  const devCount = ids.length >= 2 ? Math.max(1, Math.round(ids.length * 0.3)) : 0;
  ids.forEach((id, i) => split.set(id, i < devCount ? 'dev' : 'train'));
}
data.messages = data.messages.map(({ split: _, ...message }) => {
  const { id, family, ...rest } = message;
  return { id, family, split: split.get(family), ...rest };
});
const { messages, ...header } = data;
const head = JSON.stringify(header, null, 2).slice(0, -2);
await writeFile(path, `${head},\n  "messages": [\n${messages.map(message => `    ${JSON.stringify(message)}`).join(',\n')}\n  ]\n}\n`);
const count = name => data.messages.filter(message => message.split === name).length;
console.log(`train ${count('train')}, dev ${count('dev')}, test ${count('test')} messages`);

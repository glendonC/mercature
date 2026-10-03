/** Shared loading, fresh embedding and label rules for the language scripts. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { FARM_FEATURES } from '../../src/site/inventory.ts';
import { buildIndex, queryText } from '../../src/language/policy.ts';
import { loadEncoder } from './encoder.mjs';

export const MESSAGES_PATH = new URL('./messages.json', import.meta.url);
/** Extra families written only for training; they never enter dev or held-out evaluation. */
export const EXTRA_PATH = new URL('./messages-train-extra.json', import.meta.url);
export const HEADS_PATH = new URL('../../src/language/heads.json', import.meta.url);
export { FARM_FEATURES };

export async function loadMessages() {
  const texts = [await readFile(MESSAGES_PATH, 'utf8')];
  const extra = await readFile(EXTRA_PATH, 'utf8').catch(() => null);
  if (extra) texts.push(extra);
  const parsed = texts.map(text => JSON.parse(text));
  if (parsed[1]?.messages.some(message => message.split !== 'train')) throw new Error('Extra messages must all be training messages.');
  return {
    files: ['scripts/language/messages.json', ...(extra ? ['scripts/language/messages-train-extra.json'] : [])],
    messages: parsed.flatMap(file => file.messages),
    sha256: createHash('sha256').update(texts.join('\n')).digest('hex'),
  };
}

/** Vague messages have no trustworthy place label; every other message names its places or none. */
export const hasPlaceLabel = message => message.case !== 'vague';
export const concernsPlace = message => message.places.length > 0;
export const categoryLabels = message => message.categories ?? (message.category ? [message.category] : []);

let encoder;
export async function encoderInfo() {
  encoder ??= await loadEncoder();
  return encoder;
}

/** Every call runs the model; nothing is cached between runs. */
export async function embedAll(texts) {
  const { embed } = await encoderInfo();
  const vectors = [];
  for (const text of texts) vectors.push(await embed(text));
  return vectors;
}

export const embedMessages = messages => embedAll(messages.map(message => queryText(message.text)));
export const embedIndex = async (features = FARM_FEATURES) => buildIndex(features, (await encoderInfo()).embed);

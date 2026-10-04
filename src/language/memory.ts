import type { Decision, Scores } from './policy';

/**
 * Memory of the operator's own confirmations, shared by the app and the evaluation scripts.
 * A message the operator linked to a spot is kept as its embedding and a sketch of its spelling,
 * never as text. A new message that is close to one of them, and closer to it than to any message
 * linked to another spot, moves that spot to first place. Every message still runs through the
 * model; only the spot order changes.
 *
 * English, Spanish and Korean messages are compared by embedding. Other languages are compared by
 * spelling, because the encoder does not separate their topics: on the training and dev messages,
 * the closest Quechua embedding named the right spot for 17 of 83 Quechua messages, the closest
 * Quechua spelling for 50.
 */

/** Character trigrams of a message's words, hashed into buckets: [bucket, count], by bucket. */
export type Sketch = readonly (readonly [number, number])[];

/** A message the operator linked to a spot. */
export type Example = { readonly spot: string; readonly vector: ArrayLike<number>; readonly grams: Sketch };

/** A new message, as the memory compares it. */
export type Query = { readonly vector: ArrayLike<number>; readonly grams: Sketch };

/** The spot a new message recalls, with the similarity of its closest kept example. */
export type Recalled = { readonly spot: string; readonly similarity: number };

export type Limits = {
  /** Minimum similarity between the new message and a kept example. */
  readonly similarity: number;
  /** Minimum lead of that similarity over the closest example kept for any other spot. */
  readonly lead: number;
};

/**
 * Chosen on the farm's training and dev messages only (scripts/language/memory.mjs calibrate),
 * before any held-out or route message was scored with a memory.
 */
export const MEMORY = Object.freeze({
  /** Messages that look like English, Spanish or Korean: cosine of embeddings. */
  supported: Object.freeze<Limits>({ similarity: 0.935, lead: 0.005 }),
  /** Other messages: cosine of spelling sketches. */
  unsupported: Object.freeze<Limits>({ similarity: 0.5, lead: 0 }),
});

const BUCKETS = 1 << 16;

/** FNV-1a over UTF-16 code units; the same in every browser and in Node. */
function bucketOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0) % BUCKETS;
}

/** Letters only, lowercased, words padded with spaces; apostrophes stay (Quechua k', q'). */
export function sketch(message: string): Sketch {
  const words = message.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{M}']+/gu, ' ').trim();
  const chars = Array.from(` ${words} `);
  const counts = new Map<number, number>();
  for (let i = 0; i + 3 <= chars.length; i++) {
    const bucket = bucketOf(chars.slice(i, i + 3).join(''));
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => a[0] - b[0]);
}

const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
};

/** Cosine of two sketches' counts. */
export function overlap(a: Sketch, b: Sketch): number {
  let shared = 0, i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i][0] === b[j][0]) shared += a[i++][1] * b[j++][1];
    else if (a[i][0] < b[j][0]) i++;
    else j++;
  }
  const size = (list: Sketch) => Math.sqrt(list.reduce((sum, [, count]) => sum + count * count, 0));
  return shared ? shared / (size(a) * size(b)) : 0;
}

/**
 * The spot whose kept examples are closest to the message, if one is close enough and clearly
 * closer than every other spot's. Examples for spots the place no longer has are ignored.
 */
export function recall(query: Query, examples: readonly Example[], spots: ReadonlySet<string>, supported: boolean, limits: Limits = supported ? MEMORY.supported : MEMORY.unsupported): Recalled | null {
  const best = new Map<string, number>();
  for (const example of examples) {
    if (!spots.has(example.spot)) continue;
    const similarity = supported ? dot(query.vector, example.vector) : overlap(query.grams, example.grams);
    if (similarity > (best.get(example.spot) ?? -Infinity)) best.set(example.spot, similarity);
  }
  const [first, second] = [...best].sort((a, b) => b[1] - a[1]);
  if (!first || first[1] < limits.similarity) return null;
  if (second && first[1] - second[1] < limits.lead) return null;
  return { spot: first[0], similarity: first[1] };
}

/**
 * Applies a recalled spot to the model's decision. It changes nothing when the decision offers no
 * spots or already puts the same spot first. Otherwise the spot moves to first place and a person
 * decides (unsure, 'remembered'), with the model's kind and issue type kept. A message in a language
 * the model was not evaluated on is always 'remembered' when its suggestion rests on the memory.
 */
export function remembered(decision: Decision, scores: Pick<Scores, 'ranked'>, recalled: Recalled | null, supported: boolean): Decision {
  if (!recalled || !decision.candidates.length) return decision;
  const candidates = [recalled.spot, ...scores.ranked.map(item => item.id).filter(id => id !== recalled.spot)].slice(0, 3);
  if (supported && candidates[0] === decision.candidates[0]) return decision;
  return { ...decision, status: 'unsure', candidates, reason: 'remembered' };
}

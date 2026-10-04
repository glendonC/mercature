import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { MEMORY, overlap, recall, remembered, sketch, type Example } from '../../src/language/memory';
import { buildIndex, decide, looksSupported, prepareHeads, queryText, score, type Decision, type Heads } from '../../src/language/policy';
import { forgetPlace, remember, rememberedCount } from '../../src/language/understand';
import { FARM_FEATURES } from '../../src/site/inventory';

const farm = { id: 'noor-farm', features: FARM_FEATURES };
const spots = new Set(FARM_FEATURES.map(feature => feature.id));
/** A unit vector whose cosine with the query below is exactly the given value. */
const at = (similarity: number) => [similarity, Math.sqrt(1 - similarity ** 2), ...new Array(382).fill(0)];
const query = { vector: at(1), grams: sketch('Bañopi mana papel karqanchu') };
const ranked = [{ id: 'wheelbarrow', score: 0.84 }, { id: 'bench', score: 0.83 }, { id: 'restroom', score: 0.82 }, { id: 'viewpoint', score: 0.81 }];
const ready: Decision = { status: 'ready', kind: 'problem', category: 'path-blocked', candidates: ['wheelbarrow', 'bench', 'restroom'] };

test('English, Spanish and Korean recall a spot only for a close embedding that leads every other spot', () => {
  const { similarity, lead } = MEMORY.supported;
  const close = similarity + 0.01;
  const example = (spot: string, cosine: number): Example => ({ spot, vector: at(cosine), grams: [] });
  expect(recall(query, [], spots, true)).toBeNull();
  expect(recall(query, [example('bench', similarity - 0.01)], spots, true)).toBeNull();
  expect(recall(query, [example('bench', close)], spots, true)).toEqual({ spot: 'bench', similarity: expect.closeTo(close, 9) });
  expect(recall(query, [example('bench', close), example('restroom', close - lead / 2)], spots, true)).toBeNull();
  expect(recall(query, [example('bench', close), example('restroom', close - lead - 0.01)], spots, true)?.spot).toBe('bench');
  expect(recall(query, [example('not-on-this-farm', 1)], spots, true)).toBeNull();
});

test('other languages recall by spelling, never by embedding', () => {
  expect(overlap(sketch('Bañopi mana papel karqanchu'), sketch('BAÑOPI  mana papel karqanchu!'))).toBeCloseTo(1, 9);
  expect(overlap(sketch('Bañopi mana papel karqanchu'), sketch('Carretillaqa ñanta harkasharqan'))).toBeLessThan(MEMORY.unsupported.similarity);
  const sameSpelling: Example = { spot: 'restroom', vector: at(0), grams: sketch('Bañopi mana papel karqanchu, mana jabónpas') };
  const sameEmbedding: Example = { spot: 'wheelbarrow', vector: at(1), grams: sketch('Carretillaqa ñanta harkasharqan') };
  expect(recall(query, [sameSpelling, sameEmbedding], spots, false)?.spot).toBe('restroom');
  expect(recall(query, [sameEmbedding], spots, false)).toBeNull();
});

test('the memory only reorders spots, and a person decides whenever it chose the first one', () => {
  const recalled = { spot: 'viewpoint', similarity: 0.95 };
  expect(remembered(ready, { ranked }, null, true)).toBe(ready);
  const noPlace: Decision = { status: 'unsure', kind: 'problem', category: null, candidates: [], reason: 'no-place' };
  expect(remembered(noPlace, { ranked }, recalled, true)).toBe(noPlace);
  expect(remembered(ready, { ranked }, { spot: 'wheelbarrow', similarity: 0.95 }, true)).toBe(ready);
  expect(remembered(ready, { ranked }, recalled, true)).toEqual({ ...ready, status: 'unsure', reason: 'remembered', candidates: ['viewpoint', 'wheelbarrow', 'bench'] });
  const unclear: Decision = { status: 'unsure', kind: null, category: null, candidates: ['wheelbarrow', 'bench', 'restroom'], reason: 'unclear-kind' };
  expect(remembered(unclear, { ranked }, { spot: 'wheelbarrow', similarity: 0.95 }, false)).toEqual({ ...unclear, reason: 'remembered' });
});

test('without a stored model nothing is remembered and nothing is downloaded', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('offline'); };
  try {
    expect(await remember('The wheelbarrow blocked the path.', farm, 'wheelbarrow')).toBe(false);
    expect(await remember('The wheelbarrow blocked the path.', farm, 'stretch-4')).toBe(false);
    expect(await rememberedCount(farm.id)).toBe(0);
    await forgetPlace(farm.id);
    expect(calls).toBe(0);
  } finally { globalThis.fetch = originalFetch; }
});

test('a Quechua message linked before brings its spot back first, as a suggestion only', async () => {
  test.skip(!existsSync('.local/language/model/onnx/model_quantized.onnx'), 'Model files are not provisioned; run node scripts/language/provision.mjs');
  // @ts-expect-error The Node encoder is a plain script module shared with the evaluation.
  const { loadEncoder } = await import('../../scripts/language/encoder.mjs');
  const encoder = await loadEncoder();
  const heads = JSON.parse(readFileSync(new URL('../../src/language/heads.json', import.meta.url), 'utf8')) as Heads;
  const prepared = await prepareHeads(heads, encoder.embed);
  const index = await buildIndex(FARM_FEATURES, encoder.embed);
  const text = 'Bañopi mana jabón karqanchu, makinchikta mana mayllakuyta atirqaykuchu.';
  const message = { vector: await encoder.embed(queryText(text)), grams: sketch(text) };
  const scores = score(message.vector, index, prepared);
  const own = decide(scores, prepared, looksSupported(text));
  expect(own).toMatchObject({ status: 'unsure', reason: 'unclear-kind', kind: null });
  expect(remembered(own, scores, recall(message, [], spots, false), false)).toBe(own);
  const answer = remembered(own, scores, recall(message, [{ spot: 'restroom', ...message }], spots, false), false);
  expect(answer).toMatchObject({ status: 'unsure', reason: 'remembered', kind: null, category: null });
  expect(answer.candidates[0]).toBe('restroom');
});

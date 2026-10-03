import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { FARM_FEATURES } from '../../src/site/inventory';
import { LANGUAGE_LIMITS } from '../../src/language';
import { modelState, prepareModel, prepareSite, understand } from '../../src/language/understand';
import { buildIndex, decide, prepareHeads, queryText, score, type Heads } from '../../src/language/policy';

const farm = { id: 'noor-farm', features: FARM_FEATURES };
const modelProvisioned = existsSync('.local/language/model/onnx/model_quantized.onnx');
const heads = JSON.parse(readFileSync(new URL('../../src/language/heads.json', import.meta.url), 'utf8')) as Heads;

test('invalid messages are refused before any model work', async () => {
  for (const text of ['', ' \n ', 'x'.repeat(LANGUAGE_LIMITS.messageCodePoints + 1)]) {
    expect(await understand(text, farm)).toEqual({ status: 'invalid', kind: null, category: null, candidates: [], reason: 'invalid-input' });
  }
  expect((await understand('The gate was stuck.', { ...farm, features: [] })).status).toBe('invalid');
});

test('without a stored model the manual workflow continues and nothing is downloaded', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('offline'); };
  try {
    expect(modelState().status).not.toBe('ready');
    expect(await understand('The wheelbarrow blocked the path.', farm)).toEqual({ status: 'unavailable', kind: null, category: null, candidates: [], reason: 'model-missing' });
    expect(calls).toBe(0);
  } finally { globalThis.fetch = originalFetch; }
});

test('preparing a site without a loaded model does nothing and reports unavailable', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('offline'); };
  try {
    const ticks: number[] = [];
    expect(await prepareSite(farm, done => ticks.push(done))).toBe('unavailable');
    expect(ticks).toEqual([]);
    expect(calls).toBe(0);
    expect(modelState().status).not.toBe('ready');
  } finally { globalThis.fetch = originalFetch; }
});

test('a failed preparation reports a failed state instead of throwing', async () => {
  const states: string[] = [];
  const state = await prepareModel(next => states.push(next.status));
  expect(state.status).toBe('failed');
  expect(states.at(-1)).toBe('failed');
});

test('the shipped heads answer the farm from fixed lists and abstain on unclear messages', async () => {
  test.skip(!modelProvisioned, 'Model files are not provisioned; run node scripts/language/provision.mjs');
  // @ts-expect-error The Node encoder is a plain script module shared with the evaluation.
  const { loadEncoder } = await import('../../scripts/language/encoder.mjs');
  const encoder = await loadEncoder();
  const index = await buildIndex(FARM_FEATURES, encoder.embed);
  const prepared = await prepareHeads(heads, encoder.embed);
  const answer = async (text: string) => decide(score(await encoder.embed(queryText(text)), index, prepared), prepared);

  const blocked = await answer('Someone left the wheelbarrow right in the walkway next to the drying beds and we could not pass.');
  expect([null, 'problem']).toContain(blocked.kind);
  expect(blocked.candidates[0]).toBe('wheelbarrow');
  expect((await answer('화장실에 휴지도 비누도 없었어요.')).candidates[0]).toBe('restroom');
  expect(await answer('¿Cuánto cuesta el tour para cuatro personas?')).toMatchObject({ status: 'unsure', reason: 'no-place', candidates: [] });
  expect((await answer('The passage to the tasting table was not blocked at all, we walked right through.')).kind).not.toBe('problem');
});

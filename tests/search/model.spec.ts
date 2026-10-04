import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { buildIndex, decide, prepareHeads, queryText, score, type Heads } from '../../src/language/policy';
import type { RoutePlace } from '../../src/site/route';

/** The same Node encoder the language evaluation uses, so these are real model answers. */
const modelProvisioned = existsSync('.local/language/model/onnx/model_quantized.onnx');
const heads = JSON.parse(readFileSync(new URL('../../src/language/heads.json', import.meta.url), 'utf8')) as Heads;
/** The spots the device built for a real walk, Plaza San Martín to the Museo de Arte de Lima, from OpenStreetMap on 2026-10-04. */
const lima = JSON.parse(readFileSync(new URL('./lima-spots.json', import.meta.url), 'utf8')) as RoutePlace;

test('the model answers messages about a walk built on the device, with no retraining', async () => {
  test.setTimeout(120000);
  test.skip(!modelProvisioned, 'Model files are not provisioned; run node scripts/language/provision.mjs');
  // @ts-expect-error The Node encoder is a plain script module shared with the evaluation.
  const { loadEncoder } = await import('../../scripts/language/encoder.mjs');
  const encoder = await loadEncoder();
  const prepared = await prepareHeads(heads, encoder.embed);
  const index = await buildIndex(lima.features, encoder.embed);
  const read = async (text: string) => decide(score(await encoder.embed(queryText(text)), index, prepared), prepared);

  const steps = lima.features.find(s => s.id.startsWith('steps-'))!.id, gate = lima.features.find(s => s.id.startsWith('gate-'))!.id;
  const first = async (text: string) => (await read(text)).candidates[0];
  const top = async (text: string) => (await read(text)).candidates;
  expect(await first('There were steps right after we left Plaza San Martín, hard with the stroller.')).toBe(steps);
  expect(await first('Había escalones al salir de la Plaza San Martín.')).toBe(steps);
  expect(await top('The gate on the way to the museum was locked.')).toContain(gate);
  expect(await top('Jirón de la Unión was so crowded we could not pass with the wheelchair.')).toContain('jiron-de-la-union');
  expect((await read('Thank you, the walk to the museum was lovely.')).kind).toBe('praise');
});

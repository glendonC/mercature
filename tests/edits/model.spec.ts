import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { QORIKANCHA_PLACE } from '../../src/site/route';
import { buildIndex, decide, prepareHeads, queryText, score, type Heads } from '../../src/language/policy';
import { addSpot, ownNote, NO_NOTE } from '../../src/edits/store';
import { withEdits, type Locate } from '../../src/edits/place';

/** The same Node encoder the language evaluation uses, so these are real model answers. */
const modelProvisioned = existsSync('.local/language/model/onnx/model_quantized.onnx');
const heads = JSON.parse(readFileSync(new URL('../../src/language/heads.json', import.meta.url), 'utf8')) as Heads;
const at = '2026-10-04T12:00:00.000Z';
/** Metres and landmarks as the real record has them: 10 m stretches along the walk. */
const WHERE: Record<number, string> = { 25: 'Monasterio de Santa Catalina', 34: 'Loreto', 45: 'Calle Pampa del Castillo' };
const locate: Locate = stretch => ({ from: stretch * 10, to: stretch * 10 + 10, landmark: WHERE[stretch] ?? '' });

test('the model ranks a spot she added, without taking messages from the authored ones', async () => {
  test.setTimeout(120000);
  test.skip(!modelProvisioned, 'Model files are not provisioned; run node scripts/language/provision.mjs');
  // @ts-expect-error The Node encoder is a plain script module shared with the evaluation.
  const { loadEncoder } = await import('../../scripts/language/encoder.mjs');
  const encoder = await loadEncoder();
  const prepared = await prepareHeads(heads, encoder.embed);
  const rank = async (place: { features: readonly { id: string }[] }, text: string) => {
    const index = await buildIndex(place.features as never, encoder.embed);
    return decide(score(await encoder.embed(queryText(text)), index, prepared), prepared);
  };

  const added = addSpot(addSpot({ schema: 'mercature-route-edits/1', place: 'cusco-qorikancha', added: [], fixed: {}, notes: {}, answers: {}, seq: 0 },
    25, 'narrow', ownNote('El paso junto al monasterio es muy angosto', 'es'), at), 45, 'kerb', NO_NOTE, at);
  const place = withEdits(QORIKANCHA_PLACE, added, locate);
  expect(place.features.map(feature => feature.id)).toContain('added-1');

  // Her own spots answer messages about them, in the three visitor languages.
  expect((await rank(place, 'El paso junto al monasterio de Santa Catalina es muy angosto, no cabe la silla de ruedas.')).candidates[0]).toBe('added-1');
  expect((await rank(place, 'The way past the Santa Catalina monastery is too narrow for a wheelchair.')).candidates[0]).toBe('added-1');
  expect((await rank(place, '산타 카탈리나 수도원 옆 길이 너무 좁아서 지나갈 수 없었어요.')).candidates[0]).toBe('added-1');
  expect((await rank(place, '수도원 옆 길이 너무 좁아요.')).candidates[0]).toBe('added-1');
  expect((await rank(place, 'Hay un bordillo alto en la calle Pampa del Castillo y no hay rampa.')).candidates[0]).toBe('added-2');

  // The authored spots keep their own messages, and a message about no place still names none.
  const authored = await rank(place, 'Las gradas de piedra de la calle Loreto son imposibles con silla de ruedas.');
  expect(['steps-340-350', 'steps-130-140']).toContain(authored.candidates[0]);
  expect(authored.candidates).not.toContain('added-1');
  expect(await rank(place, '¿Cuánto cuesta la entrada para cuatro personas?')).toMatchObject({ reason: 'no-place', candidates: [] });
});

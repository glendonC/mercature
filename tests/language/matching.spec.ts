import { test, expect } from '@playwright/test';
import { aliasBaseline, LANGUAGE_LIMITS, normalizeLanguageText, suggestFeatures, validateConfirmedFeatures, validateInventory, type FeatureRecord } from '../../src/language';

const inventory: readonly FeatureRecord[] = Object.freeze([
  Object.freeze({ id: 'bench', label: 'Courtyard bench', description: 'An authored bench beside the courtyard passage.', aliases: Object.freeze(['bench', '벤치']) }),
  Object.freeze({ id: 'north-sign', label: 'North entrance sign', aliases: Object.freeze(['north sign', '북문 안내판']) }),
]);

test('unadopted local inference keeps Korean and English concerns in manual review without network access', async () => {
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls++; throw new Error('offline'); };
  try {
    for (const text of ['The bench blocks the entrance.', '벤치 때문에 지나갈 수 없어요.']) {
      const result = await suggestFeatures(text, inventory);
      expect(result).toMatchObject({ status: 'unavailable', method: 'manual', suggestions: [] });
      expect(result.reason).toContain('manually');
    }
    expect(networkCalls).toBe(0);
  } finally { globalThis.fetch = originalFetch; }
});

test('invalid and oversized messages cannot be silently truncated into different concerns', async () => {
  for (const text of ['', ' \n ', '\u0000bench', '가'.repeat(LANGUAGE_LIMITS.messageCodePoints + 1)]) {
    expect((await suggestFeatures(text, inventory)).status).toBe('invalid');
  }
  expect((await suggestFeatures('가'.repeat(500), inventory)).status).toBe('unavailable');
  expect((await suggestFeatures('😀'.repeat(500), inventory)).status).toBe('unavailable');
});

test('Unicode comparison normalization preserves original Korean wording and inventory evidence', () => {
  const original = '  벤치\n때문에  지나갈 수 없어요.  ';
  const snapshot = JSON.stringify(inventory);
  expect(normalizeLanguageText(original)).toBe('벤치 때문에 지나갈 수 없어요.');
  expect(aliasBaseline(original, inventory).suggestions).toEqual([{ id: 'bench', score: 1 }]);
  expect(original).toContain('\n');
  expect(JSON.stringify(inventory)).toBe(snapshot);
});

test('alias comparison is explicitly lexical and does not interpret negation, praise or dimensions', () => {
  for (const text of ['The bench does not block me.', 'What a lovely bench.', 'Move the bench by 9 meters.']) {
    const result = aliasBaseline(text, inventory);
    expect(result).toEqual({ status: 'baseline', method: 'exact-alias', suggestions: [{ id: 'bench', score: 1 }] });
    expect(Object.keys(result.suggestions[0]).sort()).toEqual(['id', 'score']);
  }
  expect(aliasBaseline('The benchmark is interesting.', inventory).suggestions).toEqual([]);
  expect(aliasBaseline('An unseen lift is broken.', inventory).suggestions).toEqual([]);
});

test('confirmation accepts correction and rejection using only current known identifiers', () => {
  expect(validateConfirmedFeatures(['north-sign'], inventory)).toEqual({ status: 'valid', ids: ['north-sign'] });
  expect(validateConfirmedFeatures([], inventory)).toEqual({ status: 'valid', ids: [] });
  for (const ids of [['invented'], ['bench', 'invented'], ['bench', 'bench']]) {
    expect(validateConfirmedFeatures(ids, inventory)).toMatchObject({ status: 'invalid', ids: [] });
  }
  const selection = ['bench'];
  const result = validateConfirmedFeatures(selection, inventory);
  selection[0] = 'invented';
  expect(result.ids).toEqual(['bench']);
});

test('corrupt, stale and excessive inventories retain an invalid manual state', async () => {
  const corruptInventories = [
    [], [inventory[0], inventory[0]], [{ id: '../foreign', label: 'Other site' }],
    [{ id: 'bench', label: '' }], [{ id: 'bench', label: 'Bench', aliases: [''] }],
    [{ id: 'bench', label: 'Bench', description: 'x'.repeat(801) }],
    Array.from({ length: 33 }, (_, i) => ({ id: `feature-${i}`, label: 'Object' })),
  ];
  for (const corrupt of corruptInventories) {
    expect(validateInventory(corrupt)).not.toBeNull();
    expect((await suggestFeatures('bench', corrupt)).status).toBe('invalid');
    expect(aliasBaseline('bench', corrupt).status).toBe('invalid');
  }
  expect(validateConfirmedFeatures(['bench'], [inventory[1]]).status).toBe('invalid');
});

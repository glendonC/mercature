import { test, expect } from '@playwright/test';
import { aliasBaseline, LANGUAGE_LIMITS, normalizeLanguageText, type FeatureRecord } from '../../src/language';

const inventory: readonly FeatureRecord[] = Object.freeze([
  Object.freeze({ id: 'bench', label: 'Bench', description: 'A long wooden bench beside the path to the viewpoint.', aliases: Object.freeze(['bench', '벤치']) }),
  Object.freeze({ id: 'north-sign', label: 'North entrance sign', aliases: Object.freeze(['north sign', '북문 안내판']) }),
]);

test('invalid and oversized messages are rejected, never silently truncated', () => {
  for (const text of ['', ' \n ', '\u0000bench', '가'.repeat(LANGUAGE_LIMITS.messageCodePoints + 1)]) {
    expect(aliasBaseline(text, inventory).status).toBe('invalid');
  }
  expect(aliasBaseline('가'.repeat(LANGUAGE_LIMITS.messageCodePoints), inventory).status).toBe('baseline');
});

test('Unicode comparison normalization preserves original Korean wording and inventory evidence', () => {
  const original = '  벤치\n때문에  지나갈 수 없어요.  ';
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

test('corrupt and excessive inventories give an invalid baseline', () => {
  const corruptInventories = [
    [], [inventory[0], inventory[0]], [{ id: '../foreign', label: 'Other site' }],
    [{ id: 'bench', label: '' }], [{ id: 'bench', label: 'Bench', aliases: [''] }],
    [{ id: 'bench', label: 'Bench', description: 'x'.repeat(801) }],
    Array.from({ length: 33 }, (_, i) => ({ id: `feature-${i}`, label: 'Object' })),
  ];
  for (const corrupt of corruptInventories) expect(aliasBaseline('bench', corrupt).status).toBe('invalid');
});

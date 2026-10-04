import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { checkItems, type CheckFinding } from '../../src/osm/check';

const f = (id: string, kind: CheckFinding['kind'], value: string, label: string, stretches: number[], barrier = false): CheckFinding => ({ id, kind, value, label: `OpenStreetMap says: ${label}`, barrier, stretches });

test('the guide checks a built walk kind by kind, what may block it first, and never a slope or a width', () => {
  const items = checkItems([
    f('a', 'bench', '', 'bench', [4]),
    f('b', 'handrail', 'no', 'no handrail', [1, 2]),
    f('c', 'handrail', 'yes', 'handrail', [5]),
    f('d', 'handrail', 'no', 'no handrail', [3]),
    f('e', 'kerb', 'raised', 'raised kerb', [6], true),
    f('g', 'steps', '12', '12 steps', [1, 2], true),
    f('h', 'surface', 'sett', '10% incline', [7]),
    f('i', 'crossing', '', 'pedestrian crossing', []),
  ]);
  expect(items.map(item => [item.kind, item.barrier])).toEqual([['steps', true], ['kerb', true], ['bench', false], ['handrail', false]]);
  const rail = items.find(item => item.kind === 'handrail')!;
  expect(rail).toMatchObject({ label: 'Handrail', stretches: [1, 2, 3, 5], findings: ['b', 'c', 'd'] });
  expect(rail.says).toEqual([{ value: 'no', label: 'OpenStreetMap says: no handrail', stretches: [1, 2, 3] }, { value: 'yes', label: 'OpenStreetMap says: handrail', stretches: [5] }]);
});

test('a published walk gives one check item per kind it records, each on real stretches', () => {
  const place = JSON.parse(readFileSync('public/places/narikala/place.json', 'utf8'));
  const items = checkItems(place.osm.findings);
  expect(items.map(item => item.kind)).toEqual(['steps', 'gate', 'surface', 'bench', 'toilets', 'lit', 'handrail', 'ramp', 'wheelchair']);
  expect(items[0]).toMatchObject({ barrier: true, label: 'Steps' });
  for (const item of items) expect(item.stretches.every(index => index >= 0 && index < place.stretches.length) && item.says.every(line => line.label.startsWith('OpenStreetMap says: '))).toBe(true);
  expect(JSON.stringify(items)).not.toMatch(/width|incline|slope|°/i);
});

import { test, expect } from '@playwright/test';
import { accessFindings, accessKinds, accessQuery, mapContext, type OsmElement } from '../../src/osm/access';

// A straight tour route east along the equator, cut into 10 m stretches; x metres east is x / 111319.49 degrees.
const east = (metres: number, north = 0) => [metres / 111319.49, north / 111319.49] as const;
const stretches = [0, 1, 2, 3].map(index => ({ index, line: [east(index * 10), east(index * 10 + 10)] }));
const way = (id: number, tags: Record<string, string>, ...points: (readonly [number, number])[]): OsmElement => ({ type: 'way', id, tags, geometry: points.map(([lon, lat]) => ({ lat, lon })) });
const node = (id: number, tags: Record<string, string>, [lon, lat]: readonly [number, number]): OsmElement => ({ type: 'node', id, tags, lat, lon });

test('OpenStreetMap findings land on the stretches the walk shares with them, and never state a width or incline', () => {
  const found = accessFindings([
    way(1, { highway: 'steps', step_count: '6', handrail: 'no', ramp: 'no', width: '2', incline: 'up' }, east(16), east(20)), // a short flight that ends where stretch 2 begins
    way(2, { highway: 'residential', surface: 'sett', lit: 'yes' }, east(5, -30), east(5, 30)), // a street the route only crosses
    way(3, { highway: 'footway', surface: 'cobblestone', wheelchair: 'no' }, east(20), east(40)),
    node(4, { barrier: 'gate' }, east(25, 1)),
    node(5, { amenity: 'bench', backrest: 'yes' }, east(33, 12)),
    node(6, { barrier: 'bollard' }, east(15, 8)), // too far from the route
  ], stretches);
  const on = (id: string) => found.find(finding => finding.id === id)?.stretches;
  expect(on('osm-way-1-highway-steps')).toEqual([1]);
  expect(found.filter(finding => finding.osm.id === 1).map(finding => finding.label)).toEqual(['OpenStreetMap says: no handrail', 'OpenStreetMap says: 6 steps', 'OpenStreetMap says: no ramp']);
  expect(found.some(finding => finding.osm.id === 2 || finding.osm.id === 6)).toBe(false);
  expect(on('osm-way-3-surface-cobblestone')).toEqual([2, 3]);
  expect(on('osm-way-3-wheelchair-no')).toEqual([2, 3]);
  expect(on('osm-node-4-barrier-gate')).toEqual([2]);
  expect(on('osm-node-5-amenity-bench')).toEqual([3]);
  expect(found.filter(finding => finding.barrier).map(finding => finding.kind)).toEqual(['steps']);
  expect(JSON.stringify(found)).not.toMatch(/width|incline/);
  expect(found.every(finding => finding.label.startsWith('OpenStreetMap says: ') && finding.source === 'openstreetmap')).toBe(true);
  expect(accessKinds(found).map(kind => kind.kind)).toEqual(['steps', 'handrail', 'ramp', 'surface', 'gate', 'bench', 'wheelchair']);
  expect(accessQuery([east(0), east(40)])).toMatch(/^\[out:json\].*out geom;$/);
  expect(mapContext([way(7, { building: 'yes', name: 'A' }, east(0, 5), east(5, 5), east(5, 9), east(0, 5)), way(3, { highway: 'footway' }, east(20), east(40))]).buildings.features).toHaveLength(1);
});

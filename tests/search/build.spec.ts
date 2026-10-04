import { test, expect } from '@playwright/test';
import { accessFindings, mapContext, type OsmElement } from '../../src/osm/access';
import { buildPlace, cut, toDestination, walkId } from '../../src/search/build';
import { decodePolyline6, distance, type LonLat } from '../../src/search/geo';
import { matchPrepared } from '../../src/search/prepared';
import type { Walked } from '../../src/search/services';

/** A straight walk of 95 m due east, so a point's distance along it is plain arithmetic. */
const origin: LonLat = [-77.03, -12.05];
const M = 6371008.8 * Math.PI / 180;
const east = (metres: number, north = 0): LonLat => [origin[0] + metres / (M * Math.cos(origin[1] * Math.PI / 180)), origin[1] + north / M];
const line = [east(0), east(50), east(95)];
const walked: Walked = { line, lengthMetres: 95, streets: [{ name: 'Jirón Prueba', from: 0, to: 95 }], fetchedAt: '2026-10-04T08:00:00.000Z' };
const geometry = (points: LonLat[]) => points.map(([lon, lat]) => ({ lat, lon }));
const elements: OsmElement[] = [
  { type: 'way', id: 1, tags: { highway: 'residential', name: 'Jirón Prueba' }, geometry: geometry([east(-20), east(120)]) },
  // A short flight on the walk at 42 to 46 m, and one the walk only crosses at 20 m.
  { type: 'way', id: 2, tags: { highway: 'steps', step_count: '4', handrail: 'no' }, geometry: geometry([east(42), east(46)]) },
  { type: 'way', id: 3, tags: { highway: 'steps' }, geometry: geometry([east(20, -6), east(20, 6)]) },
  { type: 'node', id: 4, tags: { kerb: 'raised' }, lat: east(73)[1], lon: east(73)[0] },
  { type: 'node', id: 5, tags: { amenity: 'bench' }, lat: east(15, 4)[1], lon: east(15, 4)[0] },
  { type: 'way', id: 6, tags: { building: 'yes', name: 'Casa de Prueba' }, geometry: geometry([east(55, 8), east(65, 8), east(65, 18), east(55, 18), east(55, 8)]) },
];
const start = { name: 'Plaza de Prueba', position: line[0] }, target = { name: 'Museo de Prueba', position: line[2] };

function build() {
  const stretches = cut(line);
  const findings = accessFindings(elements, stretches.map(s => ({ index: s.index, line: s.line })), { nearMetres: 3 });
  return buildPlace({ start, target, area: 'Lima, Peru', walked, findings, context: mapContext(elements), fetchedAt: walked.fetchedAt, aroundMetres: 15, nearMetres: 3 });
}

test('a walk is cut into 10 m stretches from its start, the last ending where the walk does', () => {
  const stretches = cut(line);
  expect(stretches.map(s => [s.from, s.to])).toEqual([[0, 10], [10, 20], [20, 30], [30, 40], [40, 50], [50, 60], [60, 70], [70, 80], [80, 90], [90, 95]]);
  expect(distance(stretches[4].line[0], east(40))).toBeLessThan(0.05);
  expect(distance(stretches[9].line.at(-1)!, east(95))).toBeLessThan(0.05);
});

test('a map-only walk flags OpenStreetMap barriers on their stretches and says no photos everywhere else', () => {
  const { place } = build();
  expect(place.schema).toBe('mercature-place/1');
  expect(place.photos).toEqual([]);
  expect(place.views).toEqual([]);
  expect(place.stretches.filter(s => s.status === 'barrier').map(s => s.index)).toEqual([4, 7]);
  expect(place.stretches.filter(s => s.status !== 'barrier').every(s => s.status === 'no_photos')).toBe(true);
  // The flight the walk only crosses is not on it.
  expect(place.stretches[2].findings).toEqual([]);
  // Every finding is an unverified tag with no photo, and the bench beside the walk is kept but flags nothing.
  expect(place.findings.every(f => f.view_id === null && f.verified === false && f.osm.tags)).toBe(true);
  expect(place.findings.find(f => f.concept === 'amenity=bench')?.barrier).toBe(false);
  expect(place.attribution.map).toContain('OpenStreetMap');
  expect(place.summary).toMatchObject({ stretches: 10, barriers: 2, seen: 0 });
});

test('spots come from flagged stretches, both ends, the street it follows and the buildings beside it, with no measurements', () => {
  const { place, spots } = build();
  expect(spots.id).toBe(place.id);
  expect(place.id).toBe(walkId(start, target));
  expect(place.id).toMatch(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/);
  const flagged = spots.features.filter(s => s.stretches.length);
  expect(flagged.map(s => [s.stretches, s.name.en])).toEqual([[[4], 'Steps on Jirón Prueba (40 to 50 m)'], [[7], 'Raised kerb near Museo de Prueba (70 to 80 m)']]);
  expect(spots.features.filter(s => !s.stretches.length).map(s => s.landmark)).toEqual(['Plaza de Prueba', 'Museo de Prueba', 'Jirón Prueba', 'Casa de Prueba']);
  expect(new Set(spots.features.map(s => s.id)).size).toBe(spots.features.length);
  for (const spot of spots.features) {
    const words = [spot.name.en, spot.name.es, spot.description].join(' ');
    expect(words).not.toMatch(/\b\d+(\.\d+)?\s?(cm|mm|%|°)|\b(wide|width|high|height|slope|steep|incline)\b/i);
  }
  expect(place.route_spots.map(s => s.id)).toEqual(spots.features.map(s => s.id));
});

test('the route screen reads a built package as a place with no photos', () => {
  const data = toDestination(build().place);
  expect(data.stretches.filter(s => s.status === 'no-photos')).toHaveLength(8);
  expect(data.findings.every(f => f.viewId === null && f.outline.length === 0)).toBe(true);
  expect(data.buildings.map(b => b.name)).toEqual(['Casa de Prueba']);
  expect(data.ways.find(w => w.name === 'Jirón Prueba')?.kind).toBe('residential');
  expect(data.target.name).toBe('Museo de Prueba');
});

test('a Valhalla shape decodes at six decimals', () => {
  expect(decodePolyline6('_izlhA~rlgdF_{geC~ywl@_kwzCn`{nI')).toEqual([[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]);
});

test('typing finds prepared places by name, city or another name, offline', () => {
  const places = [
    { id: 'cusco-qorikancha', name: 'Qorikancha', area: 'Cusco', aliases: 'Plaza de Armas Coricancha Temple of the Sun' },
    { id: 'tbilisi-narikala', name: 'Narikala', area: 'Tbilisi', aliases: 'Narikala fortress cable car ნარიყალა Нарикала' },
  ];
  expect(matchPrepared('cusco', places).map(p => p.id)).toEqual(['cusco-qorikancha']);
  expect(matchPrepared('templo', places)).toEqual([]);
  expect(matchPrepared('temple sun', places).map(p => p.id)).toEqual(['cusco-qorikancha']);
  expect(matchPrepared('narik', places).map(p => p.id)).toEqual(['tbilisi-narikala']);
  expect(matchPrepared('ნარიყალა', places).map(p => p.id)).toEqual(['tbilisi-narikala']);
  expect(matchPrepared('Coricáncha', places).map(p => p.id)).toEqual(['cusco-qorikancha']);
  expect(matchPrepared('lima', places)).toEqual([]);
});

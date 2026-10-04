import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { LonLat } from '../../src/osm/access';
import { cutStretches, findWayAround, readWayAround, wayAroundFrom, type AroundAnswers } from '../../src/routes/around';
import { distance } from '../../src/routes/geo';
import { addStreet, buildStreet, emptyLines, mapPaths, parseLines, removeStreet, setCheck, wayAroundOf } from '../../src/routes/lines';
import { AROUND_LABEL, STREET_LABEL } from '../../src/routes/shape';
import { RouteTrouble, type Ask } from '../../src/routes/valhalla';

// A made-up walk 100 m east near Cusco, with one mapped flight of steps between 40 and 46 m.
const A: LonLat = [-71.98, -13.52];
const metre = 1 / (6371008.8 * Math.PI / 180);
const at = (east: number, north = 0): LonLat => [A[0] + east * metre / Math.cos(A[1] * Math.PI / 180), A[1] + north * metre];
function encode(line: readonly LonLat[]): string {
  let out = '', lat = 0, lon = 0;
  const put = (value: number) => { let v = value < 0 ? ~(value << 1) : value << 1; while (v >= 0x20) { out += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } out += String.fromCharCode(v + 63); };
  for (const [x, y] of line) { const nextLat = Math.round(y * 1e6), nextLon = Math.round(x * 1e6); put(nextLat - lat); put(nextLon - lon); lat = nextLat; lon = nextLon; }
  return out;
}
const walkLine = [at(0), at(100)];
const walk = { line: walkLine, metres: 100, stretches: cutStretches(walkLine) };
const walkTrace = (steps: boolean) => ({ edges: [{ use: 'footway', way_id: 1, begin_shape_index: 0, end_shape_index: 1 }, { use: steps ? 'steps' : 'footway', way_id: 7, names: ['Loreto'], begin_shape_index: 1, end_shape_index: 2 }, { use: 'footway', way_id: 2, begin_shape_index: 2, end_shape_index: 3 }], shape: encode([at(0), at(40), at(46), at(100)]) });
const detour = [at(0), at(20), at(20, 30), at(80, 30), at(80), at(100)];
const route = { trip: { legs: [{ shape: encode(detour), maneuvers: [{ street_names: ['Maruri'] }, { street_names: ['Maruri'] }, { street_names: ['Romeritos'] }, {}] }] } };
const routeTrace = (steps: boolean) => ({ edges: [{ use: 'footway', way_id: 3, begin_shape_index: 0, end_shape_index: 2 }, { use: steps ? 'steps' : 'road', way_id: 4, begin_shape_index: 2, end_shape_index: 5 }], shape: encode(detour) });
// A bench beside the way, and a flight of steps a metre beside it that the way does not take.
const overpass = { osm3s: { timestamp_osm_base: '2026-10-04T07:59:01Z' }, elements: [
  { type: 'node', id: 50, lat: at(50, 31)[1], lon: at(50, 31)[0], tags: { amenity: 'bench' } },
  { type: 'way', id: 99, tags: { highway: 'steps' }, geometry: [at(30, 31), at(70, 31)].map(([lon, lat]) => ({ lat, lon })) },
] };
const answers = (walkSteps: boolean, waySteps: boolean): AroundAnswers => ({ schema: 'mercature-way-around-answers/1', server: 'https://valhalla1.openstreetmap.de', fetchedAt: '2026-10-04T08:00:00.000Z', walkTrace: { request: {}, body: walkTrace(walkSteps) }, route: { request: {}, body: route }, routeTrace: { request: {}, body: routeTrace(waySteps) }, overpass: { query: '', body: overpass } });

test('the walk is cut into 10 m stretches and a last sliver joins the one before', () => {
  expect(cutStretches([at(0), at(25)]).map(s => [s.index, s.from, s.to])).toEqual([[0, 0, 10], [1, 10, 20], [2, 20, 25]]);
  expect(cutStretches([at(0), at(20.3)]).map(s => [s.from, s.to])).toEqual([[0, 10], [10, 20.3]]);
});

test('a way around the mapped steps is found, kept off the steps beside it, and read back', () => {
  const around = wayAroundFrom(answers(true, false), walk);
  expect(around.status).toBe('found');
  expect(around.label).toBe(AROUND_LABEL);
  expect(around.avoids).toEqual([{ way: 7, name: 'Loreto', label: 'Steps', stretches: [4] }]);
  expect(around.lengthMetres!).toBeGreaterThan(159);
  expect(around.lengthMetres!).toBeLessThan(161);
  expect(around.apart!.leaves).toBeGreaterThan(15);
  expect(around.apart!.rejoins).toBeLessThan(85);
  expect(around.streets).toEqual(['Maruri', 'Romeritos']);
  expect(around.kinds.map(k => k.kind)).toEqual(['bench']);
  expect(around.routed).toMatchObject({ options: { step_penalty: 3600 }, osmAsOf: '2026-10-04T07:59:01Z' });
  expect(readWayAround(JSON.parse(JSON.stringify(around)))).toEqual(around);
  expect(() => readWayAround({ ...around, line: [] })).toThrow();
  expect(mapPaths(around, [])).toEqual([{ id: 'around', kind: 'around', line: around.line.map(([lon, lat]) => [lon, lat]) }]);
});

test('steps left on the way mean there is no way around, and a walk with none has nothing to go around', () => {
  const none = wayAroundFrom(answers(true, true), walk);
  expect([none.status, none.line, none.avoids.length]).toEqual(['none', [], 1]);
  const same = wayAroundFrom(answers(false, false), walk);
  expect([same.status, same.line, same.avoids]).toEqual(['same', [], []]);
  expect(mapPaths(none, [])).toEqual([]);
});

test('a walk asked live sends an hour per flight of steps and still gives the way when Overpass is busy', async () => {
  const sent: { action: string; request: unknown }[] = [];
  const ask: Ask = {
    valhalla: async (action, request) => { sent.push({ action, request }); return action === 'route' ? route : 'encoded_polyline' in (request as object) ? routeTrace(false) : walkTrace(true); },
    overpass: async () => { throw new RouteTrouble('busy'); },
  };
  const around = await findWayAround(walkLine, { ask });
  expect(sent.map(item => item.action)).toEqual(['trace_attributes', 'route', 'trace_attributes']);
  expect(sent[1].request).toMatchObject({ costing: 'pedestrian', costing_options: { pedestrian: { step_penalty: 3600 } } });
  expect([around.status, around.kinds, around.routed.osmAsOf]).toEqual(['found', [], null]);
});

test('her streets keep their ids after a removal, read back, and a tap far from the walk asks nothing', async () => {
  const ask: Ask = { valhalla: async action => action === 'route' ? route : routeTrace(false), overpass: async () => overpass };
  const street = await buildStreet(at(0), at(100), walkLine, { ask, now: new Date('2026-10-04T08:00:00.000Z') });
  expect([street.label, street.name, street.kinds.map(k => k.kind)]).toEqual([STREET_LABEL, 'Maruri', ['bench']]);
  let lines = addStreet(addStreet(emptyLines('cusco-qorikancha'), street), street);
  lines = addStreet(removeStreet(lines, 'street-2'), street);
  expect(lines.streets.map(s => s.id)).toEqual(['street-1', 'street-3']);
  lines = setCheck(lines, true, '2026-10-04T08:05:00.000Z');
  expect(parseLines(JSON.stringify(lines), 'cusco-qorikancha')).toEqual(lines);
  expect(() => parseLines(JSON.stringify(lines), 'tbilisi-narikala')).toThrow();
  let asked = false;
  await expect(buildStreet(at(0, 1000), at(100), walkLine, { ask: { valhalla: async () => { asked = true; }, overpass: async () => { asked = true; } } })).rejects.toMatchObject({ kind: 'too-far' });
  expect(asked).toBe(false);
  expect(wayAroundOf({ wayAround: null }, lines)).toBeNull();
});

test('every published way around reads back and goes around the steps its walk records', () => {
  for (const folder of readdirSync('public/places')) {
    const file = `public/places/${folder}/place.json`;
    if (!existsSync(file)) continue;
    const place = JSON.parse(readFileSync(file, 'utf8'));
    if (place.way_around == null) continue;
    const around = readWayAround(place.way_around);
    const flagged = new Set(place.findings.filter((f: { concept: string; osm?: unknown }) => f.concept === 'highway=steps' && f.osm).flatMap((f: { stretches: number[] }) => f.stretches));
    expect(around.avoids.flatMap(item => item.stretches).every(index => flagged.has(index))).toBe(true);
    if (around.status === 'found') expect(Math.max(distance(around.line[0], place.route.line[0]), distance(around.line.at(-1)!, place.route.line.at(-1)))).toBeLessThan(1);
  }
});

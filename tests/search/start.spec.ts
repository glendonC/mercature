import { test, expect } from '@playwright/test';
import { pickStart, startCandidates } from '../../src/search/start';
import { routeWalk } from '../../src/search/run';
import { findPlaces } from '../../src/search/services';
import type { LonLat } from '../../src/search/geo';

const target: LonLat = [-73.9701, 40.8509];
const away = (east: number, north: number): LonLat => [target[0] + east / (111195 * Math.cos(target[1] * Math.PI / 180)), target[1] + north / 111195];
const node = (id: number, at: LonLat, tags: Record<string, string>) => ({ type: 'node' as const, id, lon: at[0], lat: at[1], tags });

test('a start is a named stop, square, park or landmark at least 200 m away, never an address', () => {
  const start = pickStart(target, [
    node(1, away(6, 0), { name: '1074', 'addr:housenumber': '1074' }),
    node(2, away(300, 0), { name: '1080', 'addr:housenumber': '1080', 'addr:street': 'Anderson Avenue' }),
    node(3, away(120, 0), { highway: 'bus_stop', name: 'Anderson Av & Main St' }),
    node(4, away(0, 420), { highway: 'bus_stop', name: 'Lemoine Av & Main St' }),
    node(5, away(0, -450), { highway: 'primary', name: 'Lemoine Avenue' }),
  ]);
  expect(start?.name).toBe('Lemoine Av & Main St');
  expect(pickStart(target, [node(1, away(300, 0), { name: '12B' }), node(2, away(500, 0), { leisure: 'park', name: 'Monument Park' })])?.name).toBe('Monument Park');
  expect(pickStart(target, [node(1, away(50, 0), { place: 'square', name: 'Too Close Square' })])).toBeNull();
});

test('an address found by search is named by its street address, never the bare number', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([{ osm_type: 'node', osm_id: 1, lat: '40.8509', lon: '-73.9701', type: 'house', addresstype: 'building', place_rank: 30,
    boundingbox: ['40.8508', '40.8510', '-73.9702', '-73.9700'], name: '', display_name: '1077, Anderson Avenue, Fort Lee, Bergen County, New Jersey, 07024, United States',
    namedetails: {}, address: { house_number: '1077', road: 'Anderson Avenue', town: 'Fort Lee', country: 'United States' } }]), { headers: { 'content-type': 'application/json' } });
  try {
    const [found] = await findPlaces('1077 Anderson Avenue Fort Lee');
    expect(found.name).toBe('1077 Anderson Avenue');
    expect(found.area).toBe('Fort Lee, United States');
    expect(found.broad).toBe(false);
  } finally { globalThis.fetch = real; }
});

/** Encodes [lon, lat] points as a Valhalla shape (polyline at six decimals). */
function shape(points: LonLat[]) {
  let out = '', lat = 0, lon = 0;
  const put = (value: number) => { let v = value < 0 ? ~(value << 1) : value << 1; while (v >= 0x20) { out += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } out += String.fromCharCode(v + 63); };
  for (const [x, y] of points) { const a = Math.round(y * 1e6), b = Math.round(x * 1e6); put(a - lat); put(b - lon); lat = a; lon = b; }
  return out;
}

test('trails are never a start, and the same answer always gives the same order', () => {
  const elements = [
    node(1, away(400, 0), { highway: 'path', name: 'Shore Trail' }),
    node(2, away(0, 450), { leisure: 'park', name: 'Monument Park' }),
    node(3, away(0, -450), { place: 'square', name: 'Anderson Square' }),
    node(4, away(450, 0), { tourism: 'attraction', name: 'Palisades Trail Overlook Trail' }),
  ];
  const names = startCandidates(target, elements).map(start => start.name);
  expect(names).toEqual(['Anderson Square', 'Monument Park']);
  expect(startCandidates(target, [...elements].reverse()).map(start => start.name)).toEqual(names);
});

test('a start is judged by its walk on foot: one over 900 m gives way to the next', async () => {
  const real = globalThis.fetch;
  const near = away(0, -450), far = away(0, 450);
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (url.includes('overpass')) return json({ elements: [node(1, far, { place: 'square', name: 'Far Square' }), node(2, near, { highway: 'bus_stop', name: 'Near Stop' })] });
    // The stop's walk detours 1.6 km; the square's is direct.
    const from = JSON.parse(String(init?.body)).locations[0];
    const detour = Math.abs(from.lat - near[1]) < 1e-6;
    const line: LonLat[] = detour ? [near, away(800, -450), away(800, 0), target] : [far, target];
    return json({ trip: { legs: [{ shape: shape(line), maneuvers: [{ street_names: ['Lemoine Avenue'], begin_shape_index: 0, end_shape_index: line.length - 1 }] }] } });
  }) as typeof fetch;
  try {
    const routed = await routeWalk({ name: 'Museum', position: target }, 'Fort Lee');
    expect(routed.base.start.name).toBe('Far Square');
    expect(routed.base.walked.lengthMetres).toBeLessThan(900);
  } finally { globalThis.fetch = real; }
});

test('a road that only shares some of the words comes after the places', async () => {
  const real = globalThis.fetch;
  const row = (name: string, category: string, type: string) => ({ osm_type: 'way', osm_id: name.length, lat: '40.8509', lon: '-73.9701', category, type, addresstype: type, place_rank: 27,
    boundingbox: ['40.8508', '40.8510', '-73.9702', '-73.9700'], name, display_name: `${name}, Fort Lee, United States`, namedetails: { name }, address: { town: 'Fort Lee', country: 'United States' } });
  globalThis.fetch = (async () => new Response(JSON.stringify([row('Historic Park Road', 'highway', 'service'), row('Fort Lee Historic Park Visitor Center', 'tourism', 'information')]), { headers: { 'content-type': 'application/json' } })) as typeof fetch;
  try {
    expect((await findPlaces('Fort Lee Historic Park')).map(found => found.name)).toEqual(['Fort Lee Historic Park Visitor Center', 'Historic Park Road']);
  } finally { globalThis.fetch = real; }
});

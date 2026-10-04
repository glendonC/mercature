import { test, expect } from '@playwright/test';
import { findPlaces } from '../../src/search/services';

const answer = (rows: object[]) => async () => new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } });
const row = (name: string, category: string, type: string, rank: number, box: number[], population?: string) => ({ osm_type: 'relation', osm_id: rank, lat: String((box[0] + box[1]) / 2), lon: String((box[2] + box[3]) / 2),
  category, type, addresstype: type, place_rank: rank, boundingbox: box.map(String), name, display_name: `${name}, Somewhere`, namedetails: { name }, address: { country: 'Somewhere' }, extratags: population ? { population } : {} });

test('a region or a large city is big, a village or small town is walked to its centre', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = answer([
    row('Lima', 'place', 'city', 15, [-12.3, -11.8, -77.2, -76.8], '9989369'),
    row('Lima Region', 'boundary', 'region', 12, [-13, -10, -78, -76]),
    row('Hallstatt', 'place', 'village', 19, [47.54, 47.58, 13.62, 13.67], '388'),
    row('Oodnadatta', 'boundary', 'village', 18, [-27.7, -27.45, 135.3, 135.55], '102'),
    row('Hallstatt Gemeinde', 'boundary', 'city', 16, [47.48, 47.62, 13.58, 13.75]),
    row('A Large Park', 'leisure', 'park', 30, [40.76, 40.80, -73.98, -73.95]),
  ]) as typeof fetch;
  try {
    const found = Object.fromEntries((await findPlaces('x')).map(item => [item.name, item.broad]));
    expect(found).toEqual({ 'Lima': true, 'Lima Region': true, 'Hallstatt': false, 'Oodnadatta': false, 'Hallstatt Gemeinde': true, 'A Large Park': true });
  } finally { globalThis.fetch = real; }
});

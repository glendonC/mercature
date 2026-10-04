import { test, expect } from '@playwright/test';
import { pickStart } from '../../src/search/start';
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

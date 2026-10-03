import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { QORIKANCHA_PLACE } from '../../src/site/route';
import { ROUTE_PLACES } from '../../src/site/registry';

const folder = resolve('public/places', QORIKANCHA_PLACE.folder);
type View = { id: string; photo_id: string; file: string };
type Photo = { id: string; creator: { username: string }; licence: string; link: string };
type Finding = { view_id: string | null; stretches: number[]; verified: boolean };

test('every registered place ships a package built from its current spots', () => {
  for (const [id, place] of Object.entries(ROUTE_PLACES)) {
    expect(place.id).toBe(id);
    const file = resolve('public/places', place.folder, 'place.json');
    expect(existsSync(file), `${file}: run node scripts/places/package.mjs ${id}`).toBe(true);
    const published = JSON.parse(readFileSync(file, 'utf8'));
    expect(published).toMatchObject({ schema: 'mercature-place/1', id, synthetic: false, local_only: false });
    expect(published.route_spots, `${id}: spots changed since its package was built`).toEqual(place.features.map(spot => ({ id: spot.id, stretches: spot.stretches, landmark: spot.landmark })));
  }
});

test('the published Qorikancha package parses, credits every photo and ships every image it references', () => {
  const place = JSON.parse(readFileSync(join(folder, 'place.json'), 'utf8'));
  expect(place).toMatchObject({ schema: 'mercature-place/1', id: QORIKANCHA_PLACE.id, synthetic: false, local_only: false });
  expect(place.attribution.map).toContain('OpenStreetMap');
  expect(place.stretches).toHaveLength(60);
  expect(place.findings.every((finding: Finding) => finding.verified === false)).toBe(true);
  expect(place.route_spots.map((spot: { id: string }) => spot.id)).toEqual(QORIKANCHA_PLACE.features.map(spot => spot.id));
  // Every retained photo is a credited record; only the shipped views carry images.
  expect(place.photos).toHaveLength(403);
  expect(new Set(place.photos.map((photo: Photo) => photo.id)).size).toBe(403);
  for (const photo of place.photos as Photo[]) expect(photo.creator.username && photo.licence === 'CC-BY-SA-4.0' && photo.link, photo.id).toBeTruthy();
  const shipped = new Set(place.views.map((view: View) => view.id));
  for (const view of place.views as View[]) {
    expect(existsSync(join(folder, view.file)), view.file).toBe(true);
    const photo = (place.photos as Photo[]).find(item => item.id === view.photo_id);
    expect(photo?.creator.username && photo.licence === 'CC-BY-SA-4.0' && photo.link, view.id).toBeTruthy();
  }
  for (const stretch of place.stretches) for (const id of stretch.views) expect(shipped.has(id)).toBe(true);
  const flagged = (finding: Finding) => finding.stretches.some(index => place.stretches[index].status !== 'clear');
  for (const finding of (place.findings as Finding[]).filter(finding => finding.view_id && flagged(finding))) expect(shipped.has(finding.view_id)).toBe(true);
  const files = readdirSync(join(folder, 'views')).sort();
  expect(files).toEqual(place.views.map((view: View) => view.file.slice('views/'.length)).sort());
  expect(['place.json', ...files.map(name => `views/${name}`)].reduce((sum, name) => sum + statSync(join(folder, name)).size, 0)).toBeLessThan(10_000_000);
});

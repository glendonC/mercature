import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { QORIKANCHA_PLACE } from '../../src/site/route';

const folder = resolve('public/places/qorikancha');
type View = { id: string; photo_id: string; file: string };
type Photo = { id: string; creator: { username: string }; licence: string; link: string };
type Finding = { view_id: string | null; stretches: number[]; verified: boolean };

test('the published Qorikancha package parses, credits every photo and ships every image it references', () => {
  const place = JSON.parse(readFileSync(join(folder, 'place.json'), 'utf8'));
  expect(place).toMatchObject({ schema: 'mercature-place/1', id: QORIKANCHA_PLACE.id, synthetic: false, local_only: false });
  expect(place.attribution.map).toContain('OpenStreetMap');
  expect(place.stretches).toHaveLength(60);
  expect(place.findings.every((finding: Finding) => finding.verified === false)).toBe(true);
  expect(place.route_spots.map((spot: { id: string }) => spot.id)).toEqual(QORIKANCHA_PLACE.features.map(spot => spot.id));
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

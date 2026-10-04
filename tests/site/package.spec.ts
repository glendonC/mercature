import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { QORIKANCHA_PLACE } from '../../src/site/route';
import { ROUTE_PLACES } from '../../src/site/registry';

const folder = resolve('public/places', QORIKANCHA_PLACE.folder);
type View = { id: string; photo_id: string; file: string };
type Photo = { id: string; creator: { username: string }; licence: string; link: string };
type Finding = { id: string; view_id: string | null; stretches: number[]; verified: boolean; barrier: boolean; position: number[] | null; outline: number[][] | null };
type Mark = { id: string; view_id: string; photo_id: string; concept: string; verified: boolean; barrier: boolean; flagged: boolean; finding: string | null; outline: number[][] | null; position: number[] | null; stretches: number[] };
type Kind = { concept: string; barrier: boolean; surface: boolean; marks: number; near_route: number };

test('every registered place ships a package built from its current spots', () => {
  for (const [id, place] of Object.entries(ROUTE_PLACES)) {
    expect(place.id).toBe(id);
    const file = resolve('public/places', place.folder, 'place.json');
    expect(existsSync(file), `${file}: run node scripts/places/package.mjs ${id}`).toBe(true);
    const published = JSON.parse(readFileSync(file, 'utf8'));
    expect(published).toMatchObject({ schema: 'mercature-place/1', id, synthetic: false, local_only: false });
    expect(published.route_spots, `${id}: spots changed since its package was built`).toEqual(place.features.map(spot => ({ id: spot.id, stretches: spot.stretches, landmark: spot.landmark })));
    // What OpenStreetMap says rides in its own key: on real stretches, credited, never a width or incline, a barrier only for steps.
    const osm = published.osm, count = published.stretches.length;
    expect(osm.findings.length, id).toBeGreaterThan(0);
    for (const finding of osm.findings) {
      expect(finding.source === 'openstreetmap' && finding.label.startsWith('OpenStreetMap says: ') && finding.barrier === (finding.kind === 'steps'), finding.id).toBe(true);
      expect(finding.stretches.length > 0 && finding.stretches.every((index: number) => index >= 0 && index < count), finding.id).toBe(true);
    }
    expect(JSON.stringify(osm)).not.toMatch(/"(width|incline)"/);
    expect(osm.kinds.reduce((sum: number, kind: { count: number }) => sum + kind.count, 0)).toBe(osm.findings.length);
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

test('the Qorikancha package indexes every SAM 3 mark, unverified, without changing its findings', () => {
  const place = JSON.parse(readFileSync(join(folder, 'place.json'), 'utf8'));
  const scan = place.scan, marks: Mark[] = scan.marks, kinds = new Map((scan.kinds as Kind[]).map(kind => [kind.concept, kind]));
  expect(scan).toMatchObject({ model: 'sam3', views: 116, near_m: 3 });
  expect(scan.prompts).toHaveLength(13);
  expect(scan.left_out).toEqual([expect.objectContaining({ concept: 'pothole', reason: expect.stringContaining('drain covers') })]);
  expect([...kinds.values()].filter(kind => kind.barrier).map(kind => kind.concept).sort()).toEqual(['broken pavement', 'kerb', 'steps']);
  for (const concept of ['footway', 'road', 'cobblestones', 'crossing']) expect(kinds.get(concept)).toMatchObject({ barrier: false, surface: true });
  expect([...kinds.values()].reduce((sum, kind) => sum + kind.marks, 0)).toBe(479);
  const findings = new Map((place.findings as Finding[]).map(finding => [finding.id, finding]));
  const views = new Map((place.views as (View & { width: number; height: number })[]).map(view => [view.id, view]));
  const photos = new Set((place.photos as Photo[]).map(photo => photo.id));
  expect(new Set(marks.map(mark => mark.id)).size).toBe(marks.length);
  for (const mark of marks) {
    expect(mark.verified === false && !findings.has(mark.id) && photos.has(mark.photo_id) && kinds.has(mark.concept), mark.id).toBe(true);
    expect(mark.barrier, mark.id).toBe(kinds.get(mark.concept)!.barrier);
    // Outlined exactly when its view ships; listed from another view only when it is near the route.
    const view = views.get(mark.view_id);
    expect(!!mark.outline, mark.id).toBe(!!view);
    if (view) for (const [x, y] of mark.outline!) expect(x >= 0 && y >= 0 && x <= view.width && y <= view.height, mark.id).toBe(true);
    else expect(mark.position, mark.id).not.toBeNull();
    expect(mark.stretches.length > 0, mark.id).toBe(!!mark.position);
    const finding = mark.finding ? findings.get(mark.finding) : undefined;
    expect(mark.flagged, mark.id).toBe(finding?.barrier === true);
    if (finding) expect({ position: mark.position, stretches: mark.stretches, outline: mark.outline ?? finding.outline }).toEqual({ position: finding.position, stretches: finding.stretches, outline: finding.outline });
  }
  // Every photo finding is exactly one mark, so the possible barriers stay as they were.
  const photoFindings = (place.findings as Finding[]).filter(finding => finding.view_id);
  expect(marks.flatMap(mark => mark.finding ?? []).sort()).toEqual(photoFindings.map(finding => finding.id).sort());
  expect(marks.filter(mark => mark.flagged)).toHaveLength(photoFindings.filter(finding => finding.barrier).length);
  expect(marks.filter(mark => mark.outline)).toHaveLength(125);
  for (const kind of kinds.values()) expect(kind.near_route, kind.concept).toBe(marks.filter(mark => mark.concept === kind.concept && mark.position).length);
});

import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QORIKANCHA_PLACE } from '../../src/site/route';
import { ROUTE_PLACES } from '../../src/site/registry';
import { metres, type Coordinate } from '../../src/destinations/data';

type Point = [number, number];
const segment = (p: Point, a: Point, b: Point) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const near = (line: Point[], parts: Point[][]) => Math.min(...parts.flatMap(part => part.flatMap((q, i) => [
  ...line.map(p => i ? segment(p, part[i - 1], q) : Math.hypot(p[0] - q[0], p[1] - q[1])),
  ...line.slice(1).map((p, j) => segment(q, line[j], p)),
])));

test('Qorikancha spot ids are stable', () => {
  expect(QORIKANCHA_PLACE.id).toBe('cusco-qorikancha');
  expect(QORIKANCHA_PLACE.features.map(spot => spot.id)).toEqual([
    'steps-0-10', 'kerb-80-100', 'steps-130-140', 'no-photos-150-170', 'steps-340-350', 'steps-590-594',
    'plaza-de-armas', 'qorikancha-ticket-booth', 'catedral-del-cusco', 'iglesia-de-la-compania-de-jesus',
    'calle-loreto', 'iglesia-de-santo-domingo', 'monasterio-de-santa-catalina-de-sena', 'portal-de-carrizos',
  ]);
});

// Every registered place gets the same checks. Recorded walks are local-only, so the checks against a record skip where it is absent, as in CI.
for (const place of Object.values(ROUTE_PLACES)) {
  const spots = place.features;
  const file = resolve('.local/routes', place.id, 'route.json');
  const record = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;

  test(`${place.id}: every spot keeps the agreed contract and wording limits`, () => {
    expect(new Set(spots.map(spot => spot.id)).size).toBe(spots.length);
    for (const spot of spots) {
      expect(spot.name.en && spot.name.es && spot.landmark).toBeTruthy();
      expect(spot.description).toMatch(/^[A-Z][^]*\.$/);
      expect(spot.description).not.toMatch(/\.\s+\S/);
      expect(Object.values(spot.aliases).flat().length).toBeLessThanOrEqual(16);
    }
    // Flagged stretches stay suggestions, and no spot states a width, height, slope or passability.
    for (const spot of spots.filter(spot => spot.stretches.length)) expect(spot.description).toMatch(/not verified|none of it verified|nothing is known/);
    expect(spots.map(spot => spot.description).join(' ')).not.toMatch(/\d\s?(cm|mm)\b|\bwide\b|width|height|slope|gradient|accessible|wheelchair|passable/i);
  });

  test(`${place.id}: every flagged stretch belongs to exactly one spot, grouped as the map draws them`, () => {
    // The published package is what the map reads, so the markers are taken from it, as committed.
    const published = JSON.parse(readFileSync(resolve('public/places', place.folder, 'place.json'), 'utf8'));
    type RecordStretch = { index: number; status: string; findings: string[]; from_m: number; to_m: number };
    // The map's own rule (buildWalk in src/destinations/walk.ts): a run without photos, or flagged stretches in a row
    // that share a possible barrier with the run, is one marker, and the route screen names each marker by its first stretch.
    const barrier = new Set(published.findings.filter((finding: { barrier: boolean }) => finding.barrier).map((finding: { id: string }) => finding.id));
    const runs: { stretches: number[]; status: string; findings: Set<string> }[] = [];
    for (const stretch of published.stretches as RecordStretch[]) {
      if (stretch.status === 'clear') continue;
      const last = runs.at(-1), findings = stretch.status === 'no_photos' ? [] : stretch.findings.filter(id => barrier.has(id));
      if (last && last.status === stretch.status && last.stretches.at(-1) === stretch.index - 1 && (stretch.status === 'no_photos' || findings.some(id => last.findings.has(id)))) {
        last.stretches.push(stretch.index); for (const id of findings) last.findings.add(id);
      } else runs.push({ stretches: [stretch.index], status: stretch.status, findings: new Set(findings) });
    }
    expect(spots.filter(spot => spot.stretches.length).map(spot => spot.stretches).sort((a, b) => a[0] - b[0])).toEqual(runs.map(run => run.stretches));
    for (const spot of spots.filter(spot => spot.stretches.length)) {
      const group = spot.stretches.map(index => published.stretches[index] as RecordStretch);
      expect(spot.name.en).toContain(`(${Math.round(group[0].from_m)} to ${Math.round(group.at(-1)!.to_m)} m)`);
    }
  });

  test(`${place.id}: each landmark is a name from the record, close to its spot`, () => {
    test.skip(!record, 'The local route record is not available.');
    const origin: Coordinate = record.route.frame.origin.slice(0, 2);
    const local = (p: Coordinate): Point => metres(p, origin) as Point;
    const geometry = new Map<string, Point[][]>();
    for (const feature of [...record.map_context.buildings.features, ...record.map_context.ways.features]) {
      const { type, coordinates } = feature.geometry, name = feature.properties.name;
      if (!name) continue;
      const parts: Coordinate[][] = type === 'LineString' ? [coordinates] : coordinates;
      geometry.set(name, [...(geometry.get(name) ?? []), ...parts.map(part => part.map(local))]);
    }
    const ends = new Map([[record.request.start.name, record.request.start.position], [record.request.destination.name, record.request.destination.position]]);
    const route = record.route.line.map(local);
    for (const spot of spots) {
      const parts = geometry.get(spot.landmark) ?? (ends.has(spot.landmark) ? [[local(ends.get(spot.landmark))]] : undefined);
      expect(parts, spot.landmark).toBeDefined();
      const line = spot.stretches.length ? spot.stretches.flatMap(index => record.stretches[index].line.map(local)) : route;
      expect(near(line, parts!), `${spot.id} to ${spot.landmark}`).toBeLessThan(40);
    }
  });
}

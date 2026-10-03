#!/usr/bin/env node
// Builds public/places/qorikancha from the local record in .local/routes. No network; the same input gives the same bytes.
// Point clouds stay local. Images are byte copies of the finding views and sips resizes of the reveal views (macOS).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QORIKANCHA_PLACE } from '../../src/site/route.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = join(root, '.local/routes/cusco-qorikancha');
const target = join(root, 'public/places/qorikancha');
const REVEAL = { count: 20, every: 3, size: 480, quality: 72 };
const SOURCES = ['mapillary', 'openstreetmap', 'valhalla', 'sam3'];

if (!existsSync(join(source, 'route.json'))) throw new Error(`Missing ${join(source, 'route.json')}; link .local/routes first.`);
const record = JSON.parse(readFileSync(join(source, 'route.json'), 'utf8'));
if (record.schema !== 'mercature-route/1' || record.id !== 'cusco-qorikancha' || record.synthetic !== false) throw new Error('Unexpected route record.');

const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;
const position = point => point == null ? null : [round(point[0], 7), round(point[1], 7)];
const views = new Map(record.views.filter(view => view.file).map(view => [view.id, view]));

// Every view behind a finding on a flagged stretch ships at its retained size.
const flagged = new Set(record.stretches.filter(stretch => stretch.status !== 'clear').map(stretch => stretch.index));
const evidence = [...new Set(record.findings.filter(f => f.view_id && f.stretches.some(i => flagged.has(i))).map(f => f.view_id))].sort();
for (const id of evidence) if (!views.has(id)) throw new Error(`Finding view ${id} is not retained.`);
// About one more view every few stretches for the reveal: forward-facing first, then by id.
const reveal = [];
for (let index = 1; index < record.stretches.length && reveal.length < REVEAL.count; index += REVEAL.every) {
  const choice = [...views.values()].filter(view => view.stretches?.includes(index) && !evidence.includes(view.id) && !reveal.includes(view.id))
    .sort((a, b) => (a.faces === 'ahead' ? 0 : 1) - (b.faces === 'ahead' ? 0 : 1) || (a.id < b.id ? -1 : 1))[0];
  if (choice) reveal.push(choice.id);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(join(target, 'views'), { recursive: true });
const shipped = new Map();
for (const id of evidence) { copyFileSync(join(source, `views/${id}.jpg`), join(target, `views/${id}.jpg`)); shipped.set(id, { role: 'finding', width: views.get(id).width, height: views.get(id).height }); }
for (const id of reveal) {
  const out = join(target, `views/${id}.jpg`);
  execFileSync('sips', ['-Z', String(REVEAL.size), '-s', 'formatOptions', String(REVEAL.quality), join(source, `views/${id}.jpg`), '--out', out], { stdio: 'ignore' });
  const size = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', out], { encoding: 'utf8' });
  shipped.set(id, { role: 'reveal', width: Number(/pixelWidth: (\d+)/.exec(size)[1]), height: Number(/pixelHeight: (\d+)/.exec(size)[1]) });
}

const findings = record.findings.map(f => ({
  id: f.id, label: f.label, concept: f.concept, barrier: f.barrier === true, score: f.score, verified: false, source: f.source, model: f.model, note: f.note,
  photo_id: f.photo_id, view_id: f.view_id, stretches: f.stretches, position: position(f.position),
  box: f.box, outline: f.outline?.map(([x, y]) => [round(x, 1), round(y, 1)]) ?? null, osm: f.osm,
}));
const photoIds = new Set([...[...shipped.keys()].map(id => views.get(id).photo_id), ...findings.map(f => f.photo_id).filter(Boolean)]);
const place = {
  schema: 'mercature-place/1', id: record.id, title: record.title, place: record.place, synthetic: false, local_only: false,
  built_from: { schema: record.schema, built_at: record.built_at },
  attribution: {
    photos: 'Street photos by Mapillary contributors under CC BY-SA 4.0; each photo names its creator and source. Views are crops and resizes of those photos, shared under the same licence.',
    map: '© OpenStreetMap contributors, under the Open Database License 1.0 (https://www.openstreetmap.org/copyright).',
    findings: 'Outlines are model suggestions from SAM 3 that nobody has verified. A stretch without findings only means no barrier was seen in photos.',
  },
  sources: record.sources.filter(s => SOURCES.includes(s.id)),
  request: { start: { name: record.request.start.name, position: position(record.request.start.position) }, destination: { name: record.request.destination.name, position: position(record.request.destination.position), osm: record.request.destination.osm } },
  route: { kind: record.route.kind, provider: record.route.provider, fetched_at: record.route.fetched_at, frame: record.route.frame, length_m: round(record.route.length_m, 1), line: record.route.line.map(position) },
  summary: record.summary,
  stretches: record.stretches.map(s => ({ index: s.index, from_m: round(s.from_m, 1), to_m: round(s.to_m, 1), status: s.status, line: s.line.map(position), findings: s.findings, views: (s.views ?? []).filter(id => shipped.has(id)) })),
  findings,
  views: [...shipped.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([id, file]) => {
    const view = views.get(id);
    return { id, photo_id: view.photo_id, kind: view.kind, faces: view.faces ?? null, role: file.role, file: `views/${id}.jpg`, width: view.width, height: view.height, file_width: file.width, file_height: file.height,
      cut: view.cut ? { yaw_deg: view.cut.yaw_deg, pitch_deg: view.cut.pitch_deg, hfov_deg: view.cut.hfov_deg } : null, stretches: view.stretches ?? [] };
  }),
  photos: record.photos.filter(p => photoIds.has(p.id)).map(p => ({
    id: p.id, provider: p.provider, position: position(p.position), computed_position: position(p.computed_position), heading: p.heading ?? null, computed_heading: p.computed_heading ?? null,
    captured_at: p.captured_at, is_360: p.is_360 === true, creator: { username: p.creator?.username ?? 'Mapillary contributor' }, licence: p.licence, link: p.link,
  })),
  map_context: record.map_context,
  route_spots: QORIKANCHA_PLACE.features.map(spot => ({ id: spot.id, stretches: spot.stretches, landmark: spot.landmark })),
};
for (const view of place.views) if (!place.photos.some(photo => photo.id === view.photo_id && photo.creator.username && photo.licence && photo.link)) throw new Error(`View ${view.id} has no credited photo.`);
writeFileSync(join(target, 'place.json'), `${JSON.stringify(place)}\n`);

const bytes = readdirSync(target, { recursive: true }).map(name => join(target, name)).filter(path => statSync(path).isFile()).reduce((sum, path) => sum + statSync(path).size, 0);
console.log(`${evidence.length} finding views, ${reveal.length} reveal views, ${place.photos.length} credited photos, ${findings.length} findings, ${(bytes / 1e6).toFixed(2)} MB`);

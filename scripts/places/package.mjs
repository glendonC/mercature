#!/usr/bin/env node
// Builds public/places/<folder> for one place in ROUTE_PLACES from its local record in .local/routes/<id>,
// its SAM 3 scan output in .local/scans/<id> (scans.json and masks/) and what OpenStreetMap says along it in
// .local/osm/<id>.json (fetched once with scripts/places/osm.mjs).
// Usage: node scripts/places/package.mjs <id>. No network; the same input gives the same bytes.
// Point clouds stay local. Images are byte copies of the finding views, or sips resizes once they would pass FINDING.budget, and sips resizes of the reveal views (macOS).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTE_PLACES } from '../../src/site/registry.ts';
import { accessFindings, accessKinds } from '../../src/osm/access.ts';
import { marksFromRows, placeMarks, promptTable, readPiece } from './marks.mjs';

const id = process.argv[2];
if (!id || !Object.hasOwn(ROUTE_PLACES, id)) {
  console.error(`Usage: node scripts/places/package.mjs <id>, where <id> is one of: ${Object.keys(ROUTE_PLACES).join(', ')}.`);
  process.exit(1);
}
const routePlace = ROUTE_PLACES[id];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = join(root, '.local/routes', id);
const target = join(root, 'public/places', routePlace.folder);
const REVEAL = { count: 20, every: 3, size: 480, quality: 72 };
// A walk with many photo findings ships them smaller; outlines keep the retained view's pixels, since the app scales each image to its view.
const FINDING = { budget: 3_000_000, size: 720, quality: 45 };
const SOURCES = ['mapillary', 'openstreetmap', 'valhalla', 'sam3'];

const scanDir = join(root, '.local/scans', id);
if (!existsSync(join(source, 'route.json'))) throw new Error(`Missing ${join(source, 'route.json')}; link .local/routes first.`);
if (!existsSync(join(scanDir, 'scans.json'))) throw new Error(`Missing ${join(scanDir, 'scans.json')}; link .local/scans/${id} to the scan's gpu-output/scan first.`);
const osmFile = join(root, '.local/osm', `${id}.json`);
if (!existsSync(osmFile)) throw new Error(`Missing ${osmFile}; run node scripts/places/osm.mjs ${id} first.`);
const record = JSON.parse(readFileSync(join(source, 'route.json'), 'utf8'));
if (record.schema !== 'mercature-route/1' || record.id !== id || record.synthetic !== false) throw new Error('Unexpected route record.');

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
const resize = (id, { size, quality }) => {
  const out = join(target, `views/${id}.jpg`);
  execFileSync('sips', ['-Z', String(size), '-s', 'formatOptions', String(quality), join(source, `views/${id}.jpg`), '--out', out], { stdio: 'ignore' });
  const pixels = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', out], { encoding: 'utf8' });
  return { width: Number(/pixelWidth: (\d+)/.exec(pixels)[1]), height: Number(/pixelHeight: (\d+)/.exec(pixels)[1]) };
};
const smaller = evidence.reduce((sum, id) => sum + statSync(join(source, `views/${id}.jpg`)).size, 0) > FINDING.budget;
for (const id of evidence) {
  if (smaller) { shipped.set(id, { role: 'finding', ...resize(id, FINDING) }); continue; }
  copyFileSync(join(source, `views/${id}.jpg`), join(target, `views/${id}.jpg`)); shipped.set(id, { role: 'finding', width: views.get(id).width, height: views.get(id).height });
}
for (const id of reveal) shipped.set(id, { role: 'reveal', ...resize(id, REVEAL) });

const findings = record.findings.map(f => ({
  id: f.id, label: f.label, concept: f.concept, barrier: f.barrier === true, score: f.score, verified: false, source: f.source, model: f.model, note: f.note,
  photo_id: f.photo_id, view_id: f.view_id, stretches: f.stretches, position: position(f.position),
  box: f.box, outline: f.outline?.map(([x, y]) => [round(x, 1), round(y, 1)]) ?? null, osm: f.osm,
}));

// SAM 3's marks: every one above its prompt's threshold (sam3-prompts.json, the prompts file the build used) on the
// shipped views, and every one near the route on any scanned view. Kinds the record's stage notes leave out stay out.
// A mark that is a finding keeps the finding's outline, position and stretches; the rest are placed as the build placed findings.
const prompts = promptTable(JSON.parse(readFileSync(join(root, 'scripts/places/sam3-prompts.json'), 'utf8')));
const leftOut = new Map(record.stages.notes.flatMap(note => {
  const match = /^The scan's "(.+)" marks \(\d+ views?\) are left out: (.+)\.$/.exec(note);
  return match && prompts[match[1]] ? [[prompts[match[1]].concept, match[2]]] : [];
}));
const scanned = new Map(record.views.filter(view => view.scanned).map(view => [view.id, [view.width, view.height]]));
const rows = JSON.parse(readFileSync(join(scanDir, 'scans.json'), 'utf8'));
if ([...new Set(rows.map(row => row.view_id))].sort().join() !== [...scanned.keys()].sort().join()) throw new Error('The scan does not cover the scanned views of the record.');
const counter = new Map();
const found = marksFromRows(rows, scanDir, prompts, scanned).map(mark => {
  const key = `${mark.view_id}-${mark.concept.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  counter.set(key, (counter.get(key) ?? 0) + 1);
  return { ...mark, id: `${key}-m${counter.get(key)}` };
});
const kept = found.filter(mark => !leftOut.has(mark.concept));
const photoFindings = record.findings.filter(f => f.view_id);
const findingOf = new Map(kept.flatMap(mark => photoFindings.filter(f => f.view_id === mark.view_id && f.concept === mark.concept && f.box.join() === mark.box.join()).map(f => [mark.id, f])));
if (new Set([...findingOf.values()].map(f => f.id)).size !== photoFindings.length || findingOf.size !== photoFindings.length) throw new Error('Every photo finding must be exactly one scan mark.');
const unmatched = kept.filter(mark => !findingOf.has(mark.id));
const placed = new Map(placeMarks(unmatched, record, record.spots.filter(spot => spot.piece).map(spot => readPiece(join(source, spot.piece.file)))).map((where, i) => [unmatched[i].id, where]));
const barrierKind = concept => Object.values(prompts).some(p => p.concept === concept && p.barrier);
const marks = kept.flatMap(mark => {
  const f = findingOf.get(mark.id), where = placed.get(mark.id), near = !!f || where.decision === 'near the route', ships = shipped.has(mark.view_id);
  if (!ships && !near) return [];
  return [{
    id: mark.id, view_id: mark.view_id, photo_id: mark.photo_id, concept: mark.concept, label: mark.label, score: round(mark.score, 4), verified: false,
    barrier: barrierKind(mark.concept), flagged: f?.barrier === true, finding: f?.id ?? null,
    box: ships ? f?.box ?? mark.box : null, outline: ships ? f?.outline.map(([x, y]) => [round(x, 1), round(y, 1)]) ?? mark.outline : null,
    position: near ? position(f?.position ?? where.position) : null, stretches: near ? f?.stretches ?? where.stretches : [],
  }];
}).sort((a, b) => a.id < b.id ? -1 : 1);
const concepts = [...new Set(Object.values(prompts).map(p => p.concept))];
const scan = {
  model: 'sam3', views: scanned.size, near_m: record.rules.near_m,
  prompts: Object.values(prompts).map(p => ({ prompt: p.prompt, concept: p.concept, threshold: p.threshold })),
  kinds: concepts.filter(concept => !leftOut.has(concept)).map(concept => {
    const all = kept.filter(mark => mark.concept === concept), prompt = Object.values(prompts).find(p => p.concept === concept);
    return { concept, label: prompt.label, barrier: barrierKind(concept), surface: prompt.context, marks: all.length, views: new Set(all.map(mark => mark.view_id)).size, near_route: marks.filter(mark => mark.concept === concept && mark.position).length };
  }).filter(kind => kind.marks),
  left_out: concepts.filter(concept => leftOut.has(concept)).map(concept => {
    const all = found.filter(mark => mark.concept === concept);
    return { concept, label: Object.values(prompts).find(p => p.concept === concept).label, marks: all.length, views: new Set(all.map(mark => mark.view_id)).size, reason: leftOut.get(concept) };
  }),
  marks,
};
const place = {
  schema: 'mercature-place/1', id: record.id, title: record.title, place: record.place, synthetic: false, local_only: false,
  built_from: { schema: record.schema, built_at: record.built_at },
  attribution: {
    photos: 'Street photos by Mapillary contributors under CC BY-SA 4.0; each photo names its creator and source. Views are crops and resizes of those photos, shared under the same licence.',
    map: '© OpenStreetMap contributors, under the Open Database License 1.0 (https://www.openstreetmap.org/copyright).',
    findings: 'Outlines are model suggestions from SAM 3 that nobody has verified. A stretch without findings only means no barrier was seen in photos.',
    marks: 'SAM 3 marks above their threshold that lie near the walk or on a published view, simplified from the model\'s outline; nobody has checked them. Pavement, road, cobblestones and crossings describe the ground, not barriers. One thing seen in several photos is one mark per photo.',
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
  // Every retained photo as a credited record, so a hosted build can place all camera points; only the views above ship images.
  photos: record.photos.map(p => ({
    id: p.id, provider: p.provider, position: position(p.position), computed_position: position(p.computed_position), heading: p.heading ?? null, computed_heading: p.computed_heading ?? null,
    captured_at: p.captured_at, is_360: p.is_360 === true, creator: { username: p.creator?.username ?? 'Mapillary contributor' }, licence: p.licence, link: p.link,
  })),
  map_context: record.map_context,
  route_spots: routePlace.features.map(spot => ({ id: spot.id, stretches: spot.stretches, landmark: spot.landmark })),
  scan,
};
// What OpenStreetMap says along the walk, placed on its stretches by src/osm/access.ts, the module a browser uses for a new walk.
// A new key at the end, so every key before it stays as it was.
const answer = JSON.parse(readFileSync(osmFile, 'utf8'));
const access = accessFindings(answer.elements, record.stretches.map(s => ({ index: s.index, line: s.line })), { nearMetres: record.rules.near_m });
place.osm = {
  source: 'OpenStreetMap via the Overpass API', fetched_at: answer.osm3s?.timestamp_osm_base ?? null, near_m: record.rules.near_m, amenity_m: 15,
  note: 'What OpenStreetMap says along the walk, never checked by a person. Widths and inclines are left out. Only steps are a possible barrier, as in the findings.',
  kinds: accessKinds(access), findings: access,
};
for (const view of place.views) if (!place.photos.some(photo => photo.id === view.photo_id && photo.creator.username && photo.licence && photo.link)) throw new Error(`View ${view.id} has no credited photo.`);
for (const mark of scan.marks) if (!place.photos.some(photo => photo.id === mark.photo_id && photo.creator.username && photo.licence && photo.link)) throw new Error(`Mark ${mark.id} has no credited photo.`);
writeFileSync(join(target, 'place.json'), `${JSON.stringify(place)}\n`);

const bytes = readdirSync(target, { recursive: true }).map(name => join(target, name)).filter(path => statSync(path).isFile()).reduce((sum, path) => sum + statSync(path).size, 0);
console.log(`${evidence.length} finding views, ${reveal.length} reveal views, ${place.photos.length} credited photos, ${findings.length} findings, ${marks.length} marks (${marks.filter(mark => mark.outline).length} outlined, ${marks.filter(mark => mark.position).length} near the route), ${access.length} OpenStreetMap findings, ${(bytes / 1e6).toFixed(2)} MB`);

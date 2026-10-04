/** Inspection adapter for the retained mercature-route/1 records and their published mercature-place/1 packages.
 * It never supplies accepted geometry to the synthetic access solver. */
import { ROUTE_PLACES } from '../site/registry';
import { readWayAround } from '../routes/around';
import type { WayAround } from '../routes/shape';
export const DESTINATIONS = {
  'cusco-qorikancha': { name: 'Qorikancha', place: 'Cusco, Peru' },
  'tbilisi-narikala': { name: 'Narikala', place: 'Tbilisi, Georgia' },
  'kathmandu-swayambhu': { name: 'Swayambhu', place: 'Kathmandu, Nepal' },
} as const;
export type DestinationId = keyof typeof DESTINATIONS;
export type Coordinate = [number, number];
export type Photo = { id: string; position: Coordinate; heading: number | null; capturedAt: string | null; creator: string; licence: string; link: string | null; file: string | null; thumb: string | null };
export type View = { id: string; photoId: string; file: string; width: number; height: number; heading: number | null };
export type Piece = { id: string; file: string; points: number; bytes: number; views: string[]; center: Coordinate; model: string; residual: number };
export type MapFeature = { id: string; name: string; kind: string; points: Coordinate[]; holes: Coordinate[][] };
/** A recorded observation: a model outline on one source photo, or an OpenStreetMap tag with no photo (viewId null). Never verified here.
 * position: where the build placed it on the walk (null for a tag); stretches: the stretches it spans. */
export type Finding = { id: string; viewId: string | null; photoId: string | null; label: string; concept: string; score: number | null; outline: Coordinate[]; verified: boolean; barrier: boolean; osm: Record<string, string> | null; position: Coordinate | null; stretches: number[] };
/** Every finding the place records, its photo shipped or not, as a place on the walk (a tag has no position, only its stretches). */
export type WalkFinding = Pick<Finding, 'id' | 'concept' | 'label' | 'barrier' | 'position' | 'stretches'>;
/** One thing SAM 3 outlined in one photo view; nobody has checked it. barrier: its kind can be a barrier (steps, kerb, broken pavement), drawn in clay.
 * flagged: one of the route's possible barriers (its finding says so). finding: the finding it is, or null.
 * outline: view pixels when its view ships, else empty. position and stretches: where it lies when near the route, else null and []. */
export type ScanMark = { id: string; viewId: string; photoId: string; concept: string; label: string; score: number; barrier: boolean; flagged: boolean; finding: string | null; outline: Coordinate[]; position: Coordinate | null; stretches: number[] };
/** A kind the scan marked, counted over every scanned view; one thing seen in several photos is one mark per photo. surface: it describes the ground or street, never a barrier. */
export type ScanKind = { concept: string; label: string; barrier: boolean; surface: boolean; marks: number; views: number; nearRoute: number };
/** What the photo scan looked at and what it left out; its marks are Destination.marks. */
export type Scan = { views: number; nearMetres: number; kinds: ScanKind[]; leftOut: { concept: string; label: string; marks: number; views: number; reason: string }[] };
/** A 10 m piece of the walk, as the preparation run classified it from its photos. */
export type Stretch = { index: number; from: number; to: number; status: 'clear' | 'barrier' | 'no-photos'; line: Coordinate[]; findings: string[]; views: string[] };
export type Destination = { id: DestinationId; title: string; place: string; localOnly: boolean; assets: string; origin: [number, number, number]; line: Coordinate[]; lengthMetres: number; start: { name: string; position: Coordinate } | null; target: { name: string; position: Coordinate }; photos: Photo[]; views: View[]; stretches: Stretch[]; pieces: Piece[]; buildings: MapFeature[]; ways: MapFeature[]; findings: Finding[]; walkFindings: WalkFinding[]; marks: ScanMark[]; scan: Scan | null; sources: { name: string; credit: string; licence: string; link: string | null }[];
  /** The way around the walk's mapped steps that OpenStreetMap's router suggests, prepared with the package; null or absent when it has none, as for a walk built on this device. */
  wayAround?: WayAround | null };
export type Cloud = { spot: string; points: number; positions: Float32Array; colours: Uint8Array; views: string[]; view: Uint16Array };
const fail = (text: string): never => { throw new Error(text); };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail('The prepared record is malformed.');
const text = (value: unknown, max = 2000) => typeof value === 'string' && value.length > 0 && value.length <= max ? value : fail('A prepared record has invalid text.');
const list = (value: unknown, max = 5000): unknown[] => Array.isArray(value) && value.length <= max ? value : fail('A prepared record exceeds the supported size.');
const number = (value: unknown, min = -1e7, max = 1e7) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fail('A prepared record has an invalid number.');
const count = (value: unknown, max: number) => { const n = number(value, 1, max); return Number.isInteger(n) ? n : fail('Invalid prepared count.'); };
const whole = (value: unknown, max = 100000) => { const n = number(value, 0, max); return Number.isInteger(n) ? n : fail('Invalid prepared count.'); };
const idText = (value: unknown) => { const result = text(value, 128); return /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(result) ? result : fail('Invalid prepared identifier.'); };
const coordinate = (value: unknown): Coordinate => { const p = list(value, 2); if (p.length !== 2) fail('Invalid geographic coordinate.'); return [number(p[0], -180, 180), number(p[1], -90, 90)]; };
const heading = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 360 ? value : null;
const link = (value: unknown) => { if (value == null) return null; const url = new URL(text(value)); if (url.protocol !== 'https:' || url.username || url.password) fail('Invalid source link.'); return url.href; };
const path = (value: unknown): string => { const name = text(value, 200); if (!/^(views|photos|thumbs)\/[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\.jpg$/.test(name) && !/^pieces\/[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\.bin$/.test(name)) fail('Invalid local asset path.'); return name; };
const unique = (items: { id: string }[]) => { if (new Set(items.map(item => item.id)).size !== items.length) fail('Prepared identifiers must be unique.'); };
export function isDestinationId(value: string): value is DestinationId { return Object.hasOwn(DESTINATIONS, value); }
/** Places with a published package under public/places, readable on any host. */
export const PACKAGES: Partial<Record<DestinationId, string>> = Object.fromEntries(Object.values(ROUTE_PLACES).map(place => [place.id, place.folder]));
const BASE = import.meta.env?.BASE_URL ?? '/';
const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];
export function localAsset(id: DestinationId, file: string, host = window.location): string {
  if (!isDestinationId(id) || !LOOPBACK.includes(host.hostname) || !['http:', 'https:'].includes(host.protocol)) fail('This prepared destination is local-only. Open Mercature on localhost to inspect it.');
  if (file !== 'route.json') path(file);
  return `/routes/${id}/${file}`;
}
/** Same bounded correction rule as the reference camera-pose adapter. */
export function metres(position: Coordinate, origin: Coordinate): Coordinate {
  const r = 6371008.8 * Math.PI / 180;
  return [(position[0] - origin[0]) * Math.cos(origin[1] * Math.PI / 180) * r, (position[1] - origin[1]) * r];
}
/** Shared reader for the local mercature-route/1 record and the published mercature-place/1 package. */
function parseRecord(value: unknown, expectedId: DestinationId, published: boolean): Destination {
  const root = record(value);
  if (root.schema !== (published ? 'mercature-place/1' : 'mercature-route/1') || root.id !== expectedId || root.local_only !== !published || root.synthetic !== false) fail(published ? 'This is not the expected published place.' : 'This is not the expected local-only prepared destination.');
  const route = record(root.route), frame = record(route.frame), request = record(root.request), destination = record(request.destination);
  if (frame.axes !== 'east-north-up') fail('Unsupported reconstruction coordinate frame.');
  const origin = list(frame.origin, 3); if (origin.length !== 3) fail('Missing reconstruction origin.');
  const photos = list(root.photos, 2000).map(raw => {
    const p = record(raw), id = idText(p.id), gps = coordinate(p.position);
    const computed = p.computed_position == null ? null : coordinate(p.computed_position);
    const delta = computed ? metres(computed, gps) : null;
    const corrected = !!computed && !!delta && Math.hypot(...delta) > 0 && Math.hypot(...delta) <= 10;
    const photo: Photo = { id, position: corrected ? computed! : gps, heading: corrected ? heading(p.computed_heading) ?? heading(p.heading) : heading(p.heading), capturedAt: p.captured_at == null ? null : text(p.captured_at, 40), creator: p.creator == null ? 'Mapillary contributor' : text(record(p.creator).username), licence: text(p.licence, 100), link: link(p.link), file: p.file == null ? null : path(p.file), thumb: p.thumb == null ? null : path(p.thumb) };
    if (photo.file && photo.file !== `photos/${id}.jpg` || photo.thumb && photo.thumb !== `thumbs/${id}.jpg`) fail('A photo asset does not match its source.');
    return photo;
  }); unique(photos);
  const allViews = list(root.views, 3000).map(raw => record(raw));
  const viewIds = new Set<string>();
  for (const v of allViews) { const id = idText(v.id); if (viewIds.has(id)) fail('Duplicate source view.'); viewIds.add(id); if (!photos.some(p => p.id === v.photo_id)) fail('A view has no matching source photograph.'); }
  const views: View[] = allViews.filter(v => v.file != null).map(v => {
    const id = idText(v.id), file = path(v.file);
    if (file !== `views/${id}.jpg`) fail('A retained view does not match its source.');
    return { id, photoId: text(v.photo_id), file, width: count(v.width, 20000), height: count(v.height, 20000), heading: v.cut == null ? null : heading(record(v.cut).yaw_deg) };
  });
  const pieces: Piece[] = published ? [] : list(root.spots, 200).filter(raw => record(raw).state === 'joined').map(raw => {
    const spot = record(raw), piece = record(spot.piece), id = idText(spot.id), file = path(piece.file);
    if (file !== `pieces/${id}.bin`) fail('A reconstruction file does not match its capture area.');
    const views = list(spot.views, 200).map(idText); if (views.some(v => !viewIds.has(v))) fail('A reconstruction links an unknown source view.');
    return { id, file, points: count(piece.points, 500000), bytes: count(piece.bytes, 12000000), views, center: coordinate(spot.center), model: text(piece.model, 100), residual: number(piece.residual_rms_m, 0) };
  }); unique(pieces);
  let totalCoordinates = 0;
  function mapFeatures(input: unknown, polygon: boolean): MapFeature[] {
    return list(record(input).features, 4000).map((raw, i) => {
      const feature = record(raw), geometry = record(feature.geometry), props = record(feature.properties);
      if (polygon ? geometry.type !== 'Polygon' : !['Polygon', 'LineString', 'MultiLineString'].includes(String(geometry.type))) fail('Unsupported prepared map geometry.');
      const lines = geometry.type === 'LineString' ? [geometry.coordinates] : list(geometry.coordinates, 100);
      const parsed = lines.map(rawLine => {
        const points = list(rawLine, 20000).map(coordinate); totalCoordinates += points.length;
        if (totalCoordinates > 150000) fail('Prepared map exceeds the coordinate budget.');
        return points;
      });
      const base = { name: typeof props.name === 'string' ? text(props.name) : '', kind: typeof props.highway === 'string' ? text(props.highway) : '' };
      if (polygon) return [{ ...base, id: String(i), points: parsed[0] ?? [], holes: parsed.slice(1) }];
      return parsed.map((points, j) => ({ ...base, id: `${i}:${j}`, points, holes: [] }));
    }).flat();
  }
  const context = record(root.map_context);
  // A package ships only the views behind flagged stretches; findings on other views stay in the local record.
  // OpenStreetMap tag findings have no view and are kept with their tags.
  const findings: Finding[] = list(root.findings, 3000).filter(raw => { const f = record(raw); return f.view_id == null ? f.osm != null : !published || viewIds.has(String(f.view_id)); }).map(raw => {
    const f = record(raw), common = { id: idText(f.id), label: text(f.label), concept: typeof f.concept === 'string' ? text(f.concept, 100) : '', score: typeof f.score === 'number' ? number(f.score, 0, 1) : null, verified: f.verified === true, barrier: f.barrier === true, position: f.position == null ? null : coordinate(f.position), stretches: list(f.stretches ?? [], 200).map(index => whole(index, 1999)) };
    if (f.view_id == null) {
      const tags = record(record(f.osm).tags);
      return { ...common, viewId: null, photoId: null, outline: [], osm: Object.fromEntries(Object.entries(tags).filter(([, value]) => typeof value === 'string').map(([key, value]) => [text(key, 100), text(value, 200)])) };
    }
    const viewId = text(f.view_id), source = allViews.find(view => view.id === viewId);
    if (!source) throw new Error('Finding references an unknown source.');
    if (f.photo_id !== source.photo_id) fail('Finding photograph does not match its source view.');
    const width = count(source.width, 20000), height = count(source.height, 20000);
    return { ...common, viewId, photoId: text(f.photo_id), osm: null, outline: f.outline == null ? [] : list(f.outline, 20000).map(raw => { const p = list(raw, 2); if (p.length !== 2) fail('Invalid outline.'); return [number(p[0], 0, width), number(p[1], 0, height)] as Coordinate; }) };
  });
  const findingIds = new Set(findings.map(finding => finding.id));
  const statuses = { clear: 'clear', barrier: 'barrier', no_photos: 'no-photos' } as const;
  const stretches: Stretch[] = list(root.stretches ?? [], 2000).map((raw, index) => {
    const s = record(raw), key = String(s.status), status = Object.hasOwn(statuses, key) ? statuses[key as keyof typeof statuses] : fail('Unknown stretch status.');
    if (s.index !== index) fail('Stretches are out of order.');
    return { index, from: number(s.from_m, 0, 1e5), to: number(s.to_m, 0, 1e5), status, line: list(s.line, 2000).map(coordinate), findings: list(s.findings ?? [], 200).map(idText).filter(id => findingIds.has(id)), views: list(s.views ?? [], 400).map(idText).filter(id => views.some(view => view.id === id)) };
  });
  const inWalk = (indexes: number[]) => indexes.every(index => index < stretches.length) ? indexes : fail('A record names a stretch the walk does not have.');
  // Every finding with its place on the walk, its photo shipped or not.
  const walkFindings: WalkFinding[] = list(root.findings, 3000).map(raw => {
    const f = record(raw);
    return { id: idText(f.id), concept: typeof f.concept === 'string' ? text(f.concept, 100) : '', label: text(f.label), barrier: f.barrier === true, position: f.position == null ? null : coordinate(f.position), stretches: inWalk(list(f.stretches ?? [], 200).map(index => whole(index, 1999))) };
  });
  // A published package's SAM 3 marks: every mark on a shipped view, outlined, and every mark near the route, placed.
  const scanRoot = root.scan == null ? null : record(root.scan), walkIds = new Set(walkFindings.map(finding => finding.id));
  const marks: ScanMark[] = scanRoot ? list(scanRoot.marks, 5000).map(raw => {
    const m = record(raw), viewId = idText(m.view_id), photoId = idText(m.photo_id), source = allViews.find(view => view.id === viewId);
    if (!photos.some(photo => photo.id === photoId) || (source && source.photo_id !== photoId)) fail('A mark does not match its photograph.');
    const finding = m.finding == null ? null : idText(m.finding);
    if (finding && !walkIds.has(finding)) fail('A mark names an unknown finding.');
    const bounds = source ? [count(source.width, 20000), count(source.height, 20000)] : null;
    const outline = m.outline == null ? [] : list(m.outline, 2000).map(rawPoint => { const p = list(rawPoint, 2), [width, height] = bounds ?? fail('A mark outline needs its view.'); if (p.length !== 2) fail('Invalid outline.'); return [number(p[0], 0, width), number(p[1], 0, height)] as Coordinate; });
    return { id: idText(m.id), viewId, photoId, concept: text(m.concept, 100), label: text(m.label, 200), score: number(m.score, 0, 1), barrier: m.barrier === true, flagged: m.flagged === true, finding, outline, position: m.position == null ? null : coordinate(m.position), stretches: inWalk(list(m.stretches ?? [], 200).map(index => whole(index, 1999))) };
  }) : [];
  unique(marks);
  const scan: Scan | null = scanRoot && {
    views: whole(scanRoot.views), nearMetres: number(scanRoot.near_m, 0, 1000),
    kinds: list(scanRoot.kinds, 100).map(raw => { const k = record(raw); return { concept: text(k.concept, 100), label: text(k.label, 200), barrier: k.barrier === true, surface: k.surface === true, marks: whole(k.marks), views: whole(k.views), nearRoute: whole(k.near_route) }; }),
    leftOut: list(scanRoot.left_out ?? [], 100).map(raw => { const k = record(raw); return { concept: text(k.concept, 100), label: text(k.label, 200), marks: whole(k.marks), views: whole(k.views), reason: text(k.reason) }; }),
  };
  const line = list(route.line, 20000).map(coordinate);
  const start = request.start == null ? null : record(request.start);
  const walked = line.slice(1).reduce((sum, point, i) => sum + Math.hypot(...metres(point, line[i])), 0);
  return { id: expectedId, title: text(root.title), place: text(root.place), localOnly: !published, assets: published ? `${BASE}places/${PACKAGES[expectedId] ?? fail('No published package for this place.')}/` : `/routes/${expectedId}/`, origin: [number(origin[0], -180, 180), number(origin[1], -90, 90), number(origin[2])], line, lengthMetres: route.length_m == null ? walked : number(route.length_m, 0, 100000), start: start && { name: text(start.name), position: coordinate(start.position) }, target: { name: text(destination.name), position: coordinate(destination.position) }, photos, views, stretches, pieces, findings, walkFindings, marks, scan, wayAround: root.way_around == null ? null : readWayAround(root.way_around), buildings: mapFeatures(context.buildings, true), ways: mapFeatures(context.ways, false), sources: list(root.sources, 30).map(raw => { const source = record(raw); return { name: text(source.name), credit: text(source.credit), licence: text(source.licence), link: link(source.link) }; }) };
}
export function parseDestination(value: unknown, expectedId: DestinationId): Destination { return parseRecord(value, expectedId, false); }
export function parsePlace(value: unknown, expectedId: DestinationId): Destination { return parseRecord(value, expectedId, true); }
/** The URL of one of this record's own images. */
export function assetUrl(data: Destination, file: string): string { return data.assets + path(file); }
export async function fetchLocal(id: DestinationId, file: string, limit: number, signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(localAsset(id, file), { signal, redirect: 'error', cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok || /text\/html/i.test(response.headers.get('content-type') ?? '')) fail('The prepared files are not available on this device.');
  if (Number(response.headers.get('content-length')) > limit) fail('Prepared file exceeds the size limit.');
  const body = response.body;
  if (!body) throw new Error('The prepared file could not be read.');
  const reader = body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > limit) fail('Prepared file exceeds the size limit.'); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; } return bytes.buffer;
}
const decode = (bytes: ArrayBuffer): unknown => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
async function loadLocal(id: DestinationId, signal?: AbortSignal): Promise<Destination> {
  return parseDestination(decode(await fetchLocal(id, 'route.json', 8000000, signal)), id);
}
async function loadPlace(id: DestinationId, signal?: AbortSignal): Promise<Destination> {
  const response = await fetch(`${BASE}places/${PACKAGES[id] ?? fail('No published package for this place.')}/place.json`, { signal, redirect: 'error', credentials: 'same-origin' });
  if (!response.ok || !/json/i.test(response.headers.get('content-type') ?? '')) fail('The published place is not available.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 8000000) fail('The published place exceeds the size limit.');
  return parsePlace(decode(bytes), id);
}
/**
 * The published package when one exists, which works on any host and offline once cached.
 * On this device's loopback address the retained local record also supplies its point pieces;
 * without a package, only the local record can open the place.
 */
export async function loadDestination(id: DestinationId, signal?: AbortSignal): Promise<Destination> {
  if (PACKAGES[id]) {
    const place = await loadPlace(id, signal).catch(error => { if (signal?.aborted) throw error; return null; });
    if (place) {
      if (!LOOPBACK.includes(location.hostname)) return place;
      const local = await loadLocal(id, signal).catch(() => null);
      return local ? { ...place, pieces: local.pieces } : place;
    }
  }
  return loadLocal(id, signal);
}
/** MRP1 layout adapted from the reference route/piece.ts decoder. */
export function decodeCloud(data: ArrayBuffer, expected: Piece): Cloud {
  const bytes = new Uint8Array(data), view = new DataView(data);
  if (data.byteLength < 8 || new TextDecoder().decode(bytes.subarray(0, 4)) !== 'MRP1') fail('Unrecognized reconstruction format.');
  const size = view.getUint32(4, true);
  if (size > 100000 || size % 4 || size + 8 > bytes.length) fail('Incomplete reconstruction header.');
  const header = record(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(8, 8 + size))));
  const n = count(header.points, 500000), views = list(header.views, 200).map(idText);
  if (header.spot !== expected.id || n !== expected.points || bytes.length !== expected.bytes || bytes.length !== 8 + size + 21 * n || !views.length || new Set(views).size !== views.length || views.some(id => !expected.views.includes(id))) fail('The reconstruction does not match its source record.');
  const at = 8 + size, positions = new Float32Array(n * 3), indexes = new Uint16Array(n);
  for (let i = 0; i < positions.length; i++) positions[i] = number(view.getFloat32(at + i * 4, true), -1e7, 1e7);
  for (let i = 0; i < n; i++) { indexes[i] = view.getUint16(at + n * 12 + i * 2, true); if (indexes[i] >= views.length) fail('A reconstructed point has an unknown source view.'); }
  return { spot: expected.id, points: n, positions, colours: bytes.slice(at + n * 18), views, view: indexes };
}

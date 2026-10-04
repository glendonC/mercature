/**
 * A walk built on this device from OpenStreetMap alone: the route on foot, cut into 10 m stretches, the tags along it as findings,
 * and spots for the model from groups of flagged stretches, the streets it follows and the buildings beside it.
 * It has the shape of a published place (mercature-place/1) with no photos, views or scan: nothing here was seen in a street photo,
 * so every stretch without a flagged tag says "no photos", and nothing states a width, height or slope.
 */
import { along, distance, project, slice, toLine, type LonLat } from './geo.ts';
import type { Street, Walked } from './services.ts';
import { accessKinds, type AccessFinding } from '../osm/access.ts';
import { esDe, esPlace } from '../i18n/names.ts';
import type { RoutePlace, RouteSpot } from '../site/route.ts';
import type { Coordinate, Destination, DestinationId, Finding, MapFeature, Stretch } from '../destinations/data.ts';

/** One tag on or beside the walk, as src/osm/access.ts places it on the stretches. */
export type TagFinding = Pick<AccessFinding, 'id' | 'kind' | 'value' | 'concept' | 'label' | 'barrier' | 'osm' | 'position' | 'stretches'>;
type Geometry = { type: string; coordinates: unknown };
export type Feature = { type: 'Feature'; geometry: Geometry; properties: Record<string, unknown> };
export type MapContext = { buildings: { type: 'FeatureCollection'; features: Feature[] }; ways: { type: 'FeatureCollection'; features: Feature[] } };
export type End = { name: string; position: LonLat; osm?: { type: string; id: number } | null };

export const STRETCH_METRES = 10;
const ROUGH = new Set(['bad', 'very_bad', 'horrible', 'very_horrible', 'impassable']);

/**
 * A tag that may be a barrier on foot or on wheels. OpenStreetMap is the only evidence on a walk with no street photos,
 * so besides steps it flags a raised kerb, a way marked not for wheelchairs, a gate, bollards and a rough surface.
 */
export function possibleBarrier(finding: { kind: string; value: string; barrier: boolean }): boolean {
  return finding.barrier || finding.kind === 'steps' || (finding.kind === 'kerb' && finding.value === 'raised') || (finding.kind === 'wheelchair' && finding.value === 'no')
    || finding.kind === 'gate' || finding.kind === 'bollard' || (finding.kind === 'smoothness' && ROUGH.has(finding.value));
}

/** The walk cut into stretches of 10 m from its start; the last one ends where the walk does. */
export function cut(line: readonly LonLat[]): { index: number; from: number; to: number; line: LonLat[] }[] {
  const at = along(line), total = at[at.length - 1], pieces = [];
  for (let index = 0, from = 0; from < total - 0.05; index++, from += STRETCH_METRES) {
    const to = Math.min(total, from + STRETCH_METRES);
    pieces.push({ index, from: round(from), to: round(to), line: slice(line, at, from, to).map(fix) });
  }
  return pieces;
}

const round = (n: number) => Math.round(n * 10) / 10;
const fix = (p: LonLat): LonLat => [Math.round(p[0] * 1e7) / 1e7, Math.round(p[1] * 1e7) / 1e7];
const fold = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '');
export const slug = (text: string) => fold(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
/** A short stable hash, so the same two ends give the same id. */
function hash(text: string) { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

export function walkId(start: End, target: End): string {
  const key = [start.position, target.position].map(p => p.map(n => n.toFixed(5)).join(',')).join(';');
  return `walk-${slug(target.name) || 'place'}-${hash(key)}`;
}

/** Words for each kind of flagged spot: its name in English and Spanish, and what visitors may call it. */
const KINDS: Record<string, { en: string; es: string; aliases: Record<string, string[]> }> = {
  steps: { en: 'Steps', es: 'Escalones', aliases: { en: ['steps', 'stairs', 'staircase'], es: ['escalones', 'escaleras', 'gradas'], ko: ['계단'] } },
  kerb: { en: 'Raised kerb', es: 'Bordillo alto', aliases: { en: ['kerb', 'curb', 'high curb', 'no ramp'], es: ['bordillo', 'sardinel', 'vereda alta', 'sin rampa'], ko: ['연석', '턱'] } },
  gate: { en: 'Gate', es: 'Portón', aliases: { en: ['gate', 'closed gate', 'fence'], es: ['portón', 'reja', 'puerta'], ko: ['문'] } },
  bollard: { en: 'Bollards', es: 'Bolardos', aliases: { en: ['bollard', 'posts', 'barrier'], es: ['bolardo', 'postes', 'barrera'], ko: ['볼라드', '기둥'] } },
  wheelchair: { en: 'Marked not for wheelchairs', es: 'Marcado como no apto para silla de ruedas', aliases: { en: ['wheelchair', 'not accessible', 'no wheelchair access'], es: ['silla de ruedas', 'no accesible'], ko: ['휠체어'] } },
  smoothness: { en: 'Rough surface', es: 'Superficie irregular', aliases: { en: ['rough surface', 'uneven ground', 'broken pavement', 'potholes'], es: ['superficie irregular', 'piso irregular', 'vereda rota', 'baches'], ko: ['울퉁불퉁한 길'] } },
};
const ORDER = ['steps', 'kerb', 'gate', 'bollard', 'wheelchair', 'smoothness'];

/** The end, street or building a run of stretches is at, on or near, for its name. */
function placeOf(middle: number, at: LonLat, ends: { start: End; target: End; length: number }, streets: readonly Street[], ways: readonly MapFeature[], buildings: readonly MapFeature[]): { en: string; es: string; landmark: string } {
  if (middle <= 40 && ends.start.name) return { en: `near ${ends.start.name}`, es: `cerca ${esDe(esPlace(ends.start.name))}`, landmark: ends.start.name };
  if (middle >= ends.length - 40 && ends.target.name) return { en: `near ${ends.target.name}`, es: `cerca ${esDe(esPlace(ends.target.name))}`, landmark: ends.target.name };
  const street = streets.find(s => s.from <= middle && middle <= s.to)?.name
    ?? ways.filter(w => w.name).map(w => ({ name: w.name, d: toLine(at, w.points) })).filter(w => w.d <= 6).sort((a, b) => a.d - b.d)[0]?.name;
  if (street) return { en: `on ${street}`, es: `en ${esPlace(street)}`, landmark: street };
  const building = buildings.filter(b => b.name).map(b => ({ name: b.name, d: toLine(at, b.points) })).filter(b => b.d <= 30).sort((a, b) => a.d - b.d)[0]?.name;
  if (building) return { en: `near ${building}`, es: `cerca ${esDe(esPlace(building))}`, landmark: building };
  const way = ways.filter(w => w.name).map(w => ({ name: w.name, d: toLine(at, w.points) })).filter(w => w.d <= 30).sort((a, b) => a.d - b.d)[0]?.name;
  if (way) return { en: `near ${way}`, es: `cerca ${esDe(esPlace(way))}`, landmark: way };
  return { en: 'on the walk', es: 'en el recorrido', landmark: '' };
}

/** The place's map features, read like data.ts reads a package's map_context. */
export function features(collection: MapContext['buildings'], polygon: boolean): MapFeature[] {
  return collection.features.flatMap((feature, i) => {
    const props = feature.properties ?? {}, coords = feature.geometry?.coordinates as Coordinate[][] | Coordinate[] | undefined;
    if (!coords) return [];
    const base = { name: typeof props.name === 'string' ? props.name : '', kind: typeof props.highway === 'string' ? props.highway : '' };
    if (polygon) { if (feature.geometry.type !== 'Polygon') return []; const rings = coords as Coordinate[][]; return [{ ...base, id: String(i), points: rings[0] ?? [], holes: rings.slice(1) }]; }
    const lines = feature.geometry.type === 'LineString' ? [coords as Coordinate[]] : feature.geometry.type === 'MultiLineString' || feature.geometry.type === 'Polygon' ? coords as Coordinate[][] : [];
    return lines.map((points, j) => ({ ...base, id: `${i}:${j}`, points, holes: [] }));
  });
}

export type PlacePackage = ReturnType<typeof buildPlace>['place'];
export type Built = { place: PlacePackage; spots: RoutePlace };

/** The package and its spots for a walk between two ends, from the walk on foot, the tags along it and the map around it. */
export function buildPlace(input: { start: End; target: End; area: string; walked: Walked; findings: readonly TagFinding[]; context: MapContext; fetchedAt: string; aroundMetres: number; nearMetres: number }) {
  const { start, target, walked, context } = input;
  const id = walkId(start, target);
  const stretches = cut(walked.line);
  const findings = input.findings.filter(f => f.stretches.length && f.stretches.every(i => i < stretches.length)).map(f => ({ ...f, barrier: possibleBarrier(f) }));
  const on = (index: number) => findings.filter(f => f.stretches.includes(index));
  const ways = features(context.ways, false), buildings = features(context.buildings, true);
  const origin = walked.line[0];
  const packageStretches = stretches.map(s => {
    const here = on(s.index);
    return { index: s.index, from_m: s.from, to_m: s.to, status: here.some(f => f.barrier) ? 'barrier' : 'no_photos', line: s.line, findings: here.map(f => f.id), views: [] as string[] };
  });

  // Flagged spots group stretches as the map does: neighbours that share a possible barrier.
  const runs: { stretches: number[]; findings: string[] }[] = [];
  for (const s of packageStretches) {
    if (s.status !== 'barrier') continue;
    const flagged = on(s.index).filter(f => f.barrier).map(f => f.id), last = runs[runs.length - 1];
    if (last && last.stretches[last.stretches.length - 1] === s.index - 1 && flagged.some(f => last.findings.includes(f))) {
      last.stretches.push(s.index);
      for (const f of flagged) if (!last.findings.includes(f)) last.findings.push(f);
    } else runs.push({ stretches: [s.index], findings: flagged });
  }
  const used = new Set<string>();
  const unique = (base: string) => { let key = base || 'spot', n = 2; while (used.has(key)) key = `${base}-${n++}`; used.add(key); return key; };
  const line = walked.line, at = along(line);
  const spots: RouteSpot[] = runs.map(run => {
    const first = stretches[run.stretches[0]], last = stretches[run.stretches[run.stretches.length - 1]];
    const these = run.findings.map(fid => findings.find(f => f.id === fid)!).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
    const kind = KINDS[these[0]?.kind] ?? KINDS.steps, middle = (first.from + last.to) / 2;
    const where = placeOf(middle, line[Math.min(line.length - 1, at.findIndex(m => m >= middle))] ?? line[0], { start, target, length: at[at.length - 1] }, walked.streets, ways, buildings);
    const from = Math.round(first.from), to = Math.round(last.to);
    const said = [...new Set(these.map(f => f.label))].join('; ');
    return {
      id: unique(`${these[0]?.kind ?? 'flag'}-${from}-${to}`), stretches: run.stretches, landmark: where.landmark || start.name,
      name: { en: `${kind.en} ${where.en} (${from} to ${to} m)`, es: `${kind.es} ${where.es} (${from} a ${to} m)` },
      description: `${kind.en} ${where.en}, from OpenStreetMap tags that nobody has verified (${said}); no street photos were read here.`,
      aliases: { ...kind.aliases, en: [...kind.aliases.en, ...(where.landmark ? [where.landmark] : [])], es: [...kind.aliases.es, ...(where.landmark ? [where.landmark] : [])] },
    };
  });

  // Landmarks: both ends, the streets the walk follows longest, and the named buildings beside it.
  const landmark = (name: string, description: string, aliases: Record<string, string[]>): RouteSpot => ({ id: unique(slug(name)), stretches: [], landmark: name, name: { en: name, es: name }, description, aliases });
  if (start.name) spots.push(landmark(start.name, `${start.name}, where this walk starts.`, { en: ['start', 'starting point', 'beginning', start.name], es: ['inicio', 'salida', 'punto de partida', start.name], ko: ['출발점'] }));
  if (target.name && target.name !== start.name) spots.push(landmark(target.name, `${target.name}, where this walk ends.`, { en: ['end of the walk', 'destination', 'arrival', 'entrance', target.name], es: ['llegada', 'destino', 'entrada', target.name], ko: ['도착지', '입구'] }));
  const wayNames = new Set(ways.map(w => w.name).filter(Boolean));
  const followed = new Map<string, number>();
  for (const s of walked.streets) if (wayNames.has(s.name)) followed.set(s.name, (followed.get(s.name) ?? 0) + s.to - s.from);
  for (const [name] of [...followed].filter(([, metres]) => metres >= 40).sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    if (!spots.some(s => s.landmark === name && !s.stretches.length)) spots.push(landmark(name, `${name}, a street this walk follows.`, { en: ['street', name], es: ['calle', name] }));
  }
  const beside = buildings.filter(b => b.name && b.points.length > 2).map(b => ({ name: b.name, d: Math.min(...b.points.map(p => toLine(p, line))) }))
    .filter(b => b.d <= 25).sort((a, b) => a.d - b.d);
  for (const b of beside) {
    if (spots.filter(s => !s.stretches.length).length >= 14) break;
    if (!spots.some(s => s.landmark === b.name)) spots.push(landmark(b.name, `${b.name}, beside the walk.`, { en: [b.name], es: [b.name] }));
  }

  const flaggedCount = packageStretches.filter(s => s.status === 'barrier').length, length = round(at[at.length - 1]);
  const place = {
    schema: 'mercature-place/1' as const, id, title: `${start.name} to ${target.name}`, place: input.area, synthetic: false, local_only: false,
    /** Built on this device from OpenStreetMap; no street photos were read. */
    built: { on: 'device', from: 'openstreetmap', at: input.fetchedAt },
    attribution: {
      map: '© OpenStreetMap contributors, under the Open Database License 1.0 (https://www.openstreetmap.org/copyright).',
      route: 'Walk on foot from Valhalla on the FOSSGIS server, on OpenStreetMap data.',
      findings: 'Findings are OpenStreetMap tags that nobody has verified on site. This walk has no street photos, so every stretch says no photos.',
    },
    sources: [
      { id: 'openstreetmap', name: 'OpenStreetMap', role: 'Map, places and tags', credit: '© OpenStreetMap contributors', licence: 'ODbL 1.0', licence_url: 'https://opendatacommons.org/licenses/odbl/1-0/', link: 'https://www.openstreetmap.org/copyright' },
      { id: 'valhalla', name: 'Valhalla (FOSSGIS)', role: 'Walk on foot', credit: 'Routing by Valhalla on the FOSSGIS server', licence: 'ODbL 1.0 data', licence_url: 'https://opendatacommons.org/licenses/odbl/1-0/', link: 'https://valhalla1.openstreetmap.de' },
    ],
    request: { start: { name: start.name, position: fix(start.position) }, destination: { name: target.name, position: fix(target.position), osm: target.osm ?? null } },
    route: { kind: 'route', provider: 'valhalla', fetched_at: walked.fetchedAt, frame: { axes: 'east-north-up', origin: [origin[0], origin[1], 0] as [number, number, number] }, length_m: length, line: line.map(fix) },
    summary: { length_m: length, stretches: stretches.length, barriers: flaggedCount, seen: 0, no_photos_m: length, not_checked: 0, line: `${Math.round(length)} m on foot, from the map. OpenStreetMap tags flag possible barriers on ${flaggedCount} of ${stretches.length} stretches.` },
    stretches: packageStretches,
    findings: findings.map(f => ({ id: f.id, label: f.label, concept: f.concept || f.kind, barrier: f.barrier, score: null, verified: false, source: 'openstreetmap', model: null, note: null, photo_id: null, view_id: null, stretches: [...f.stretches], position: f.position && fix([f.position[0], f.position[1]]), box: null, outline: null, osm: { type: f.osm.type, id: f.osm.id, tags: { ...f.osm.tags } } })),
    views: [] as never[], photos: [] as never[],
    map_context: context,
    route_spots: spots.map(s => ({ id: s.id, stretches: [...s.stretches], landmark: s.landmark })),
    osm: { fetched_at: input.fetchedAt, around_m: input.aroundMetres, near_m: input.nearMetres, kinds: accessKinds(input.findings as readonly AccessFinding[]), findings: input.findings },
  };
  return { place, spots: { id, folder: '', features: spots } as RoutePlace };
}


/** The place the route screen shows, from a built package. A built walk has no package folder, photos or views. */
export function toDestination(place: PlacePackage): Destination {
  const findings: Finding[] = place.findings.map(f => ({ id: f.id, viewId: null, photoId: null, label: f.label, concept: f.concept, score: null, outline: [], verified: false, barrier: f.barrier, osm: f.osm.tags, position: f.position, stretches: f.stretches }));
  const stretches: Stretch[] = place.stretches.map(s => ({ index: s.index, from: s.from_m, to: s.to_m, status: s.status === 'barrier' ? 'barrier' : 'no-photos', line: s.line, findings: s.findings, views: [] }));
  return {
    // A built walk is not one of the registered destinations; its id only keys what this device keeps for it.
    id: place.id as DestinationId, title: place.title, place: place.place, localOnly: false, assets: '', origin: place.route.frame.origin,
    line: place.route.line, lengthMetres: place.route.length_m, start: place.request.start, target: { name: place.request.destination.name, position: place.request.destination.position },
    photos: [], views: [], stretches, pieces: [], findings, walkFindings: findings.map(f => ({ id: f.id, concept: f.concept, label: f.label, barrier: f.barrier, position: f.position, stretches: f.stretches })),
    marks: [], scan: null, buildings: features(place.map_context.buildings, true), ways: features(place.map_context.ways, false),
    // Every kind OpenStreetMap lists along the walk, with its own flags, for the guide's walk check.
    access: [...place.osm.findings],
    sources: place.sources.map(s => ({ name: s.name, credit: s.credit, licence: s.licence, link: s.link })),
  };
}

/** Where a point lies along the walk, for placing what a search found near it. */
export function metresAlong(point: LonLat, line: readonly LonLat[]): { metres: number; away: number } {
  return project(point, line, along(line));
}
export { distance };

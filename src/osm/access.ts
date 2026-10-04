/**
 * What OpenStreetMap says about getting along a tour route: steps, handrails, ramps, surfaces, kerbs, crossings, gates,
 * bollards, benches, toilets, lighting and wheelchair tags, placed on the route's 10 m stretches.
 * Pure and browser-safe: an Overpass JSON answer goes in, findings come out, in a browser for a new route or in Node
 * when a place is packaged. Every finding is OpenStreetMap's claim, never checked here. Widths and inclines are never
 * read, so no finding states a width, height or slope.
 */

export type LonLat = readonly [number, number];
/** One element of an Overpass answer asked with "out geom": nodes carry lat and lon, ways their geometry. */
export type OsmElement = {
  readonly type: 'node' | 'way' | 'relation';
  readonly id: number;
  readonly tags?: Readonly<Record<string, string>>;
  readonly lat?: number;
  readonly lon?: number;
  readonly geometry?: readonly ({ readonly lat: number; readonly lon: number } | null)[];
};
export type AccessKind = 'steps' | 'handrail' | 'ramp' | 'surface' | 'smoothness' | 'kerb' | 'tactile_paving' | 'crossing' | 'gate' | 'bollard' | 'bench' | 'toilets' | 'lit' | 'wheelchair';
/**
 * One thing OpenStreetMap says, on the stretches it applies to. concept is the tag it comes from, as the place records
 * write it ("handrail=no"); value is the kind's own value ("no", "40" steps, "sett"). Only steps are a possible barrier,
 * as the place records already treat them. A way has no position; a node has its point.
 */
export type AccessFinding = {
  readonly id: string;
  readonly kind: AccessKind;
  readonly value: string;
  readonly concept: string;
  readonly label: string;
  readonly barrier: boolean;
  readonly source: 'openstreetmap';
  readonly osm: { readonly type: 'node' | 'way'; readonly id: number; readonly tags: Readonly<Record<string, string>> };
  readonly position: LonLat | null;
  readonly stretches: readonly number[];
};
export type StretchLine = { readonly index: number; readonly line: readonly LonLat[] };
export type AccessOptions = {
  /** How close a way or a node on the route must be, in metres. */
  readonly nearMetres?: number;
  /** How close a bench or toilets must be, in metres. */
  readonly amenityMetres?: number;
};
/** The kinds in the order a person would go through them, with a short name for each. */
export const ACCESS_KINDS: readonly { readonly kind: AccessKind; readonly label: string }[] = [
  { kind: 'steps', label: 'Steps' },
  { kind: 'handrail', label: 'Handrail' },
  { kind: 'ramp', label: 'Ramp' },
  { kind: 'kerb', label: 'Kerb' },
  { kind: 'surface', label: 'Surface' },
  { kind: 'smoothness', label: 'Smoothness' },
  { kind: 'crossing', label: 'Crossing' },
  { kind: 'tactile_paving', label: 'Tactile paving' },
  { kind: 'gate', label: 'Gate' },
  { kind: 'bollard', label: 'Bollard' },
  { kind: 'bench', label: 'Bench' },
  { kind: 'toilets', label: 'Toilets' },
  { kind: 'lit', label: 'Lighting' },
  { kind: 'wheelchair', label: 'Wheelchair tag' },
];

/** Only these tags are read and kept, so a width or incline in the source never reaches a finding. */
const KEPT = ['name', 'highway', 'footway', 'step_count', 'handrail', 'handrail:left', 'handrail:right', 'handrail:center', 'ramp', 'ramp:wheelchair', 'ramp:stroller',
  'surface', 'smoothness', 'kerb', 'tactile_paving', 'crossing', 'crossing:markings', 'barrier', 'amenity', 'backrest', 'lit', 'wheelchair', 'toilets:wheelchair'];
const ROUGH_SURFACES: Readonly<Record<string, string>> = {
  sett: 'stone setts', cobblestone: 'cobblestones', unhewn_cobblestone: 'rough cobblestones', pebblestone: 'pebbles', gravel: 'gravel', fine_gravel: 'fine gravel',
  ground: 'bare ground', dirt: 'dirt', earth: 'dirt', grass: 'grass', sand: 'sand', mud: 'mud', rock: 'rock', woodchips: 'wood chips',
};
const SMOOTHNESS: Readonly<Record<string, string>> = { excellent: 'smooth surface', good: 'smooth surface', bad: 'rough surface', very_bad: 'very rough surface', horrible: 'very rough surface', very_horrible: 'very rough surface', impassable: 'very rough surface' };
const KERBS: Readonly<Record<string, string>> = { raised: 'raised kerb', lowered: 'lowered kerb', flush: 'flush kerb', rolled: 'rolled kerb', no: 'no kerb' };
const WHEELCHAIR: Readonly<Record<string, string>> = { no: 'not wheelchair accessible', limited: 'limited wheelchair access', yes: 'wheelchair accessible' };
const WAY_KINDS = new Set<AccessKind>(['steps', 'handrail', 'ramp', 'surface', 'smoothness', 'lit', 'wheelchair', 'crossing', 'kerb', 'tactile_paving']);

/**
 * The Overpass query for one route: the paths, streets and buildings around it for the map, and the nodes that carry
 * what a visitor meets on the way. line is [lon, lat] points; one request answers both.
 */
export function accessQuery(line: readonly LonLat[], aroundMetres = 15, contextMetres = 40): string {
  const along = (metres: number) => `around:${metres},${line.map(([lon, lat]) => `${lat.toFixed(7)},${lon.toFixed(7)}`).join(',')}`;
  const near = along(aroundMetres), context = along(contextMetres);
  return `[out:json][timeout:60];(way(${context})[highway];way(${context})[building];node(${near})[barrier];node(${near})[kerb];node(${near})[highway=crossing];` +
    `node(${near})[tactile_paving];node(${near})[amenity~"^(bench|toilets)$"];node(${near})[wheelchair];node(${near})[entrance];);out geom;`;
}

const kept = (tags: Readonly<Record<string, string>>) => Object.fromEntries(Object.entries(tags).filter(([key]) => KEPT.includes(key)).sort(([a], [b]) => a < b ? -1 : 1));
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** What one element says, before placement. A way says what its tags say along it; a node, what stands at its point. */
function said(element: OsmElement): { kind: AccessKind; value: string; concept: string; label: string; barrier: boolean }[] {
  const tags = element.tags ?? {}, out: { kind: AccessKind; value: string; concept: string; label: string; barrier: boolean }[] = [];
  const add = (kind: AccessKind, value: string, concept: string, label: string, barrier = false) => out.push({ kind, value, concept, label: `OpenStreetMap says: ${label}`, barrier });
  const way = element.type === 'way';
  if (way && !tags.highway) return out;
  if (tags.highway === 'steps') add('steps', /^\d+$/.test(tags.step_count ?? '') ? tags.step_count : '', 'highway=steps', /^\d+$/.test(tags.step_count ?? '') ? `${tags.step_count} steps` : 'steps', true);
  const rail = ['handrail', 'handrail:left', 'handrail:right', 'handrail:center'].map(key => tags[key]).filter(Boolean);
  if (rail.some(value => value !== 'no')) add('handrail', 'yes', `handrail=${tags.handrail ?? 'yes'}`, 'handrail');
  else if (rail.length) add('handrail', 'no', 'handrail=no', 'no handrail');
  const ramp = ['ramp', 'ramp:wheelchair', 'ramp:stroller'].map(key => tags[key]).filter(Boolean);
  if (ramp.some(value => value === 'yes')) add('ramp', 'yes', 'ramp=yes', 'ramp');
  else if (ramp.includes('no')) add('ramp', 'no', 'ramp=no', 'no ramp');
  if (tags.surface && ROUGH_SURFACES[tags.surface]) add('surface', tags.surface, `surface=${tags.surface}`, ROUGH_SURFACES[tags.surface]);
  if (tags.smoothness && SMOOTHNESS[tags.smoothness]) add('smoothness', tags.smoothness, `smoothness=${tags.smoothness}`, SMOOTHNESS[tags.smoothness]);
  if (tags.kerb && KERBS[tags.kerb]) add('kerb', tags.kerb, `kerb=${tags.kerb}`, KERBS[tags.kerb]);
  if (tags.tactile_paving === 'yes' || tags.tactile_paving === 'no') add('tactile_paving', tags.tactile_paving, `tactile_paving=${tags.tactile_paving}`, tags.tactile_paving === 'yes' ? 'tactile paving' : 'no tactile paving');
  if (tags.highway === 'crossing' || tags.footway === 'crossing') {
    const kind = tags.crossing ?? tags['crossing:markings'] ?? '';
    add('crossing', kind, tags.highway === 'crossing' ? 'highway=crossing' : 'footway=crossing', kind === 'traffic_signals' ? 'pedestrian crossing with signals' : 'pedestrian crossing');
  }
  if (!way && tags.barrier === 'gate') add('gate', 'gate', 'barrier=gate', 'gate');
  if (!way && tags.barrier === 'bollard') add('bollard', 'bollard', 'barrier=bollard', 'bollard');
  if (!way && tags.amenity === 'bench') add('bench', tags.backrest === 'yes' ? 'backrest' : '', 'amenity=bench', tags.backrest === 'yes' ? 'bench with a backrest' : 'bench');
  if (!way && tags.amenity === 'toilets') add('toilets', tags['toilets:wheelchair'] ?? '', 'amenity=toilets', 'toilets');
  if (tags.lit === 'yes' || tags.lit === 'no') add('lit', tags.lit, `lit=${tags.lit}`, tags.lit === 'yes' ? 'lit at night' : 'not lit at night');
  const wheelchair = tags['toilets:wheelchair'] && tags.amenity === 'toilets' ? tags['toilets:wheelchair'] : tags.wheelchair;
  if (wheelchair && WHEELCHAIR[wheelchair]) add('wheelchair', wheelchair, tags.amenity === 'toilets' && tags['toilets:wheelchair'] ? `toilets:wheelchair=${wheelchair}` : `wheelchair=${wheelchair}`, WHEELCHAIR[wheelchair]);
  return way ? out.filter(finding => WAY_KINDS.has(finding.kind)) : out;
}

type Point = [number, number];
/** How far inside a way's ends, in metres, its first and last samples fall. */
const INSIDE = 0.5;
function frame(origin: LonLat) {
  const metres = 6371008.8 * Math.PI / 180, cos = Math.cos(origin[1] * Math.PI / 180);
  return (p: LonLat): Point => [(p[0] - origin[0]) * cos * metres, (p[1] - origin[1]) * metres];
}
/** Distance from p to segment ab, and the segment's direction. */
function toSegment(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy), t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (length * length))) : 0;
  return { d: Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy), t, dir: length ? [dx / length, dy / length] as Point : null };
}
/** Points every step metres along a line, from margin inside each end (its midpoint alone when it is shorter), each with the line's direction there. */
function samples(line: readonly Point[], step: number, margin: number): { at: Point; dir: Point }[] {
  const parts = line.slice(1).map((b, i) => ({ a: line[i], b, length: Math.hypot(b[0] - line[i][0], b[1] - line[i][1]) })).filter(part => part.length > 0);
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const at = (distance: number) => {
    let left = distance;
    for (const part of parts) {
      if (left <= part.length) { const dir: Point = [(part.b[0] - part.a[0]) / part.length, (part.b[1] - part.a[1]) / part.length]; return { at: [part.a[0] + dir[0] * left, part.a[1] + dir[1] * left] as Point, dir }; }
      left -= part.length;
    }
    const last = parts[parts.length - 1];
    return { at: last.b, dir: [(last.b[0] - last.a[0]) / last.length, (last.b[1] - last.a[1]) / last.length] as Point };
  };
  if (!parts.length) return [];
  if (total <= 2 * margin) return [at(total / 2)];
  const out = [];
  for (let distance = margin; distance <= total - margin; distance += step) out.push(at(distance));
  return out;
}

/**
 * Places what OpenStreetMap says on the route. A way is sampled every metre, from half a metre inside each end, and
 * each sample counts on its nearest stretch when that stretch passes within nearMetres and runs along the way
 * (|cos| above 0.8). So a short flight is caught on the stretch it sits on, a way that only ends where a stretch
 * begins stays off it, and a street the route only crosses is left out. A node goes to its nearest stretch within
 * nearMetres, a bench or toilets within amenityMetres. Sorted by stretch, then id, so the same answer gives the same list.
 */
export function accessFindings(elements: readonly OsmElement[], stretches: readonly StretchLine[], { nearMetres = 3, amenityMetres = 15 }: AccessOptions = {}): AccessFinding[] {
  const first = stretches.find(stretch => stretch.line.length)?.line[0];
  if (!first) return [];
  const local = frame(first);
  const walk = stretches.map(stretch => ({ index: stretch.index, line: stretch.line.map(local) }));
  const seen = new Set<string>(), out: AccessFinding[] = [];
  for (const element of elements) {
    if (element.type === 'relation' || !element.tags) continue;
    const key = `${element.type}/${element.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const says = said(element);
    if (!says.length) continue;
    let placed: number[] = [], position: LonLat | null = null;
    if (element.type === 'way') {
      const points = (element.geometry ?? []).filter((p): p is { lat: number; lon: number } => !!p).map(p => local([p.lon, p.lat]));
      if (points.length < 2) continue;
      const hits = new Set<number>();
      for (const sample of samples(points, 1, INSIDE)) {
        const nearest = walk.map(stretch => stretch.line.slice(1).map((b, i) => ({ index: stretch.index, ...toSegment(sample.at, stretch.line[i], b) }))).flat().sort((a, b) => a.d - b.d || a.index - b.index)[0];
        if (nearest?.dir && nearest.d <= nearMetres && Math.abs(nearest.dir[0] * sample.dir[0] + nearest.dir[1] * sample.dir[1]) > 0.8) hits.add(nearest.index);
      }
      placed = [...hits].sort((a, b) => a - b);
    } else if (typeof element.lat === 'number' && typeof element.lon === 'number') {
      position = [Math.round(element.lon * 1e7) / 1e7, Math.round(element.lat * 1e7) / 1e7];
      const at = local(position), reach = says.some(finding => finding.kind === 'bench' || finding.kind === 'toilets') ? amenityMetres : nearMetres;
      const nearest = walk.map(stretch => ({ index: stretch.index, d: Math.min(...stretch.line.slice(1).map((b, i) => toSegment(at, stretch.line[i], b).d), stretch.line.length === 1 ? Math.hypot(at[0] - stretch.line[0][0], at[1] - stretch.line[0][1]) : Infinity) }))
        .sort((a, b) => a.d - b.d || a.index - b.index)[0];
      if (nearest && nearest.d <= reach) placed = [nearest.index];
    }
    if (!placed.length) continue;
    const osm = { type: element.type, id: element.id, tags: kept(element.tags) };
    for (const finding of says) out.push({ id: `osm-${element.type}-${element.id}-${slug(finding.concept)}`, ...finding, source: 'openstreetmap', osm, position, stretches: placed });
  }
  return out.sort((a, b) => a.stretches[0] - b.stretches[0] || (a.id < b.id ? -1 : 1));
}

/** How many findings of each kind, in ACCESS_KINDS order, leaving out kinds with none. */
export function accessKinds(findings: readonly AccessFinding[]): { kind: AccessKind; label: string; count: number; stretches: number }[] {
  return ACCESS_KINDS.map(({ kind, label }) => {
    const all = findings.filter(finding => finding.kind === kind);
    return { kind, label, count: all.length, stretches: new Set(all.flatMap(finding => finding.stretches)).size };
  }).filter(kind => kind.count);
}

type Feature = { type: 'Feature'; properties: Record<string, string>; geometry: { type: 'Polygon'; coordinates: LonLat[][] } | { type: 'LineString'; coordinates: LonLat[] } };
/** The buildings and highways of an Overpass answer as GeoJSON, in the shape of a place package's map_context. */
export function mapContext(elements: readonly OsmElement[]): { buildings: { type: 'FeatureCollection'; features: Feature[] }; ways: { type: 'FeatureCollection'; features: Feature[] } } {
  const buildings: Feature[] = [], ways: Feature[] = [];
  for (const element of elements) {
    if (element.type !== 'way' || !element.tags) continue;
    const line = (element.geometry ?? []).filter((p): p is { lat: number; lon: number } => !!p).map(p => [p.lon, p.lat] as LonLat);
    if (line.length < 2) continue;
    const properties: Record<string, string> = { osm: `way/${element.id}`, ...(element.tags.name ? { name: element.tags.name } : {}) };
    if (element.tags.building && line.length >= 4) buildings.push({ type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [line] } });
    else if (element.tags.highway) ways.push({ type: 'Feature', properties: { ...properties, highway: element.tags.highway, ...(element.tags.footway ? { footway: element.tags.footway } : {}) }, geometry: { type: 'LineString', coordinates: line } });
  }
  return { buildings: { type: 'FeatureCollection', features: buildings }, ways: { type: 'FeatureCollection', features: ways } };
}

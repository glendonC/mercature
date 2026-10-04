/**
 * The way between a walk's two ends that avoids its mapped steps, as OpenStreetMap's router suggests it.
 * Valhalla's pedestrian costing takes step_penalty, a cost in seconds added for each flight of steps (checked on the
 * live server: 30 by default, and Qorikancha's walk turns off Loreto's steps between 35 and 40). With an hour per
 * flight the router goes around wherever a way exists, so the answer's own edges are read again and any steps left
 * on it mean there is no way around. A prepared walk keeps the raw answers, so its package gives the same bytes offline.
 */
import { ACCESS_KINDS, accessFindings, accessKinds, accessQuery, type AccessFinding, type AccessKind, type LonLat, type OsmElement, type StretchLine } from '../osm/access.ts';
import { along, decodePolyline6, distance, pointAt, project, slice, tenth } from './geo.ts';
import { AROUND_LABEL, STRETCH_METRES, type LineStretch, type MappedSteps, type Routed, type WayAround } from './shape.ts';
import { LIVE, RouteTrouble, VALHALLA, type Ask } from './valhalla.ts';

export const AROUND_OPTIONS: Readonly<Record<string, number>> = { step_penalty: 3600 };
/** Within this many metres of the walk, the way counts as on it. */
const ON_WALK = 5;
/** How close OpenStreetMap's tags must lie to a stretch, as for the walk's own findings. */
const NEAR = 3;
const ATTRIBUTES = ['edge.use', 'edge.way_id', 'edge.names', 'edge.begin_shape_index', 'edge.end_shape_index', 'shape'];

type Edge = { use?: unknown; way_id?: unknown; names?: unknown; begin_shape_index?: unknown; end_shape_index?: unknown };
type Leg = { shape?: unknown; maneuvers?: { street_names?: unknown }[] };
/** The answers a way around is built from, kept raw: the walk's own edges, and, when it has mapped steps, the router's way, that way's edges and what OpenStreetMap says along it. */
export type AroundAnswers = {
  readonly schema: 'mercature-way-around-answers/1';
  readonly server: string;
  readonly fetchedAt: string;
  readonly walkTrace: { readonly request: unknown; readonly body: unknown };
  readonly route: { readonly request: unknown; readonly body: unknown } | null;
  readonly routeTrace: { readonly request: unknown; readonly body: unknown } | null;
  readonly overpass: { readonly query: string; readonly body: unknown } | null;
};
/**
 * A walk as the way around needs it: its line, length and 10 m stretches, and the mapped steps its record already
 * places on them. A recorded walk's own steps win over the router's match, which can take a street beside a flight.
 */
export type Walk = { readonly line: readonly LonLat[]; readonly metres: number; readonly stretches: readonly StretchLine[]; readonly steps?: readonly MappedSteps[] };

export const walkTraceRequest = (line: readonly LonLat[]) => ({ shape: line.map(([lon, lat]) => ({ lat, lon })), costing: 'pedestrian', shape_match: 'map_snap', filters: { attributes: ATTRIBUTES, action: 'include' } });
export const aroundRequest = (from: LonLat, to: LonLat) => ({ locations: [{ lat: from[1], lon: from[0] }, { lat: to[1], lon: to[0] }], costing: 'pedestrian', costing_options: { pedestrian: { ...AROUND_OPTIONS } }, directions_options: { units: 'kilometers', language: 'en-US' } });
export const shapeTraceRequest = (shape: string) => ({ encoded_polyline: shape, costing: 'pedestrian', shape_match: 'edge_walk', filters: { attributes: ATTRIBUTES, action: 'include' } });

export const legOf = (body: unknown): Leg | null => (body as { trip?: { legs?: Leg[] } } | null)?.trip?.legs?.[0] ?? null;
/** The router's line, without repeated points. */
export const lineOf = (shape: string): LonLat[] => decodePolyline6(shape).filter((point, i, all) => i === 0 || distance(all[i - 1], point) > 0.05);
/** The named streets of a route's directions, in order, each once in a row. */
export function streetsOf(body: unknown): string[] {
  const names: string[] = [];
  for (const maneuver of legOf(body)?.maneuvers ?? []) {
    const name = Array.isArray(maneuver.street_names) && typeof maneuver.street_names[0] === 'string' ? maneuver.street_names[0].trim() : '';
    if (name && names[names.length - 1] !== name) names.push(name);
  }
  return names;
}

/** The flights of steps a trace walked, each with its OpenStreetMap way, its street name and its points. */
export function stepsIn(body: unknown): { way: number; name: string | null; line: LonLat[] }[] {
  const trace = body as { edges?: Edge[]; shape?: unknown } | null, shape = typeof trace?.shape === 'string' ? decodePolyline6(trace.shape) : [];
  const out: { way: number; name: string | null; line: LonLat[] }[] = [];
  for (const edge of Array.isArray(trace?.edges) ? trace.edges : []) {
    if (edge.use !== 'steps' || typeof edge.way_id !== 'number') continue;
    const begin = typeof edge.begin_shape_index === 'number' ? edge.begin_shape_index : 0, end = typeof edge.end_shape_index === 'number' ? edge.end_shape_index : begin;
    const part = shape.slice(begin, end + 1), last = out[out.length - 1];
    if (last?.way === edge.way_id) last.line.push(...part);
    else out.push({ way: edge.way_id, name: Array.isArray(edge.names) && typeof edge.names[0] === 'string' ? edge.names[0] : null, line: part });
  }
  return out;
}

/** The line cut into 10 m stretches; a last piece under half a metre joins the one before it. */
export function cutStretches(line: readonly LonLat[]): LineStretch[] {
  const at = along(line), total = at[at.length - 1] ?? 0, count = Math.max(1, Math.ceil((total - 0.5) / STRETCH_METRES));
  return Array.from({ length: count }, (_, index) => {
    const from = index * STRETCH_METRES, to = index === count - 1 ? total : from + STRETCH_METRES;
    return { index, from: tenth(from), to: tenth(to), line: slice(line, at, from, to) };
  });
}

/**
 * Where the way runs apart from the walk: the first and last point more than ON_WALK metres off it, widened to the
 * points on it either side. walkMetres scales the walk's metres to the length its record gives.
 */
export function apartOf(way: readonly LonLat[], walk: readonly LonLat[], walkMetres?: number): WayAround['apart'] {
  const at = along(way), walkAt = along(walk), total = at[at.length - 1] ?? 0, samples: number[] = [], scale = walkMetres && walkAt[walkAt.length - 1] ? walkMetres / walkAt[walkAt.length - 1] : 1;
  for (let metres = 0; metres < total; metres += 2) samples.push(metres);
  samples.push(total);
  const off = samples.map(metres => project(pointAt(way, at, metres), walk, walkAt).away > ON_WALK), first = off.indexOf(true), last = off.lastIndexOf(true);
  if (first < 0) return null;
  const from = first > 0 ? samples[first - 1] : 0, to = last < samples.length - 1 ? samples[last + 1] : total;
  return { leaves: tenth(scale * project(pointAt(way, at, from), walk, walkAt).metres), rejoins: tenth(scale * project(pointAt(way, at, to), walk, walkAt).metres), from: tenth(from), to: tenth(to), line: slice(way, at, from, to) };
}

/** The apart part widened to every stretch of the walk with mapped steps on it, since the way goes around all of them. */
function covering(apart: NonNullable<WayAround['apart']>, way: readonly LonLat[], walk: Walk, avoids: readonly MappedSteps[]): NonNullable<WayAround['apart']> {
  const indexes = avoids.flatMap(item => item.stretches);
  if (!indexes.length) return apart;
  const first = Math.min(...indexes), last = Math.max(...indexes), at = along(way);
  const firstLine = walk.stretches.find(stretch => stretch.index === first)?.line, lastLine = walk.stretches.find(stretch => stretch.index === last)?.line;
  let { leaves, rejoins, from, to } = apart;
  if (firstLine?.length && first * STRETCH_METRES < leaves) { leaves = first * STRETCH_METRES; from = Math.min(from, project(firstLine[0], way, at).metres); }
  if (lastLine?.length && (last + 1) * STRETCH_METRES > rejoins) { rejoins = Math.min(walk.metres, (last + 1) * STRETCH_METRES); to = Math.max(to, project(lastLine[lastLine.length - 1], way, at).metres); }
  return { leaves: tenth(leaves), rejoins: tenth(rejoins), from: tenth(from), to: tenth(to), line: slice(way, at, from, to) };
}
/** The walk's stretches nearest to each point, for steps the walk's own findings did not place. */
const nearestStretches = (points: readonly LonLat[], stretches: readonly StretchLine[]): number[] =>
  [...new Set(points.map(point => stretches.map(stretch => ({ index: stretch.index, away: project(point, stretch.line, along(stretch.line)).away })).sort((a, b) => a.away - b.away || a.index - b.index)[0]?.index).filter((index): index is number => index !== undefined))].sort((a, b) => a - b);

const routedOf = (answers: AroundAnswers, options: Readonly<Record<string, number>>): Routed => ({
  provider: 'valhalla', server: answers.server, costing: 'pedestrian', options: { ...options }, fetchedAt: answers.fetchedAt,
  osmAsOf: (answers.overpass?.body as { osm3s?: { timestamp_osm_base?: unknown } } | null)?.osm3s?.timestamp_osm_base as string ?? null,
});
const elementsOf = (body: unknown): OsmElement[] => { const elements = (body as { elements?: unknown } | null)?.elements; return Array.isArray(elements) ? elements as OsmElement[] : []; };
/** The OpenStreetMap ways a trace walked, or null when there is no trace. */
export function takenWays(body: unknown): Set<number> | null {
  const edges = (body as { edges?: Edge[] } | null)?.edges;
  return Array.isArray(edges) ? new Set(edges.map(edge => edge.way_id).filter((id): id is number => typeof id === 'number')) : null;
}
/**
 * What OpenStreetMap says along a line, on its stretches, and how many of each kind. With taken, a way counts only
 * when the line takes it, so a flight of steps beside the street a way around keeps to is never said to be on it.
 */
export function kindsAlong(body: unknown, stretches: readonly LineStretch[], taken: Set<number> | null = null): { findings: AccessFinding[]; kinds: ReturnType<typeof accessKinds> } {
  const elements = elementsOf(body).filter(element => element.type !== 'way' || !taken || taken.has(element.id));
  const findings = accessFindings(elements, stretches.map(stretch => ({ index: stretch.index, line: stretch.line })), { nearMetres: NEAR });
  return { findings, kinds: accessKinds(findings) };
}

/** Builds the way around from its answers. Pure: the same answers give the same record. */
export function wayAroundFrom(answers: AroundAnswers, walk: Walk): WayAround {
  const avoids: MappedSteps[] = [...walk.steps ?? []];
  for (const steps of stepsIn(answers.walkTrace.body)) {
    // Placed on the walk's stretches as the walk's own OpenStreetMap findings are, so both name the same stretches.
    const placed = accessFindings([{ type: 'way', id: steps.way, tags: { highway: 'steps' }, geometry: steps.line.map(([lon, lat]) => ({ lat, lon })) }], walk.stretches, { nearMetres: NEAR });
    const stretches = placed[0]?.stretches ?? nearestStretches(steps.line, walk.stretches), known = avoids.findIndex(item => item.way === steps.way);
    if (known < 0) avoids.push({ way: steps.way, name: steps.name, label: 'Steps', stretches });
    else if (!walk.steps?.some(item => item.way === steps.way)) avoids[known] = { ...avoids[known], stretches: [...new Set([...avoids[known].stretches, ...stretches])].sort((a, b) => a - b) };
  }
  avoids.sort((a, b) => (a.stretches[0] ?? Infinity) - (b.stretches[0] ?? Infinity) || a.way - b.way);
  const base = { schema: 'mercature-way-around/1', label: AROUND_LABEL, avoids, walkMetres: tenth(walk.metres), line: [], lengthMetres: null, apart: null, stretches: [], findings: [], kinds: [], streets: [] } as const;
  if (!avoids.length) return { ...base, status: 'same', routed: routedOf(answers, {}) };
  const shape = legOf(answers.route?.body)?.shape;
  if (typeof shape !== 'string' || !answers.routeTrace || stepsIn(answers.routeTrace.body).length) return { ...base, status: 'none', routed: routedOf(answers, AROUND_OPTIONS) };
  const line = lineOf(shape), near = apartOf(line, walk.line, walk.metres), apart = near && covering(near, line, walk, avoids);
  // A way with no steps that never leaves the walk means the walk has none on the router's map either.
  if (!apart) return { ...base, avoids: [], status: 'same', routed: routedOf(answers, AROUND_OPTIONS) };
  const stretches = cutStretches(line), lengthMetres = tenth(along(line).at(-1) ?? 0);
  return { ...base, status: 'found', line, lengthMetres, apart, stretches, ...kindsAlong(answers.overpass?.body, stretches, takenWays(answers.routeTrace.body)), streets: streetsOf(answers.route?.body), routed: routedOf(answers, AROUND_OPTIONS) };
}

/**
 * Asks for everything a way around needs: the walk's edges, and only when it has mapped steps, the router's way
 * with an hour per flight, that way's edges, and what OpenStreetMap says along it. Without OpenStreetMap's answer
 * the way still comes back, with no kinds and osmAsOf null.
 */
export async function askWayAround(line: readonly LonLat[], ask: Ask = LIVE, signal?: AbortSignal, now = new Date(), knownSteps = false): Promise<AroundAnswers> {
  const walkRequest = walkTraceRequest(line);
  const answers: AroundAnswers = { schema: 'mercature-way-around-answers/1', server: VALHALLA, fetchedAt: now.toISOString(), walkTrace: { request: walkRequest, body: await ask.valhalla('trace_attributes', walkRequest, signal) }, route: null, routeTrace: null, overpass: null };
  if (!knownSteps && !stepsIn(answers.walkTrace.body).length) return answers;
  const request = aroundRequest(line[0], line[line.length - 1]);
  const body = await ask.valhalla('route', request, signal).catch(error => { if (error instanceof RouteTrouble && error.kind === 'no-walk') return null; throw error; });
  const shape = legOf(body)?.shape;
  if (typeof shape !== 'string') return { ...answers, route: { request, body } };
  const traceRequest = shapeTraceRequest(shape), routeTrace = { request: traceRequest, body: await ask.valhalla('trace_attributes', traceRequest, signal) };
  if (stepsIn(routeTrace.body).length) return { ...answers, route: { request, body }, routeTrace };
  const query = accessQuery(lineOf(shape), 15, 15);
  const found = await ask.overpass(query, signal).catch(error => { if (signal?.aborted) throw error; return null; });
  return { ...answers, route: { request, body }, routeTrace, overpass: found ? { query, body: found } : null };
}

/** The way around a walk built on this device, asked live. Keep it with setAround so it stays offline. */
export async function findWayAround(line: readonly LonLat[], { signal, ask = LIVE }: { signal?: AbortSignal; ask?: Ask } = {}): Promise<WayAround> {
  return wayAroundFrom(await askWayAround(line, ask, signal), { line, metres: along(line).at(-1) ?? 0, stretches: cutStretches(line) });
}

type RouteRecord = { route: { line: LonLat[]; length_m: number }; stretches: { index: number; line: LonLat[] }[]; findings: { concept?: unknown; label?: unknown; stretches?: unknown; osm?: { type?: unknown; id?: unknown; tags?: Record<string, unknown> } | null }[] };
/** A recorded walk (mercature-route/1) as the way around needs it, with its own words for each mapped flight of steps. */
export function recordWalk(record: RouteRecord): Walk {
  const steps: MappedSteps[] = [];
  for (const finding of record.findings) {
    const way = finding.osm?.id, stretches = Array.isArray(finding.stretches) ? finding.stretches.filter((index): index is number => Number.isInteger(index)) : [];
    if (finding.concept !== 'highway=steps' || finding.osm?.type !== 'way' || typeof way !== 'number') continue;
    const known = steps.findIndex(item => item.way === way), name = finding.osm.tags?.name;
    if (known >= 0) steps[known] = { ...steps[known], stretches: [...new Set([...steps[known].stretches, ...stretches])].sort((a, b) => a - b) };
    else steps.push({ way, name: typeof name === 'string' ? name : null, label: typeof finding.label === 'string' ? finding.label : 'Steps', stretches });
  }
  return { line: record.route.line, metres: record.route.length_m, stretches: record.stretches.map(stretch => ({ index: stretch.index, line: stretch.line })), steps };
}

const fail = (): never => { throw new Error('The way around is malformed.'); };
const obj = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail();
const arr = (value: unknown, max = 20000): unknown[] => Array.isArray(value) && value.length <= max ? value : fail();
const num = (value: unknown, min = 0, max = 1e6): number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fail();
const str = (value: unknown, max = 300): string => typeof value === 'string' && value.length <= max ? value : fail();
const point = (value: unknown): LonLat => { const p = arr(value, 2); return p.length === 2 ? [num(p[0], -180, 180), num(p[1], -90, 90)] : fail(); };
const whole = (value: unknown, max = 1999): number => Number.isInteger(num(value, 0, max)) ? value as number : fail();
export const readStretches = (value: unknown): LineStretch[] => arr(value, 2000).map((raw, i) => { const s = obj(raw); return s.index === i ? { index: i, from: num(s.from), to: num(s.to), line: arr(s.line).map(point) } : fail(); });
const KINDS = new Set<string>(ACCESS_KINDS.map(kind => kind.kind));
export const readFindings = (value: unknown, stretches: number): AccessFinding[] => arr(value, 3000).map(raw => {
  const f = obj(raw), osm = obj(f.osm), tags = obj(osm.tags);
  if (!KINDS.has(str(f.kind)) || f.source !== 'openstreetmap' || (osm.type !== 'node' && osm.type !== 'way')) fail();
  return {
    id: str(f.id, 200), kind: f.kind as AccessKind, value: str(f.value), concept: str(f.concept), label: str(f.label), barrier: f.barrier === true, source: 'openstreetmap',
    osm: { type: osm.type as 'node' | 'way', id: num(osm.id, 0, 1e13), tags: Object.fromEntries(Object.entries(tags).map(([key, tag]) => [str(key, 100), str(tag)])) },
    position: f.position == null ? null : point(f.position), stretches: arr(f.stretches, 2000).map(index => whole(index, stretches - 1)),
  };
});
export const readKinds = (value: unknown) => arr(value, 100).map(raw => { const k = obj(raw); return KINDS.has(str(k.kind)) ? { kind: k.kind as AccessKind, label: str(k.label), count: whole(k.count, 100000), stretches: whole(k.stretches, 100000) } : fail(); });
export const readRouted = (value: unknown): Routed => {
  const r = obj(value), options = obj(r.options);
  if (r.provider !== 'valhalla' || r.costing !== 'pedestrian') fail();
  return { provider: 'valhalla', server: str(r.server), costing: 'pedestrian', options: Object.fromEntries(Object.entries(options).map(([key, option]) => [str(key, 60), num(option, 0, 1e6)])), fetchedAt: str(r.fetchedAt, 40), osmAsOf: r.osmAsOf == null ? null : str(r.osmAsOf, 40) };
};

/** Reads a way around from a place package or from this device, checking every field. */
export function readWayAround(value: unknown): WayAround {
  const w = obj(value);
  if (w.schema !== 'mercature-way-around/1' || w.label !== AROUND_LABEL || !['found', 'none', 'same'].includes(String(w.status))) fail();
  const stretches = readStretches(w.stretches), found = w.status === 'found';
  const apart = w.apart == null ? null : (({ leaves, rejoins, from, to, line }) => ({ leaves: num(leaves), rejoins: num(rejoins), from: num(from), to: num(to), line: arr(line).map(point) }))(obj(w.apart));
  const line = arr(w.line).map(point);
  if (found !== (line.length > 1 && !!apart && stretches.length > 0)) fail();
  return {
    schema: 'mercature-way-around/1', status: w.status as WayAround['status'], label: AROUND_LABEL,
    avoids: arr(w.avoids, 200).map(raw => { const a = obj(raw); return { way: num(a.way, 0, 1e13), name: a.name == null ? null : str(a.name), label: str(a.label), stretches: arr(a.stretches, 2000).map(index => whole(index)) }; }),
    walkMetres: num(w.walkMetres), line, lengthMetres: w.lengthMetres == null ? null : num(w.lengthMetres), apart, stretches,
    findings: readFindings(w.findings, stretches.length), kinds: readKinds(w.kinds), streets: arr(w.streets, 200).map(name => str(name)), routed: readRouted(w.routed),
  };
}

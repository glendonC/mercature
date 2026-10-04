/**
 * The three OpenStreetMap services a search may ask, each once per tap and never while typing:
 * Nominatim for places (at most one request a second, by its usage policy), Valhalla on the FOSSGIS server for the walk on foot,
 * and Overpass for the map and its tags around the walk.
 */
import { along, decodePolyline6, distance, type LonLat } from './geo.ts';

export type Trouble = 'offline' | 'busy' | 'none' | 'no-walk' | 'too-long' | 'failed';
/** A plain reason a search or a walk could not be had, for one line of text. */
export class SearchTrouble extends Error {
  readonly kind: Trouble;
  readonly status: number;
  constructor(kind: Trouble, status = 0) { super(kind); this.kind = kind; this.status = status; }
}

export const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const VALHALLA = 'https://valhalla1.openstreetmap.de/route';
export const OVERPASS = 'https://overpass-api.de/api/interpreter';
/** The longest walk built here: about an hour on foot, and an Overpass request the public server answers quickly. */
export const LONGEST_WALK = 5000;

const pause = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
});

/** Aborts when either signal does; AbortSignal.any where the browser has it. */
function either(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([a, b]);
  const both = new AbortController(), stop = (from: AbortSignal) => () => both.abort(from.reason);
  if (a.aborted || b.aborted) both.abort((a.aborted ? a : b).reason);
  a.addEventListener('abort', stop(a), { once: true }); b.addEventListener('abort', stop(b), { once: true });
  return both.signal;
}

/** One JSON request to a public map service, with plain reasons for every way it can fail. */
export async function ask(url: string, init: RequestInit, signal: AbortSignal | undefined, seconds: number): Promise<unknown> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new SearchTrouble('offline');
  const timeout = AbortSignal.timeout(seconds * 1000), both = signal ? either(signal, timeout) : timeout;
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: both, credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new SearchTrouble(timeout.aborted ? 'busy' : typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'failed');
  }
  if (response.status === 429 || response.status === 503 || response.status === 504) throw new SearchTrouble('busy');
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new SearchTrouble('failed', response.status);
  return body;
}

/** A place OpenStreetMap knows. */
export type Found = { id: string; name: string; detail: string; position: LonLat; kind: string; osm: { type: 'node' | 'way' | 'relation'; id: number } | null };

let lastAsked = 0;
/**
 * Places matching the words, best first. One request per call, spaced at least a second from the last.
 * near: keeps the answers within a few kilometres of a point, for the start of a walk.
 */
export async function findPlaces(words: string, options: { near?: LonLat; lang?: string; signal?: AbortSignal } = {}): Promise<Found[]> {
  const query = new URLSearchParams({ q: words.trim(), format: 'jsonv2', limit: '6', namedetails: '1' });
  if (options.lang) query.set('accept-language', options.lang);
  if (options.near) {
    const [lon, lat] = options.near, d = 0.045;
    query.set('viewbox', `${lon - d},${lat + d},${lon + d},${lat - d}`); query.set('bounded', '1');
  }
  const wait = lastAsked + 1100 - Date.now();
  if (wait > 0) await pause(wait, options.signal);
  lastAsked = Date.now();
  const body = await ask(`${NOMINATIM}?${query}`, { headers: { Accept: 'application/json' } }, options.signal, 15);
  if (!Array.isArray(body)) throw new SearchTrouble('failed');
  const found: Found[] = [];
  for (const raw of body as Record<string, unknown>[]) {
    const lat = Number(raw.lat), lon = Number(raw.lon), display = String(raw.display_name ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !display) continue;
    const parts = display.split(',').map(part => part.trim()).filter(Boolean);
    // The name on the ground, as signs show it, rather than its translation into the interface language.
    const local = (raw.namedetails as Record<string, unknown> | null | undefined)?.name;
    const name = typeof local === 'string' && local.trim() ? local.trim() : typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : parts[0];
    const type = raw.osm_type === 'node' || raw.osm_type === 'way' || raw.osm_type === 'relation' ? raw.osm_type : null;
    const detail = parts.filter(part => part !== name && !/^\d[\d -]*$/.test(part)).slice(0, 3).join(', ');
    found.push({ id: type ? `${type}/${raw.osm_id}` : `${lat},${lon}`, name, detail, position: [lon, lat], kind: String(raw.type ?? ''), osm: type ? { type, id: Number(raw.osm_id) } : null });
  }
  return found;
}

/** A named street the walk follows, from the walk's own turn by turn directions, in metres along it. */
export type Street = { name: string; from: number; to: number };
export type Walked = { line: LonLat[]; lengthMetres: number; streets: Street[]; fetchedAt: string };

/** The walk on foot between two points, as Valhalla's pedestrian costing finds it on OpenStreetMap. */
export async function walkBetween(from: LonLat, to: LonLat, signal?: AbortSignal): Promise<Walked> {
  if (distance(from, to) > LONGEST_WALK) throw new SearchTrouble('too-long');
  const request = { locations: [{ lat: from[1], lon: from[0] }, { lat: to[1], lon: to[0] }], costing: 'pedestrian', directions_options: { units: 'kilometers', language: 'en-US' } };
  let body: unknown;
  try {
    body = await ask(VALHALLA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }, signal, 30);
  } catch (error) {
    // Valhalla answers 400 when it finds no walk (no path, or a point too far from any way).
    if (error instanceof SearchTrouble && error.status === 400) throw new SearchTrouble('no-walk');
    throw error;
  }
  const trip = (body as { trip?: { legs?: { shape?: string; maneuvers?: { street_names?: string[]; begin_shape_index?: number; end_shape_index?: number }[] }[] } }).trip;
  const leg = trip?.legs?.[0];
  if (!leg?.shape) throw new SearchTrouble('no-walk');
  const line = decodePolyline6(leg.shape).filter((point, i, all) => i === 0 || distance(all[i - 1], point) > 0.05);
  if (line.length < 2) throw new SearchTrouble('no-walk');
  const at = along(line), lengthMetres = at[at.length - 1];
  if (lengthMetres > LONGEST_WALK) throw new SearchTrouble('too-long');
  const raw = decodePolyline6(leg.shape), rawAt = along(raw);
  const streets: Street[] = [];
  for (const maneuver of leg.maneuvers ?? []) {
    const name = maneuver.street_names?.[0]?.trim();
    const begin = rawAt[maneuver.begin_shape_index ?? -1], end = rawAt[maneuver.end_shape_index ?? -1];
    if (!name || begin === undefined || end === undefined || end <= begin) continue;
    const last = streets[streets.length - 1];
    if (last?.name === name && Math.abs(last.to - begin) < 1) last.to = end;
    else streets.push({ name, from: begin, to: end });
  }
  return { line, lengthMetres, streets, fetchedAt: new Date().toISOString() };
}

export type OsmElement = { type: 'node' | 'way' | 'relation'; id: number; tags?: Record<string, string>; lat?: number; lon?: number; geometry?: ({ lat: number; lon: number } | null)[] };

/** Runs one Overpass query. The public server allows a few at a time per address, so a busy answer says to wait. */
export async function overpass(query: string, signal?: AbortSignal): Promise<{ elements: OsmElement[]; fetchedAt: string }> {
  const body = await ask(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: query }) }, signal, 70) as { elements?: unknown; remark?: unknown } | null;
  // Overpass answers 200 with a remark when it ran out of time or memory, and the elements are then incomplete.
  if (!body || !Array.isArray(body.elements) || /runtime error/i.test(String(body.remark ?? ''))) throw new SearchTrouble('busy');
  const elements = body.elements;
  return { elements: elements as OsmElement[], fetchedAt: new Date().toISOString() };
}

/**
 * What a place keeps on this device besides the review: the streets she adds near the tour route, her answer when the
 * guide asks her to check the way around, and a way around asked here for a route with no package.
 * Her street is the router's way on foot between two points she tapped, with what OpenStreetMap says along it.
 * It has no street photos and nobody has checked it; nothing here says whether a person can get through.
 */
import { accessQuery, type LonLat } from '../osm/access.ts';
import { cutStretches, kindsAlong, legOf, lineOf, readFindings, readKinds, readRouted, readStretches, readWayAround, shapeTraceRequest, streetsOf, takenWays } from './around.ts';
import { along, distance, project, round, tenth } from './geo.ts';
import { STREET_LABEL, type AroundCheck, type OwnStreet, type RouteLines, type WayAround } from './shape.ts';
import { LIVE, RouteTrouble, VALHALLA, type Ask } from './valhalla.ts';

/** A tap counts as near the route within this many metres of it. */
export const NEAR_WALK = 300;
export const LONGEST_STREET = 2000;
export const MOST_STREETS = 20;
/** A street before addStreet gives it an id. */
export type NewStreet = Omit<OwnStreet, 'id'>;
/** A line for the map's paths: the way around off the route, or one of her streets. */
export type MapPath = { id: string; kind: 'around' | 'street'; line: [number, number][] };

const key = (place: string) => `mercature.route-lines.v1.${place}`;
export const emptyLines = (place: string): RouteLines => ({ schema: 'mercature-route-lines/1', place, streets: [], check: null, around: null, seq: 0 });
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isTime = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));
const isPoint = (value: unknown): value is LonLat => Array.isArray(value) && value.length === 2 && value.every(n => typeof n === 'number' && Number.isFinite(n)) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;

/**
 * Her street between two taps: the router's way on foot (pedestrian, no options), cut into 10 m stretches, with what
 * OpenStreetMap says about the ways it takes and the points along it. Throws RouteTrouble: too-far when a tap is more
 * than NEAR_WALK from the route, too-long, no-walk when the router finds no way, offline, busy or failed.
 * Without OpenStreetMap's answer it has no kinds and osmAsOf null.
 */
export async function buildStreet(from: LonLat, to: LonLat, walk: readonly LonLat[], { signal, ask = LIVE, now = new Date() }: { signal?: AbortSignal; ask?: Ask; now?: Date } = {}): Promise<NewStreet> {
  const walkAt = along(walk);
  if (walk.length > 1 && [from, to].some(tap => project(tap, walk, walkAt).away > NEAR_WALK)) throw new RouteTrouble('too-far');
  if (distance(from, to) > LONGEST_STREET) throw new RouteTrouble('too-long');
  const request = { locations: [{ lat: from[1], lon: from[0] }, { lat: to[1], lon: to[0] }], costing: 'pedestrian', directions_options: { units: 'kilometers', language: 'en-US' } };
  const body = await ask.valhalla('route', request, signal), shape = legOf(body)?.shape;
  const line = typeof shape === 'string' ? lineOf(shape) : [];
  if (line.length < 2) throw new RouteTrouble('no-walk');
  const lengthMetres = tenth(along(line).at(-1) ?? 0);
  if (lengthMetres > LONGEST_STREET) throw new RouteTrouble('too-long');
  const stretches = cutStretches(line), streets = streetsOf(body), quiet = (error: unknown) => { if (signal?.aborted) throw error; return null; };
  const trace = await ask.valhalla('trace_attributes', shapeTraceRequest(shape as string), signal).catch(quiet);
  const found = await ask.overpass(accessQuery(line, 15, 15), signal).catch(quiet);
  const osmAsOf = (found as { osm3s?: { timestamp_osm_base?: unknown } } | null)?.osm3s?.timestamp_osm_base;
  return {
    label: STREET_LABEL, name: streets[0] ?? null, streets, from: round(from), to: round(to), line, lengthMetres, stretches, ...kindsAlong(found, stretches, takenWays(trace)),
    routed: { provider: 'valhalla', server: VALHALLA, costing: 'pedestrian', options: {}, fetchedAt: now.toISOString(), osmAsOf: typeof osmAsOf === 'string' ? osmAsOf : null }, at: now.toISOString(),
  };
}

function readStreet(value: unknown): OwnStreet {
  if (!isRecord(value) || typeof value.id !== 'string' || !/^street-\d{1,6}$/.test(value.id) || value.label !== STREET_LABEL || !isPoint(value.from) || !isPoint(value.to) || !isTime(value.at)) throw new Error('street');
  if (!Array.isArray(value.line) || value.line.length < 2 || value.line.length > 20000 || !value.line.every(isPoint) || typeof value.lengthMetres !== 'number' || !(value.lengthMetres >= 0 && value.lengthMetres <= LONGEST_STREET)) throw new Error('street line');
  if (!Array.isArray(value.streets) || !value.streets.every(name => typeof name === 'string' && name.length <= 300) || (value.name !== null && typeof value.name !== 'string')) throw new Error('street names');
  const stretches = readStretches(value.stretches);
  return { id: value.id, label: STREET_LABEL, name: value.name as string | null, streets: value.streets as string[], from: value.from, to: value.to, line: value.line as LonLat[], lengthMetres: value.lengthMetres, stretches, findings: readFindings(value.findings, stretches.length), kinds: readKinds(value.kinds), routed: readRouted(value.routed), at: value.at };
}

export function parseLines(raw: string, place: string): RouteLines {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.schema !== 'mercature-route-lines/1' || value.place !== place || !Array.isArray(value.streets)) throw new Error('shape');
  const streets = value.streets.slice(0, MOST_STREETS).map(readStreet);
  if (new Set(streets.map(street => street.id)).size !== streets.length) throw new Error('street ids');
  const check = value.check == null ? null : isRecord(value.check) && typeof value.check.works === 'boolean' && isTime(value.check.at) ? { works: value.check.works, at: value.check.at } : null;
  const highest = Math.max(0, ...streets.map(street => Number(street.id.slice('street-'.length))));
  const seq = typeof value.seq === 'number' && Number.isInteger(value.seq) && value.seq >= highest && value.seq <= 100000 ? value.seq : highest;
  return { schema: 'mercature-route-lines/1', place, streets, check, around: value.around == null ? null : readWayAround(value.around), seq };
}

/** Reads this place's lines. An unreadable record is set aside, never silently overwritten. */
export function loadLines(place: string): { lines: RouteLines; error: '' | 'unreadable' | 'storage' } {
  try {
    const raw = localStorage.getItem(key(place));
    if (raw === null) return { lines: emptyLines(place), error: '' };
    try {
      return { lines: parseLines(raw, place), error: '' };
    } catch {
      localStorage.setItem(`${key(place)}.unreadable`, raw);
      localStorage.removeItem(key(place));
      return { lines: emptyLines(place), error: 'unreadable' };
    }
  } catch {
    return { lines: emptyLines(place), error: 'storage' };
  }
}

/** Returns false when the device refused to keep it, so the caller can say so. */
export function saveLines(lines: RouteLines): boolean {
  try {
    localStorage.setItem(key(lines.place), JSON.stringify(lines));
    return true;
  } catch {
    return false;
  }
}

/** Adds her street with the next id. At MOST_STREETS nothing changes. */
export function addStreet(lines: RouteLines, street: NewStreet): RouteLines {
  if (lines.streets.length >= MOST_STREETS) return lines;
  const seq = lines.seq + 1;
  return { ...lines, seq, streets: [...lines.streets, { ...street, id: `street-${seq}` }] };
}
export const removeStreet = (lines: RouteLines, id: string): RouteLines => ({ ...lines, streets: lines.streets.filter(street => street.id !== id) });
/** Her answer after checking the way around, or null to take it back. */
export const setCheck = (lines: RouteLines, works: boolean | null, at = new Date().toISOString()): RouteLines => ({ ...lines, check: works === null ? null : { works, at } satisfies AroundCheck });
/** Keeps a way around asked on this device, for a route with no package. */
export const setAround = (lines: RouteLines, around: WayAround | null): RouteLines => ({ ...lines, around });
/** The way around a place has: its package's, else the one asked on this device, else null (nobody has asked yet). */
export const wayAroundOf = (destination: { readonly wayAround?: WayAround | null } | null, lines: RouteLines | null): WayAround | null => destination?.wayAround ?? lines?.around ?? null;

/**
 * The lines for the map: the whole way around, when one was found, then her streets. The whole way, because where it
 * keeps close to the route it can still take a street beside a flight of steps; the route is drawn over the shared ends.
 */
export function mapPaths(around: WayAround | null, streets: readonly OwnStreet[]): MapPath[] {
  const paths: MapPath[] = [];
  if (around?.status === 'found') paths.push({ id: 'around', kind: 'around', line: around.line.map(([lon, lat]) => [lon, lat]) });
  for (const street of streets) paths.push({ id: street.id, kind: 'street', line: street.line.map(([lon, lat]) => [lon, lat]) });
  return paths;
}

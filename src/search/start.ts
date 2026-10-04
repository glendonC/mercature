/**
 * Where a walk to a searched place starts when nobody says: a main square, a station or a pedestrian street a few hundred metres
 * away on OpenStreetMap, else a point about 400 m away that the walk on foot snaps to the nearest way.
 */
import { distance, type LonLat } from './geo.ts';
import { OVERPASS, overpassAt, type OsmElement } from './services.ts';
import type { End } from './build.ts';

/** How far a start may be, in metres in a straight line, and the distance a good one is near. */
const NEAREST = 250, FURTHEST = 800, AIM = 450;
const rankOf = (tags: Record<string, string>) =>
  tags.place === 'square' || (tags.highway === 'pedestrian' && tags.area === 'yes') ? 0
    : tags.railway === 'station' || tags.public_transport === 'station' || tags.amenity === 'bus_station' ? 1
    : tags.highway === 'pedestrian' ? 2 : 3;

/** The best named start among Overpass's answers, or null. Exported for tests. */
export function pickStart(target: LonLat, elements: readonly OsmElement[]): End | null {
  const options = elements.flatMap(element => {
    const tags = element.tags ?? {}, center = (element as OsmElement & { center?: { lat: number; lon: number } }).center;
    const at: LonLat | null = element.lat != null && element.lon != null ? [element.lon, element.lat] : center ? [center.lon, center.lat] : null;
    if (!tags.name || !at) return [];
    const away = distance(target, at);
    return away >= NEAREST && away <= FURTHEST ? [{ name: tags.name, position: at, rank: rankOf(tags), off: Math.abs(away - AIM) }] : [];
  }).sort((a, b) => a.rank - b.rank || a.off - b.off);
  return options[0] ? { name: options[0].name, position: options[0].position } : null;
}

export function startQuery([lon, lat]: LonLat): string {
  const near = `around:${FURTHEST},${lat.toFixed(6)},${lon.toFixed(6)}`;
  return `[out:json][timeout:3];(node(${near})[place=square][name];way(${near})[place=square][name];way(${near})[highway=pedestrian][name];` +
    `node(${near})[railway=station][name];node(${near})[public_transport=station][name];node(${near})[amenity=bus_station][name];` +
    `way(${near})[highway~"^(primary|secondary|tertiary)$"][name];);out center tags 200;`;
}

/**
 * A start for a walk to the target: a named place nearby, or a point 400 m south with no name yet (the walk names it by its street).
 * The lookup gets three seconds on one server, so a busy one costs her little.
 */
export async function findStart(target: LonLat, signal?: AbortSignal): Promise<End> {
  try {
    const { elements } = await overpassAt(OVERPASS, startQuery(target), signal, 3);
    const found = pickStart(target, elements);
    if (found) return found;
  } catch (error) { if (signal?.aborted) throw error; }
  return { name: '', position: [target[0], target[1] - 400 / 111195] };
}

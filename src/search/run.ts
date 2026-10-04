/**
 * Builds a map-only tour route on this device in two parts, so it opens fast: first a start if none was given and the route on foot from Valhalla,
 * which opens at once with nothing on it yet; then OpenStreetMap along it from Overpass, added when it arrives.
 */
import { accessFindings, accessQuery, mapContext } from '../osm/access.ts';
import { buildPlace, cut, type Built, type End } from './build.ts';
import { simplify } from './geo.ts';
import { overpass, SearchTrouble, walkBetween, type Walked } from './services.ts';
import { findStarts, TRAIL } from './start.ts';

/** How close a node must be to count on a stretch, and the corridor Overpass reads: narrow, so a public server answers fast. */
export const AROUND_METRES = 15, CONTEXT_METRES = 25, NEAR_METRES = 3;
/** Seconds the main Overpass server gets before the answer counts as busy; a second server is asked after three. */
export const READ_SECONDS = 8;
const EMPTY = { buildings: { type: 'FeatureCollection' as const, features: [] }, ways: { type: 'FeatureCollection' as const, features: [] } };

/** The longest route on foot a picked start may give before the next one is tried. */
export const START_WALK = 900;
/** How many starts are tried, one route request each. */
const TRIES = 3;
/** A start with no name takes the first street the route follows that is not a trail. */
const named = (start: End, walked: Walked): End => start.name ? start : { ...start, name: walked.streets.find(street => !TRAIL.test(street.name))?.name || 'Nearby street' };

/** The route on foot, before OpenStreetMap is read along it. */
export type Routed = { preview: Built; base: { start: End; target: End; area: string; walked: Walked; aroundMetres: number; nearMetres: number } };

export async function routeWalk(target: End, area: string, signal?: AbortSignal, given?: End): Promise<Routed> {
  // Each start is judged by the route it gives: the first under 900 m on foot wins, else the shortest tried.
  let best: { start: End; walked: Walked } | null = null, trouble: unknown = null;
  for (const start of given ? [given] : (await findStarts(target.position, signal)).slice(0, TRIES)) {
    try {
      const walked = await walkBetween(start.position, target.position, signal);
      if (!best || walked.lengthMetres < best.walked.lengthMetres) best = { start, walked };
      if (walked.lengthMetres <= START_WALK) break;
    } catch (error) { if (signal?.aborted || (error instanceof SearchTrouble && error.kind === 'offline')) throw error; trouble ??= error; }
  }
  if (!best) throw trouble ?? new SearchTrouble('no-walk');
  const walked = best.walked;
  const base = { start: named(best.start, walked), target, area, walked, aroundMetres: AROUND_METRES, nearMetres: NEAR_METRES };
  return { base, preview: buildPlace({ ...base, findings: [], context: EMPTY, fetchedAt: walked.fetchedAt }) };
}

export async function readWalk({ base }: Routed, signal?: AbortSignal): Promise<Built> {
  const { elements, fetchedAt } = await overpass(accessQuery(simplify(base.walked.line, 3), AROUND_METRES, CONTEXT_METRES), signal, READ_SECONDS);
  const stretches = cut(base.walked.line);
  const findings = accessFindings(elements, stretches.map(stretch => ({ index: stretch.index, line: stretch.line })), { nearMetres: NEAR_METRES });
  return buildPlace({ ...base, findings, context: mapContext(elements), fetchedAt });
}

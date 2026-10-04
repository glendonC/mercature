/** Builds a map-only walk on this device: a start if none was given, the walk on foot from Valhalla, then OpenStreetMap along it from Overpass. */
import { accessFindings, accessQuery, mapContext } from '../osm/access.ts';
import { buildPlace, cut, type Built, type End } from './build.ts';
import { simplify } from './geo.ts';
import { overpass, walkBetween, type Walked } from './services.ts';
import { findStart } from './start.ts';

/** walk: finding the start and the way on foot. map: the way is known (preview has it with nothing on it yet) and OpenStreetMap is being read. */
export type Progress = { step: 'walk' } | { step: 'map'; preview: Built };
/** How close a node must be to count on a stretch, and the corridor Overpass reads: narrow, so a public server answers fast. */
export const AROUND_METRES = 15, CONTEXT_METRES = 25, NEAR_METRES = 3;
const EMPTY = { buildings: { type: 'FeatureCollection' as const, features: [] }, ways: { type: 'FeatureCollection' as const, features: [] } };

/** A start with no name takes the street the walk leaves on. */
const named = (start: End, walked: Walked): End => start.name ? start : { ...start, name: walked.streets[0]?.name || 'Nearby street' };

export async function buildWalk(target: End, area: string, onProgress: (progress: Progress) => void, signal?: AbortSignal, given?: End): Promise<Built> {
  onProgress({ step: 'walk' });
  const first = given ?? await findStart(target.position, signal);
  const walked = await walkBetween(first.position, target.position, signal);
  const start = named(first, walked);
  const base = { start, target, area, walked, aroundMetres: AROUND_METRES, nearMetres: NEAR_METRES };
  onProgress({ step: 'map', preview: buildPlace({ ...base, findings: [], context: EMPTY, fetchedAt: walked.fetchedAt }) });
  const { elements, fetchedAt } = await overpass(accessQuery(simplify(walked.line, 3), AROUND_METRES, CONTEXT_METRES), signal);
  const stretches = cut(walked.line);
  const findings = accessFindings(elements, stretches.map(stretch => ({ index: stretch.index, line: stretch.line })), { nearMetres: NEAR_METRES });
  return buildPlace({ ...base, findings, context: mapContext(elements), fetchedAt });
}

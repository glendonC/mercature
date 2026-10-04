/** Builds a map-only walk on this device: the walk on foot from Valhalla, then OpenStreetMap around it from Overpass, then the package. */
import { accessFindings, accessQuery, mapContext } from '../osm/access.ts';
import { buildPlace, cut, type Built, type End } from './build.ts';
import { simplify } from './geo.ts';
import { overpass, walkBetween } from './services.ts';

export type Step = 'walk' | 'map' | 'stretches';
/** How far around the walk Overpass looks for what stands on it, and how close a way or node must be to count on a stretch. */
export const AROUND_METRES = 15, NEAR_METRES = 3;

export async function buildWalk(start: End, target: End, area: string, onStep: (step: Step) => void, signal?: AbortSignal): Promise<Built> {
  onStep('walk');
  const walked = await walkBetween(start.position, target.position, signal);
  onStep('map');
  const { elements, fetchedAt } = await overpass(accessQuery(simplify(walked.line, 2), AROUND_METRES), signal);
  onStep('stretches');
  const stretches = cut(walked.line);
  const findings = accessFindings(elements, stretches.map(stretch => ({ index: stretch.index, line: stretch.line })), { nearMetres: NEAR_METRES });
  return buildPlace({ start, target, area, walked, findings, context: mapContext(elements), fetchedAt, aroundMetres: AROUND_METRES, nearMetres: NEAR_METRES });
}

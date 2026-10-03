import type { Cell, Profile, Scenario, Scene, Traversal, TraversalPoint } from './contracts';
import { SOLVER_HASH, contentHash } from './validation';

export const TRAVERSAL_VERSION = 'certified-cardinal-v1' as const;

type CertifiedInput = Pick<Traversal, 'destinationId' | 'status' | 'reason' | 'sceneHash' | 'profileHash' | 'scenarioHash' | 'solverHash'> & {
  unsupported: boolean; start: TraversalPoint; destination: TraversalPoint;
  startIndex: number; destinationIndex: number; cells: Cell[];
  reached: Set<number>; parents: Map<number, number>;
};
const separation = (a: TraversalPoint, b: TraversalPoint) => Math.abs(a.x-b.x) + Math.abs(a.y-b.y);
const point = (p: TraversalPoint): TraversalPoint => ({ x: p.x, y: p.y, elevation: p.elevation });

/** Called only with the solver's conservative flood, never its optimistic connectivity set.
 * Exact endpoint elbows lie within the rectangular sweeps already certified by the solver.
 * No smoothing or diagonal connection is allowed; the envelope remains fixed to the axes.
 */
export function certifiedTraversal(input: CertifiedInput): Traversal {
  const { destinationId, status, sceneHash, profileHash, scenarioHash, solverHash } = input;
  const empty: Traversal = { traversalVersion: TRAVERSAL_VERSION, destinationId, status, sceneHash, profileHash, scenarioHash, solverHash,
    kind: 'unavailable', points: [], length: 0, reason: input.reason };
  if (input.unsupported) return { ...empty, reason: 'Selected requirements include unsupported checks; no traversal is certified.' };
  if (!input.reached.has(input.startIndex)) return { ...empty, reason: 'No certified connection from the exact start to the assessed grid.' };
  let target: number | undefined;
  if (status === 'reachable') {
    if (!input.reached.has(input.destinationIndex)) return empty;
    target = input.destinationIndex;
  } else {
    let nearest = Infinity;
    // Deterministic BFS insertion order breaks equal-distance ties. This is an approach,
    // not a diagnosis of the exact limiting feature or a route through unresolved cells.
    for (const index of input.reached) {
      const cell = input.cells[index];
      if (cell.elevation !== input.destination.elevation) continue;
      const distance = separation(cell, input.destination);
      if (distance < nearest - 1e-9) { nearest = distance; target = index; }
    }
  }
  if (target === undefined) return { ...empty, reason: 'No certified approach on the destination elevation.' };
  const chain: number[] = [target];
  while (chain[chain.length-1] !== input.startIndex) {
    const parent = input.parents.get(chain[chain.length-1]);
    if (parent === undefined || chain.length > input.cells.length) throw new Error('Invalid certified traversal predecessor chain');
    chain.push(parent);
  }
  chain.reverse();
  const points: TraversalPoint[] = [point(input.start)];
  const append = (p: TraversalPoint) => {
    const previous = points[points.length-1];
    if (previous.elevation !== p.elevation) throw new Error('Traversal cannot change elevation');
    if (previous.x !== p.x || previous.y !== p.y) points.push(point(p));
  };
  const first = input.cells[input.startIndex];
  append({ x: first.x, y: input.start.y, elevation: first.elevation });
  for (const index of chain) append(input.cells[index]);
  if (status === 'reachable') {
    const last = points[points.length-1];
    append({ x: input.destination.x, y: last.y, elevation: last.elevation });
    append(input.destination);
  }
  const length = points.slice(1).reduce((sum, p, i) => sum + separation(points[i], p), 0);
  return { ...empty, kind: status === 'reachable' ? 'complete' : 'approach', points, length,
    reason: status === 'reachable' ? 'Certified route reaches the exact destination under the selected square envelope.' : `Certified approach only; the destination remains ${status}. The stopping point is the nearest certified grid position, not an exact obstacle boundary. ${input.reason}` };
}

export function traversalIsCurrent(path: Traversal, scene: Scene, profile: Profile, scenario?: Scenario): boolean {
  return path.traversalVersion === TRAVERSAL_VERSION && path.solverHash === SOLVER_HASH && path.sceneHash === contentHash(scene)
    && path.profileHash === contentHash(profile)
    && path.scenarioHash === contentHash(scenario?.operations.length ? scenario : null)
    && (!scenario || (scenario.baseSceneHash === path.sceneHash && scenario.profileHash === path.profileHash && scenario.solverHash === path.solverHash));
}

export type TraversalPose = TraversalPoint & { distance: number; heading: number };
/** Metres along a certified polyline; heading is illustrative, never an envelope rotation. */
export function sampleTraversal(path: Traversal, requestedDistance: number): TraversalPose | null {
  if (path.traversalVersion !== TRAVERSAL_VERSION || path.kind === 'unavailable' || !path.points.length || !Number.isFinite(requestedDistance)) return null;
  if (!Number.isFinite(path.length) || path.length < 0 || path.points.some(p => ![p.x,p.y,p.elevation].every(Number.isFinite))) return null;
  const segments = path.points.slice(1).map((b, i) => {
    const a = path.points[i];
    if (a.elevation !== b.elevation || (a.x !== b.x && a.y !== b.y)) return null;
    return { a, b, length: separation(a,b) };
  });
  if (segments.some(segment => segment === null)) return null;
  const total = segments.reduce((sum, segment) => sum + segment!.length, 0);
  if (Math.abs(total-path.length) > 1e-8) return null;
  const distance = Math.max(0, Math.min(total, requestedDistance));
  let remaining = distance, heading = 0;
  for (const segment of segments) {
    const { a, b, length } = segment!;
    if (!length) continue;
    heading = Math.atan2(b.y-a.y, b.x-a.x);
    if (remaining < length) {
      const t = remaining/length;
      return { x: a.x+(b.x-a.x)*t, y: a.y+(b.y-a.y)*t, elevation: a.elevation, distance, heading };
    }
    remaining -= length;
  }
  return { ...point(path.points[path.points.length-1]), distance, heading };
}

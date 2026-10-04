/** What SAM 3 marks on a photo, by kind: the kinds that can be barriers first, then the ground around them. */
export type MarkKind = 'steps' | 'kerb' | 'broken' | 'bollard' | 'footway' | 'cobblestones' | 'road' | 'crossing';
export const MARK_ORDER: readonly MarkKind[] = ['steps', 'kerb', 'broken', 'bollard', 'crossing', 'footway', 'cobblestones', 'road'];
/** Kinds drawn in the clay family; the rest take quiet hues. */
export const BARRIER_KINDS: ReadonlySet<MarkKind> = new Set(['steps', 'kerb', 'broken', 'bollard']);

/** The kind of a finding's concept as the place package names it ('steps', 'highway=steps', 'kerb', 'pavement', ...). */
export function markOf(concept: string): MarkKind | null {
  const c = concept.toLowerCase();
  if (/steps|stair/.test(c)) return 'steps';
  if (/kerb|curb/.test(c)) return 'kerb';
  if (/crossing|zebra/.test(c)) return 'crossing';
  if (/cobble|sett/.test(c)) return 'cobblestones';
  if (/broken|crack|pothole/.test(c)) return 'broken';
  if (/bollard|post/.test(c)) return 'bollard';
  if (/footway|sidewalk|pavement|pedestrian/.test(c)) return 'footway';
  if (/road|street|carriageway/.test(c)) return 'road';
  return null;
}

/** What SAM 3 marks on a photo, by kind: the kinds that can be barriers first, then the street around them. */
export type MarkKind = 'steps' | 'kerb' | 'broken' | 'bollard' | 'footway' | 'cobblestones' | 'road' | 'crossing';
export const MARK_ORDER: readonly MarkKind[] = ['steps', 'kerb', 'broken', 'crossing', 'bollard', 'footway', 'cobblestones', 'road'];
/** Kinds drawn in the clay family, as the place package counts them; the rest take quiet hues. */
export const BARRIER_KINDS: ReadonlySet<MarkKind> = new Set(['steps', 'kerb', 'broken']);

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

/** Every kind a place can name, each with its own hue (--kind-<kind> in src/style.css): the photo kinds, then what a place's map adds. */
export type Kind = MarkKind | 'steep' | 'gate' | 'handrail' | 'ramp' | 'bench' | 'lighting' | 'toilets';
export const KIND_ORDER: readonly Kind[] = ['steps', 'kerb', 'broken', 'steep', 'bollard', 'gate', 'handrail', 'ramp', 'bench', 'lighting', 'toilets', 'crossing', 'cobblestones', 'footway', 'road'];
/** Ground kinds: drawn dashed and quieter (--dash-<kind>). */
export const GROUND_KINDS: ReadonlySet<Kind> = new Set(['crossing', 'cobblestones', 'footway', 'road']);

/** The kind of a concept or a map tag, such as 'handrail=yes', 'ramp', 'highway=street_lamp' or 'steps'. */
export function kindOf(concept: string): Kind | null {
  const c = concept.toLowerCase();
  if (/handrail|railing/.test(c)) return 'handrail';
  if (/ramp/.test(c)) return 'ramp';
  if (/steep|incline|slope/.test(c)) return 'steep';
  if (/gate|turnstile/.test(c)) return 'gate';
  if (/bench|seat/.test(c)) return 'bench';
  if (/lamp|light/.test(c)) return 'lighting';
  if (/toilet|restroom|\bwc\b/.test(c)) return 'toilets';
  return markOf(c);
}

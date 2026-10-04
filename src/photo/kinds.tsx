import { iconOfKind, type IconProps } from '../ui/icons';
import { GROUND_KINDS, kindOf as kindOfConcept } from '../ui/kinds';

/** Ground kinds: they describe the street, never a barrier, so their lines are dashed and quiet. */
export const GROUND: ReadonlySet<string> = GROUND_KINDS;
/** Spare hues (--kind-spare-1 to 4) for kinds no place has named; a kind keeps its spare on every photo. */
const SPARE = 4;

/** A stable key for a mark's kind, set as data-mark so the kind's hue and dash apply. */
export function kindOf(concept: string): string {
  return kindOfConcept(concept) ?? `spare-${[...concept.toLowerCase()].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % SPARE + 1}`;
}

const Dot = ({ size = 14 }: IconProps) => <svg viewBox="0 0 24 24" width={size} height={size} className="ui-icon" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="5" fill="currentColor" /></svg>;

/** The icon a chip shows for a kind; a kind with no icon shows a dot. */
export function KindIcon({ concept, size = 14 }: { concept: string; size?: number }) {
  const kind = kindOfConcept(concept), Icon = kind ? iconOfKind(kind) : Dot;
  return <Icon size={size} />;
}

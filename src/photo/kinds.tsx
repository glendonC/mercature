import type { ReactNode } from 'react';
import { iconFor, type IconProps } from '../ui/icons';
import { markOf } from '../ui/kinds';

/** The kinds the photo knows by name: the scan's eight and the ones newer places add. Anything else is keyed by its own words. */
const EXTRA: readonly [string, RegExp][] = [['handrail', /handrail|hand rail|railing/], ['ramp', /ramp/], ['gate', /gate|door/], ['bench', /bench|seat/], ['toilets', /toilet|restroom|\bwc\b/], ['steep', /steep|slope|incline/], ['lighting', /light|lamp/]];
/** Ground kinds: they describe the street, never a barrier, so their lines are dashed and quiet. */
export const GROUND: ReadonlySet<string> = new Set(['footway', 'road', 'cobblestones', 'crossing']);
/** Spare hues for kinds the photo has no name for; a kind keeps its spare on every photo. */
const SPARE = 4;

/** A stable key for a mark's kind, used for its hue, its line and its icon. */
export function kindOf(concept: string): string {
  const known = markOf(concept);
  if (known) return known;
  const c = concept.toLowerCase();
  return EXTRA.find(([, test]) => test.test(c))?.[0] ?? `spare-${[...c].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % SPARE + 1}`;
}

const glyph = (body: ReactNode) => ({ size = 14, className }: IconProps) =>
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={Math.min(2.25, Math.max(1.5, 33.6 / size))} strokeLinecap="round" strokeLinejoin="round" className={className ? `ui-icon ${className}` : 'ui-icon'} aria-hidden="true" focusable="false">{body}</svg>;
const LOCAL: Record<string, (props: IconProps) => ReactNode> = {
  handrail: glyph(<path d="M3.5 18.5 20.5 7.5M6 17v4M12.5 12.8v8.2M19 8.5v12.5" />),
  ramp: glyph(<path d="M3.5 18.5h17V8.5Z" />),
  gate: glyph(<path d="M4.5 20.5v-16M19.5 20.5v-16M4.5 8h15M4.5 16h15M9.5 8v8M14.5 8v8" />),
  bench: glyph(<path d="M3.5 10.5h17M4.5 14.5h15M6.5 14.5v4M17.5 14.5v4M6.5 10.5V7M17.5 10.5V7" />),
  toilets: glyph(<><circle cx="8" cy="5" r="1.6" /><circle cx="16" cy="5" r="1.6" /><path d="M8 8.5v12M5.5 9.5h5l-.5 6h-4ZM16 8.5v12M13.5 9.5h5l1 7h-7Z" /></>),
  steep: glyph(<path d="M3.5 19.5h17V6Z" />),
  lighting: glyph(<path d="M12 20.5V9M8.5 20.5h7M12 9c-2.5 0-4.5-1.5-4.5-3.5h9C16.5 7.5 14.5 9 12 9Z" />),
};
const MARK = glyph(<circle cx="12" cy="12" r="5" />);

/** The icon a chip shows for a kind. */
export function KindIcon({ concept, size = 14 }: { concept: string; size?: number }) {
  const Icon = iconFor(concept) ?? LOCAL[kindOf(concept)] ?? MARK;
  return <Icon size={size} />;
}

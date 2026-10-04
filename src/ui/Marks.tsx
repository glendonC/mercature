import type { ReactNode } from 'react';
import { cx } from './cx';
import type { MarkKind } from './kinds';

/** A short label: a language, an 'Example', a state. Dashed means made up. */
export function Tag({ tone = 'neutral', children, className, lang, title }: { tone?: 'neutral' | 'solid' | 'example' | 'route' | 'barrier' | 'unknown'; children: ReactNode; className?: string; lang?: string; title?: string }) {
  return <span className={cx('ui-tag', className)} data-tone={tone} lang={lang} title={title}>{children}</span>;
}

/** A visitor's own words, set off by a hairline rule. */
export function Quote({ children, lang, className }: { children: ReactNode; lang?: string; className?: string }) {
  return <blockquote className={cx('ui-quote', className)} lang={lang}>{children}</blockquote>;
}

/** Text the app made from its templates, such as a reply or the route note, in a soft box. */
export function Callout({ children, lang, className }: { children: ReactNode; lang?: string; className?: string }) {
  return <p className={cx('ui-callout', className)} lang={lang}>{children}</p>;
}

/** A key that does the same thing, hidden on touch screens. 'decorative' keeps it out of a button's name, where aria-keyshortcuts says it instead. */
export function Kbd({ children, decorative }: { children: ReactNode; decorative?: boolean }) {
  return <kbd className="ui-kbd" aria-hidden={decorative || undefined}>{children}</kbd>;
}

/**
 * The legend's marks, drawn as the map and the photo draw them:
 * route, the walk in blue; possible, a possible barrier in clay; added, a spot she added; fixed, recorded as open;
 * removed, dismissed in grey; no-photos, a stretch without photos; landmark; outline, a model outline on a photo;
 * mark, any other mark on a photo; selected, the ink outline with a white halo.
 * The outlines on a photo itself, with their chips, are drawn by LabelledPhoto in src/photo.
 */
export type SwatchKind = 'route' | 'possible' | 'added' | 'fixed' | 'removed' | 'no-photos' | 'landmark' | 'outline' | 'mark' | 'selected';
export function Swatch({ kind, mark, barrier, className }: { kind: SwatchKind; mark?: MarkKind; barrier?: boolean; className?: string }) {
  return <span className={cx('ui-swatch', className)} data-kind={kind} data-mark={mark} data-barrier={barrier || undefined} aria-hidden="true" />;
}

/** A row of swatches with their words. A photo mark takes its kind's hue: { mark: 'cobblestones', icon, label }. */
export type LegendItem = { kind?: SwatchKind; mark?: MarkKind; barrier?: boolean; label: ReactNode; icon?: ReactNode };
export function Legend({ items, label, className }: { items: readonly LegendItem[]; label?: string; className?: string }) {
  return <ul className={cx('ui-legend', className)} aria-label={label}>
    {items.map((item, index) => <li key={index}><Swatch kind={item.kind ?? 'mark'} mark={item.mark} barrier={item.barrier} />{item.icon}<span>{item.label}</span></li>)}
  </ul>;
}

export type MarkTone = 'barrier' | 'route' | 'unknown' | 'ink';

/** A spot's glyph on the map: its kind as an icon in its meaning's colour. A white ring keeps it off the map; selected adds the ink outline and white halo. */
export function MarkerBadge({ icon, tone = 'barrier', selected, quiet, count, className }: { icon: ReactNode; tone?: MarkTone; selected?: boolean; quiet?: boolean; count?: number; className?: string }) {
  return <span className={cx('ui-marker', className)} data-tone={tone} data-selected={selected || undefined} data-quiet={quiet || undefined} aria-hidden="true">
    {icon}
    {count ? <span className="ui-marker-count">{count}</span> : null}
  </span>;
}

/** Words on the map, beside a marker: a short title and a smaller meta line, lifted off the map by a halo. */
export function MapLabel({ title, meta, icon, tone, selected, className }: { title: ReactNode; meta?: ReactNode; icon?: ReactNode; tone?: MarkTone; selected?: boolean; className?: string }) {
  return <span className={cx('ui-map-label', className)} data-selected={selected || undefined}>
    {icon && <MarkerBadge icon={icon} tone={tone} selected={selected} />}
    <span className="ui-map-text">
      <span className="ui-map-title">{title}</span>
      {meta && <span className="ui-map-meta">{meta}</span>}
    </span>
  </span>;
}

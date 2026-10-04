import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx, type Tone } from './cx';

type PanelProps = HTMLAttributes<HTMLElement> & {
  /** Light glass by default; charcoal for a dark surface. */
  tone?: Tone;
  /** 'card' is the small card anchored to a spot on the map. */
  size?: 'panel' | 'card';
  /** On a phone, the panel becomes a bottom sheet. */
  phone?: 'sheet';
  /** Scrolls inside its own height. */
  scroll?: boolean;
  /** Fades and lifts in when it mounts. */
  enter?: boolean;
  as?: 'aside' | 'section' | 'div';
};

/** A compact glass panel over the map. */
export const Panel = forwardRef<HTMLElement, PanelProps>(function Panel({ tone, size, phone, scroll, enter, as: Tag = 'section', className, children, ...rest }, ref) {
  return <Tag ref={ref as never} className={cx('ui-panel', className)} data-tone={tone === 'dark' ? 'dark' : undefined} data-size={size === 'card' ? 'card' : undefined}
    data-phone={phone} data-scroll={scroll || undefined} data-enter={enter || undefined} {...rest}>{children}</Tag>;
});

/** A panel's first line: a title, a short meta line, and its own controls at the end. */
export function PanelHead({ title, meta, leading, actions, as: Heading = 'h2', className }: { title: ReactNode; meta?: ReactNode; leading?: ReactNode; actions?: ReactNode; as?: 'h1' | 'h2' | 'h3'; className?: string }) {
  return <header className={cx('ui-panel-head', className)}>
    {leading}
    <div className="ui-panel-heading">
      <Heading className="ui-panel-title">{title}</Heading>
      {meta && <p className="ui-panel-meta">{meta}</p>}
    </div>
    {actions && <div className="ui-panel-actions">{actions}</div>}
  </header>;
}

/** A group inside a panel, with a small muted heading and an optional action at its end. Hairlines part one section from the next. */
export function Section({ title, action, children, className, label }: { title?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string; label?: string }) {
  return <section className={cx('ui-section', className)} aria-label={label}>
    {(title || action) && <div className="ui-section-head">{title ? <h3 className="ui-section-title">{title}</h3> : <span />}{action}</div>}
    {children}
  </section>;
}

/** The phone's bottom sheet: the map stays first, the sheet holds one thing at a time. */
export const Sheet = forwardRef<HTMLElement, HTMLAttributes<HTMLElement> & { tone?: Tone }>(function Sheet({ tone, className, children, ...rest }, ref) {
  return <aside ref={ref} className={cx('ui-sheet', className)} data-tone={tone === 'dark' ? 'dark' : undefined} {...rest}>
    <span className="ui-sheet-grabber" aria-hidden="true" />
    {children}
  </aside>;
});

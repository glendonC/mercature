import { Children, forwardRef, isValidElement, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';

/** Rows with a hairline between them. 'inset' starts the hairline after the icon column. */
export function List({ children, inset, label, ordered, className }: { children: ReactNode; inset?: boolean; label?: string; ordered?: boolean; className?: string }) {
  const Tag = ordered ? 'ol' : 'ul';
  return <Tag className={cx('ui-list', className)} data-inset={inset || undefined} aria-label={label}>
    {Children.map(children, child => child == null || child === false ? null : <li key={isValidElement(child) ? child.key ?? undefined : undefined}>{child}</li>)}
  </Tag>;
}

type RowProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon?: ReactNode;
  label: ReactNode;
  /** A second, muted line under the label. */
  detail?: ReactNode;
  /** Short muted text at the end: a count, a distance, a state. */
  meta?: ReactNode;
  /** Anything after the meta: a key hint, a chevron. */
  trailing?: ReactNode;
  selected?: boolean;
  /** Lets the label wrap to two lines instead of ending in an ellipsis. */
  wrap?: boolean;
  /** A row that does nothing when tapped renders as plain text. */
  static?: boolean;
};

/** One line: a small icon, a label, its meta. A button unless it is static. */
export const Row = forwardRef<HTMLButtonElement, RowProps>(function Row({ icon, label, detail, meta, trailing, selected, wrap, static: plain, className, type = 'button', ...rest }, ref) {
  const body = <>
    {icon && <span className="ui-row-icon">{icon}</span>}
    <span className="ui-row-text">
      <span className="ui-row-label">{label}</span>
      {detail && <span className="ui-row-detail">{detail}</span>}
    </span>
    {meta != null && meta !== false && <span className="ui-row-meta">{meta}</span>}
    {trailing}
  </>;
  if (plain) return <div className={cx('ui-row', className)} data-wrap={wrap || undefined}>{body}</div>;
  return <button ref={ref} type={type} className={cx('ui-row', className)} aria-pressed={selected === undefined ? undefined : selected} data-wrap={wrap || undefined} {...rest}>{body}</button>;
});

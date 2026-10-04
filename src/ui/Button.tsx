import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';
import { Kbd } from './Marks';

type Base = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  /** A key that does the same, shown only where there is a keyboard. */
  kbd?: string;
};

/** A quiet button: a label that shows a soft fill on hover. The box stays 44 px tall; the fill is 30 px. */
export const TextButton = forwardRef<HTMLButtonElement, Base & { muted?: boolean; flush?: boolean }>(function TextButton({ icon, kbd, muted, flush, className, children, type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} className={cx('ui-text-button', className)} data-muted={muted || undefined} data-flush={flush || undefined} {...rest}>
    {icon && <span className="ui-button-icon">{icon}</span>}
    <span className="ui-button-label">{children}</span>
    {kbd && <Kbd>{kbd}</Kbd>}
  </button>;
});

/** The one action a panel leads with: a slim charcoal pill. At most one per panel. */
export const PrimaryAction = forwardRef<HTMLButtonElement, Base>(function PrimaryAction({ icon, kbd, className, children, type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} className={cx('ui-primary', className)} {...rest}>
    {icon && <span className="ui-button-icon">{icon}</span>}
    <span className="ui-button-label">{children}</span>
    {kbd && <Kbd>{kbd}</Kbd>}
  </button>;
});

/** An icon with a 44 px target and a 32 px circle on hover. 'glass' floats it on the map. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; surface?: 'glass' }>(function IconButton({ label, surface, className, children, type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} className={cx('ui-icon-button', className)} aria-label={label} title={label} data-surface={surface} {...rest}>{children}</button>;
});

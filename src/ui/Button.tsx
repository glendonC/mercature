import { forwardRef, useEffect, useImperativeHandle, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';
import { Kbd } from './Marks';

/** Shortcuts a primary can carry; its key hint shows only on a screen with a keyboard, and only because the key is wired. */
export type Shortcut = 'mod+enter';
const mac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const shortcutLabel = (shortcut: Shortcut) => shortcut === 'mod+enter' ? (mac() ? '\u2318\u21b5' : 'Ctrl \u21b5') : '';
const matches = (shortcut: Shortcut, event: KeyboardEvent) => shortcut === 'mod+enter' && event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.altKey;

type Action = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { icon: ReactNode; children: ReactNode };

/**
 * Secondary: an icon and a label, quiet, a soft fill on hover. The box stays 44 px tall; the fill is 30 px.
 * 'muted' is the reset and remove kind: the same shape in muted ink (Start over, Remove, Undo, Cancel).
 */
export const TextButton = forwardRef<HTMLButtonElement, Action & { muted?: boolean }>(function TextButton({ icon, muted, className, children, type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} className={cx('ui-text-button', className)} data-muted={muted || undefined} {...rest}>
    <span className="ui-button-icon">{icon}</span>
    <span className="ui-button-label">{children}</span>
  </button>;
});

/** Primary: the one action a panel leads with, a slim charcoal pill with an icon and a label. At most one per panel. */
export const PrimaryAction = forwardRef<HTMLButtonElement, Action & { shortcut?: Shortcut }>(function PrimaryAction({ icon, shortcut, className, children, type = 'button', disabled, ...rest }, ref) {
  const own = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => own.current!, []);
  useEffect(() => {
    if (!shortcut || disabled) return;
    const press = (event: KeyboardEvent) => { if (matches(shortcut, event) && own.current?.isConnected) { event.preventDefault(); own.current.click(); } };
    window.addEventListener('keydown', press);
    return () => window.removeEventListener('keydown', press);
  }, [shortcut, disabled]);
  return <button ref={own} type={type} className={cx('ui-primary', className)} disabled={disabled} aria-keyshortcuts={shortcut === 'mod+enter' ? (mac() ? 'Meta+Enter' : 'Control+Enter') : undefined} {...rest}>
    <span className="ui-button-icon">{icon}</span>
    <span className="ui-button-label">{children}</span>
    {shortcut && <Kbd>{shortcutLabel(shortcut)}</Kbd>}
  </button>;
});

/** An icon with a 44 px target and a 32 px circle on hover. 'glass' floats it on the map or a photo, in charcoal glass. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; surface?: 'glass' }>(function IconButton({ label, surface, className, children, type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} className={cx('ui-icon-button', className)} aria-label={label} title={label} data-surface={surface} {...rest}>{children}</button>;
});

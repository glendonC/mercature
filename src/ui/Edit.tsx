import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { TextButton } from './Button';
import { cx } from './cx';
import { UndoIcon, iconOfKind } from './icons';
import type { Kind } from './kinds';

/*
 * Editing, the visible core of the map: an always-there Edit pill, a Before / Now switch beside it (Segmented surface="glass"),
 * and her changes as rows, each with its own Undo. A changed marker carries the --changed-ring and --changed-outline tokens.
 */

type GlassButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { icon: ReactNode; pressed?: boolean; children: ReactNode };
/** A pill floating over the map, in charcoal glass: an icon and a label, 36 px drawn in a 44 px target. pressed turns it white while its mode is on, such as Edit. */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton({ icon, pressed, className, children, type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} className={cx('ui-glass-button', className)} aria-pressed={pressed === undefined ? undefined : pressed} {...rest}>
    <span className="ui-button-icon">{icon}</span>
    <span className="ui-button-label">{children}</span>
  </button>;
});

type ChangeRowProps = {
  /** The kind the change is about: its icon, in its hue. */
  kind?: Kind | null;
  /** Any icon in place of a kind's, such as a street she added. */
  icon?: ReactNode;
  /** One line: what changed and where, such as "Steps, Calle Loreto: fixed". */
  label: ReactNode;
  /** Short muted words at the end, such as "340 m" or a time. */
  meta?: ReactNode;
  onUndo?: () => void;
  undoLabel: string;
  /** Opens the change on the map. */
  onOpen?: () => void;
  className?: string;
};
/** One of her changes: the kind's icon in its hue, one line, and Undo as a quiet secondary at the end. */
export function ChangeRow({ kind, icon, label, meta, onUndo, undoLabel, onOpen, className }: ChangeRowProps) {
  const Icon = kind ? iconOfKind(kind) : null;
  const body = <>
    <span className="ui-change-icon" data-mark={kind ?? undefined}>{icon ?? (Icon ? <Icon /> : null)}</span>
    <span className="ui-change-label">{label}</span>
    {meta != null && meta !== false && <span className="ui-change-meta">{meta}</span>}
  </>;
  return <div className={cx('ui-change', className)}>
    {onOpen ? <button type="button" className="ui-change-open" onClick={onOpen}>{body}</button> : <span className="ui-change-open">{body}</span>}
    {onUndo && <TextButton muted icon={<UndoIcon />} onClick={onUndo}>{undoLabel}</TextButton>}
  </div>;
}

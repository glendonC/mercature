import { forwardRef, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { Choice, Choices, Companion } from '../ui';
import './guide.css';

/** The guide itself, out in the world: the shared companion, placed by the screen beside what it talks about, talking while a page types. */
export const Bot = forwardRef<HTMLDivElement, { working?: boolean; talk?: RefObject<((talking: boolean) => void) | null>; className?: string }>(function Bot({ working = false, talk, className }, ref) {
  const [talking, setTalking] = useState(false);
  useLayoutEffect(() => { if (talk) talk.current = setTalking; }, [talk]);
  return <div ref={ref} className={className ? `guide-bot ${className}` : 'guide-bot'} aria-hidden="true"><Companion working={working} talking={talking} /></div>;
});

export type Chip = { id: string; label: string; onClick: () => void; primary?: boolean; icon?: ReactNode; disabled?: boolean; pressed?: boolean; lang?: string };

/** Her choices, stacked as a game lists them, each with the number key that picks it on a keyboard. The expected one is white. */
export function Options({ chips, label }: { chips: readonly Chip[]; label?: string }) {
  if (!chips.length) return null;
  return <Choices label={label} className="guide-choices">
    {chips.map((chip, i) => <Choice key={chip.id} lead={chip.primary} selected={chip.pressed} disabled={chip.disabled} lang={chip.lang} onClick={chip.onClick}
      aria-keyshortcuts={i < 9 ? String(i + 1) : undefined} icon={i < 9 ? <span className="guide-key" aria-hidden="true">{i + 1}</span> : chip.icon}>{chip.label}</Choice>)}
  </Choices>;
}

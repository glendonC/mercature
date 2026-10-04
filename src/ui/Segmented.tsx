import type { ReactNode } from 'react';
import { cx } from './cx';

type Option<T extends string> = { value: T; label: ReactNode; lang?: string; controls?: string };

/**
 * A choice of a few: 'track' is a slim segmented control; 'tabs' is a row of thin top tabs with an ink underline.
 * Tabs take role tab and point at the panel each one shows through controls.
 */
export function Segmented<T extends string>({ options, value, onChange, label, variant = 'track', caps, surface, className }: {
  options: readonly Option<T>[]; value: T; onChange: (value: T) => void; label: string; variant?: 'track' | 'tabs'; caps?: boolean;
  /** 'glass' floats a track over the map in charcoal glass, the state that is on a white thumb: the Before / Now switch. */
  surface?: 'glass'; className?: string;
}) {
  const tabs = variant === 'tabs';
  return <div className={cx('ui-segmented', className)} data-variant={variant} data-caps={caps || undefined} data-surface={surface} role={tabs ? 'tablist' : 'group'} aria-label={label}>
    {options.map(option => {
      const on = option.value === value;
      return <button key={option.value} type="button" className="ui-segment" lang={option.lang}
        role={tabs ? 'tab' : undefined} aria-selected={tabs ? on : undefined} aria-controls={tabs ? option.controls : undefined} aria-pressed={tabs ? undefined : on}
        tabIndex={tabs && !on ? -1 : undefined} onClick={() => onChange(option.value)}
        onKeyDown={tabs ? event => {
          if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
          const at = options.findIndex(item => item.value === value), next = options[(at + (event.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length];
          onChange(next.value);
          const sibling = event.key === 'ArrowRight' ? event.currentTarget.nextElementSibling ?? event.currentTarget.parentElement?.firstElementChild : event.currentTarget.previousElementSibling ?? event.currentTarget.parentElement?.lastElementChild;
          (sibling as HTMLElement | null)?.focus();
        } : undefined}>
        <span className="ui-button-label">{option.label}</span>
      </button>;
    })}
  </div>;
}

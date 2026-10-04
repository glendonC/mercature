import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { quiet } from './FxCanvas';
import './fx.css';

type Layer = { key: number; value: string; content: ReactNode; lang?: string };

/**
 * Text that changes in place, such as a reply when its language changes or the route note after an edit: the old words
 * fade out over the new ones fading in, and the box eases to the new height. It renders spans, so it fits inside a
 * paragraph. value is the text, or what decides that richer children changed; className styles each text layer, such as
 * a line clamp. With reduced motion the new text simply replaces the old.
 */
export default function Swap({ value, lang, className, children = value }: { value: string; lang?: string; className?: string; children?: ReactNode }) {
  const shown = useRef<Layer>({ key: 0, value, content: children, lang });
  const [key, setKey] = useState(0);
  const [leaving, setLeaving] = useState<Layer[]>([]);
  // Before paint: a new value takes a new layer, and the one it replaces stays a moment to fade out.
  useLayoutEffect(() => {
    const old = shown.current;
    if (old.value === value) { shown.current = { ...old, content: children, lang }; return; }
    shown.current = { key: old.key + 1, value, content: children, lang };
    setKey(old.key + 1);
    if (!quiet()) setLeaving(list => [old, ...list].slice(0, 2));
  });

  // The box holds the shown text's height, so a change of height eases instead of jumping.
  const inner = useRef<HTMLSpanElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = inner.current;
    if (!element) return;
    const measure = () => setHeight(element.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [key]);

  return <span className="fx-swap" style={height == null ? undefined : { height }}>
    <span key={key} ref={inner} className={className ? `fx-swap-now ${className}` : 'fx-swap-now'} lang={lang} data-in={key > 0 || undefined}>{children}</span>
    {leaving.map(layer => <span key={layer.key} className={className ? `fx-swap-old ${className}` : 'fx-swap-old'} lang={layer.lang} aria-hidden="true"
      onAnimationEnd={event => { if (event.target === event.currentTarget) setLeaving(list => list.filter(item => item.key !== layer.key)); }}>{layer.content}</span>)}
  </span>;
}

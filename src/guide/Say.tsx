import { forwardRef, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { GuideAvatar } from '../components/Companion';
import { EnterIcon } from '../ui/icons';
import './guide.css';

const quiet = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Milliseconds per character as a line types in, and the most a whole line takes however long it is. */
const PER_CHAR = 16, MOST = 1100;

// The part of a line not typed yet is painted clear through one shared highlight, so its words never change in the page:
// the line has its final size from the first frame, and a screen reader hears it once, whole.
let untyped: Highlight | null = null;
function untypedHighlight(): Highlight | null {
  if (untyped) return untyped;
  if (typeof CSS === 'undefined' || !('highlights' in CSS) || typeof Highlight === 'undefined') return null;
  untyped = new Highlight();
  CSS.highlights.set('guide-untyped', untyped);
  return untyped;
}

/**
 * What the guide says: one clean line at the bottom of the screen, as a game shows its dialogue, white on charcoal glass.
 * New words type in quickly; with reduced motion, or where the browser cannot paint a highlight, they show at once.
 * live: the line is announced when its words change.
 */
export function Line({ lines, lang, live = true, className }: { lines: readonly string[]; lang?: string; live?: boolean; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const text = lines.join('\n');
  useLayoutEffect(() => {
    const element = box.current, highlight = untypedHighlight();
    if (!element || !highlight || quiet()) return;
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if ((node as Text).length) nodes.push(node as Text);
    const total = nodes.reduce((sum, node) => sum + node.length, 0);
    if (!total) return;
    const range = new Range(), last = nodes[nodes.length - 1];
    range.setStart(nodes[0], 0); range.setEnd(last, last.length);
    highlight.add(range);
    const per = Math.min(PER_CHAR, MOST / total), began = performance.now();
    let frame = 0;
    // A page that is not painting gets no frames: the whole line shows by MOST regardless.
    const done = window.setTimeout(() => { cancelAnimationFrame(frame); highlight.delete(range); }, MOST + 150);
    const type = () => {
      let typed = Math.max(0, Math.floor((performance.now() - began) / per));
      if (typed >= total) { highlight.delete(range); clearTimeout(done); return; }
      for (const node of nodes) { if (typed <= node.length) { range.setStart(node, typed); break; } typed -= node.length; }
      frame = requestAnimationFrame(type);
    };
    frame = requestAnimationFrame(type);
    return () => { cancelAnimationFrame(frame); clearTimeout(done); highlight.delete(range); };
  }, [text]);
  return <div ref={box} className={className ? `guide-line ${className}` : 'guide-line'} lang={lang} role={live ? 'status' : undefined} aria-live={live ? 'polite' : undefined}>
    {lines.map((line, i) => <p key={i}>{line}</p>)}
  </div>;
}

/** The guide itself, out in the world: the grey avatar on its own, placed by the screen beside what it is talking about. */
export const Bot = forwardRef<HTMLDivElement, { working?: boolean; size?: number; className?: string; style?: CSSProperties }>(function Bot({ working = false, size = 52, className, style }, ref) {
  return <div ref={ref} className={className ? `guide-bot ${className}` : 'guide-bot'} style={style} aria-hidden="true"><GuideAvatar size={size} working={working} /></div>;
});

export type Chip = { id: string; label: string; onClick: () => void; primary?: boolean; icon?: ReactNode; disabled?: boolean; pressed?: boolean; lang?: string };

/** Her choices, stacked as a game lists them, each with the number key that picks it. The expected one is white. */
export function Choices({ chips, label, keys = true }: { chips: readonly Chip[]; label?: string; keys?: boolean }) {
  if (!chips.length) return null;
  return <div className="guide-choices" role="group" aria-label={label}>
    {chips.map((chip, i) => <button key={chip.id} type="button" className="guide-choice" data-primary={chip.primary || undefined} aria-pressed={chip.pressed}
      disabled={chip.disabled} lang={chip.lang} onClick={chip.onClick} aria-keyshortcuts={keys && i < 9 ? String(i + 1) : undefined}>
      {keys && i < 9 && <span className="guide-key" aria-hidden="true">{i + 1}</span>}{chip.icon}<span className="guide-choice-label">{chip.label}</span>
    </button>)}
  </div>;
}

/** Her own words: one line, sent with the button inside the field. */
export function Words({ placeholder, send, onSend, disabled = false, lang }: { placeholder: string; send: string; onSend: (text: string) => void; disabled?: boolean; lang?: string }) {
  const [text, setText] = useState('');
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const words = text.trim();
    if (!words || disabled) return;
    setText(''); onSend(words);
  };
  return <form className="guide-words" onSubmit={submit}>
    <input className="guide-words-field" value={text} maxLength={300} placeholder={placeholder} aria-label={placeholder} lang={lang} enterKeyHint="send" onChange={event => setText(event.target.value)} />
    <button type="submit" className="guide-words-send" aria-label={send} disabled={!text.trim() || disabled}><EnterIcon size={18} /></button>
  </form>;
}

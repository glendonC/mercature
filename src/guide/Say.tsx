import { forwardRef, useLayoutEffect, useRef, type ReactNode } from 'react';
import { GuideAvatar } from '../components/Companion';
import { Choice, Choices, Companion } from '../ui';
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
 * The guide's words inside the shared Dialogue: new words type in quickly, within 1.1 s; with reduced motion, or where the
 * browser cannot paint a highlight, they show at once. The Dialogue announces them.
 */
export function Typed({ lines, lang }: { lines: readonly string[]; lang?: string }) {
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
  return <div ref={box} className="guide-typed" lang={lang}>{lines.map((line, i) => <p key={i}>{line}</p>)}</div>;
}

/** The guide itself, out in the world: the avatar in the shared companion disc, placed by the screen beside what it talks about. */
export const Bot = forwardRef<HTMLDivElement, { working?: boolean; className?: string }>(function Bot({ working = false, className }, ref) {
  return <div ref={ref} className={className ? `guide-bot ${className}` : 'guide-bot'} aria-hidden="true"><Companion working={working}><GuideAvatar size={36} working={working} /></Companion></div>;
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

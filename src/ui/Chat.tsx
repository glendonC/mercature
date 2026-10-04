import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type ReactNode, type RefObject } from 'react';
import { BotAvatar } from 'bot-avatars';
import { PrimaryAction, TextButton } from './Button';
import { cx } from './cx';
import { CheckIcon, CopyIcon, SendIcon } from './icons';

/*
 * The guide's dialogue, as a game shows it: one clean line on its own at the bottom of the screen, charcoal glass and white words,
 * with her own words' field under it. The guide itself floats in the map beside what it talks about (Companion), and her choices
 * are their own list beside the photo or message they act on (Choices). One hierarchy: the line leads; at most one muted meta line.
 */

type DialogueProps = {
  /** Words to page and type in, as a game shows dialogue: pages of at most two lines, split by sentence and never mid-word.
   *  Each page types in within 1.1 s; a tap, Enter or Space completes a page, then turns to the next; a small mark shows when more follows.
   *  A line that starts with PAGE_BREAK ('\f') always opens its own page. Leave it out to show children as they are. */
  say?: string | readonly string[];
  /** True while a page types in, false once it is whole: give it to the Companion as talking. */
  onTalking?: (talking: boolean) => void;
  /** Called once the last page is whole. */
  onDone?: () => void;
  /** The continue mark's name for screen readers, such as "More". */
  continueLabel?: string;
  /** Turn pages by themselves, this many ms after each is whole, for a screen that runs on its own timer. A tap still turns at once. */
  advanceAfter?: number;
  /** Anything after the words, such as a plain error line. */
  children?: ReactNode;
  /** One short muted line above the words, such as "2 of 8". */
  meta?: ReactNode;
  /** Her own words: a Composer, under the line. */
  composer?: ReactNode;
  /** A step back: a GlassCircle with BackIcon. It hangs at the dialogue's left, level with its last row, so the line stays centred; on a phone it takes the row's start. Leave it out when there is nothing to go back to. */
  back?: ReactNode;
  /** Quiet secondary actions inside the line, at its end, such as "Skip for now": TextButton muted. */
  actions?: ReactNode;
  /** The guide is working, as while the model reads a message: three dots in place of the words. Never a pause put on for show. */
  working?: boolean;
  /** The dots' name for screen readers, such as "Reading". */
  workingLabel?: string;
  /** The region's name, such as "Guide". */
  label: string;
  lang?: string;
  className?: string;
};

const PER_CHAR = 16, MOST = 1100, LINES = 2;
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Sentences, each with its closing mark, so a page never ends mid-sentence when it can help it. */
function sentencesOf(text: string) {
  return (text.match(/[^.!?。！？]+(?:[.!?。！？]+["”’')\]]*|$)/g) ?? [text]).map(part => part.trim()).filter(Boolean);
}
/** The lines words wrap into at a width, between words as the browser does. */
function wrapped(text: string, width: number, measure: (s: string) => number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > width) { lines.push(line); line = word; } else line = next;
  }
  lines.push(line);
  return lines;
}
const linesOf = (text: string, width: number, measure: (s: string) => number) => wrapped(text, width, measure).length;
/** A page break the words force: a line that starts with it (or any text after it) always opens a new page, never joined to the page before. It is never shown. */
export const PAGE_BREAK = '\f';

/**
 * Pages of at most two lines at a width: whole sentences where they fit, a long sentence cut between words.
 * A PAGE_BREAK starts a new page wherever it stands, so a line can stand alone, such as a payoff before the next question.
 */
export function paginate(say: string | readonly string[], width: number, measure: (s: string) => number, most = LINES): string[] {
  const blocks: string[][] = [[]];
  for (const item of typeof say === 'string' ? [say] : say) item.split(PAGE_BREAK).forEach((part, index) => {
    if (index > 0 && blocks[blocks.length - 1].length) blocks.push([]);
    if (part.trim()) blocks[blocks.length - 1].push(part);
  });
  const pages = blocks.flatMap(block => block.length ? pagesOf(block, width, measure, most) : []);
  return pages.length ? pages : [''];
}

function pagesOf(say: readonly string[], width: number, measure: (s: string) => number, most: number): string[] {
  const pages: string[] = [];
  let page = '';
  const fits = (text: string) => linesOf(text, width, measure) <= most;
  // A sentence that fits joins the page; a longer one is laid out by clause, and a clause too long for a page by word
  const add = (piece: string, split: (piece: string) => string[] | null) => {
    const joined = page ? `${page} ${piece}` : piece;
    if (fits(joined)) { page = joined; return; }
    const parts = split(piece);
    if (parts) { for (const part of parts) add(part, words); return; }
    if (page) pages.push(page);
    page = piece;
  };
  const words = (piece: string) => { const all = piece.split(/\s+/); return all.length > 1 && !fits(piece) ? all : null; };
  const clauses = (piece: string) => { const all = piece.split(/(?<=[,;:])\s+/); return all.length > 1 ? all : words(piece); };
  for (const sentence of say.flatMap(sentencesOf)) {
    if (page && !fits(`${page} ${sentence}`) && fits(sentence)) { pages.push(page); page = sentence; continue; }
    add(sentence, clauses);
  }
  if (page) pages.push(page);
  return pages;
}

/** The box is narrower than its pages were laid out for: the line overflows its section, or a page asks for more room than the line has. */
function narrower(line: HTMLElement, section: HTMLElement) {
  const page = line.querySelector<HTMLElement>('.ui-dialogue-page'), room = page?.parentElement?.clientWidth ?? Infinity;
  return line.getBoundingClientRect().width > section.clientWidth + 1 || (page ? parseFloat(page.style.width) > room + 1 : false);
}

/** The pages of words for the dialogue's current width, measured in its own font, and each page's widest line, so the box fits its words exactly. */
function usePages(say: string | readonly string[] | undefined, box: RefObject<HTMLElement | null>) {
  const key = say === undefined ? '' : typeof say === 'string' ? say : say.join('\n');
  const [laid, setLaid] = useState<{ pages: string[]; widths: number[] }>({ pages: [], widths: [] });
  useLayoutEffect(() => {
    if (say === undefined) return;
    const context = document.createElement('canvas').getContext('2d');
    // A screen may make the dialogue narrower than the default (Home leaves room for the bot beside it): once its words overflow the box, the box's own width rules
    let cap = Infinity;
    const run = () => {
      const element = box.current;
      const section = element?.parentElement;
      if (element && section && narrower(element, section)) cap = Math.min(section.clientWidth, Math.round(element.getBoundingClientRect().width));
      if (!element || !context) { setLaid({ pages: (typeof say === 'string' ? [say] : [...say]).flatMap(item => item.split(PAGE_BREAK)).map(item => item.trim()).filter(Boolean), widths: [] }); return; }
      const style = getComputedStyle(element), narrow = matchMedia('(max-width: 640px)').matches;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const measure = (text: string) => context.measureText(text).width;
      const outer = Math.min(cap, narrow ? innerWidth - 32 : Math.min(640, innerWidth - 48));
      // Room for the words: the box less its padding at both ends and the continue mark's room
      const width = outer - 2 * parseFloat(style.paddingLeft) - 26 - 4;
      const pages = paginate(say, width, measure);
      const widths = pages.map(page => Math.ceil(Math.max(...wrapped(page, width, measure).map(measure))) + 2);
      setLaid(previous => previous.pages.join('\u0000') === pages.join('\u0000') && previous.widths.join() === widths.join() ? previous : { pages, widths });
    };
    run();
    document.fonts?.ready.then(run).catch(() => undefined);
    const resize = () => { cap = Infinity; run(); };
    const fit = new ResizeObserver(() => { const element = box.current, section = element?.parentElement; if (element && section && narrower(element, section)) run(); });
    if (box.current?.parentElement) fit.observe(box.current.parentElement);
    if (box.current) fit.observe(box.current);
    addEventListener('resize', resize);
    return () => { removeEventListener('resize', resize); fit.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return laid;
}

/** The bottom dialogue: always in the same place, centred, as wide as its words between 280 and 640 px, clear of the home indicator and a landscape notch. */
export function Dialogue({ say, onTalking, onDone, continueLabel, advanceAfter, children, meta, composer, back, actions, working, workingLabel, label, lang, className }: DialogueProps) {
  const line = useRef<HTMLDivElement>(null);
  const { pages, widths } = usePages(say, line);
  const [at, setAt] = useState(0);
  const [shown, setShown] = useState(0);
  const page = pages[Math.min(at, pages.length - 1)] ?? '';
  const paged = say !== undefined && !working;
  const typing = paged && shown < page.length;
  const more = paged && at < pages.length - 1;
  useEffect(() => { setAt(0); }, [pages]);
  useLayoutEffect(() => {
    if (!paged) return;
    if (reduced()) { setShown(page.length); return; }
    setShown(0);
    const per = Math.min(PER_CHAR, MOST / Math.max(1, page.length)), began = performance.now();
    let frame = 0;
    const step = () => { const typed = Math.floor((performance.now() - began) / per); setShown(Math.min(typed, page.length)); if (typed < page.length) frame = requestAnimationFrame(step); };
    frame = requestAnimationFrame(step);
    // A page that is not painting gets no frames: it shows whole by MOST regardless.
    const whole = window.setTimeout(() => setShown(page.length), MOST + 150);
    return () => { cancelAnimationFrame(frame); clearTimeout(whole); };
  }, [paged, page]);
  const talk = useRef(onTalking); talk.current = onTalking;
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => { talk.current?.(typing); }, [typing]);
  useEffect(() => () => talk.current?.(false), []);
  useEffect(() => { if (paged && !typing && !more && page) done.current?.(); }, [paged, typing, more, page]);
  const next = () => { if (typing) setShown(page.length); else if (more) setAt(index => index + 1); };
  useEffect(() => {
    if (advanceAfter === undefined || typing || !more) return;
    const turn = window.setTimeout(() => setAt(index => index + 1), advanceAfter);
    return () => clearTimeout(turn);
  }, [advanceAfter, typing, more, at]);
  const nextRef = useRef(next); nextRef.current = next;
  useEffect(() => {
    if (!paged || (!typing && !more)) return;
    const key = (event: KeyboardEvent) => {
      if ((event.key !== 'Enter' && event.key !== ' ') || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, a, [contenteditable=true], [role=button]')) return;
      event.preventDefault();
      nextRef.current();
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [paged, typing, more]);
  return <section className={cx('ui-dialogue', className)} aria-label={label} data-tone="dark">
    <div ref={line} className="ui-dialogue-line" lang={lang} aria-live="polite" data-working={working || undefined} data-paged={paged || undefined}
      data-more={more || undefined} data-advance={typing || more || undefined} onClick={paged ? next : undefined}>
      {working
        ? <span className="ui-typing" role={workingLabel ? 'img' : undefined} aria-label={workingLabel} aria-hidden={workingLabel ? undefined : true}><i /><i /><i /></span>
        : <>
          {meta != null && meta !== false && <p className="ui-dialogue-meta">{meta}</p>}
          <div className="ui-dialogue-text">
            {paged && <p className="ui-dialogue-page" style={widths[at] ? { width: widths[at] } : undefined}><span aria-hidden="true">{page.slice(0, shown)}<span className="ui-untyped">{page.slice(shown)}</span></span><span className="sr-only">{page}</span></p>}
            {children}
          </div>
          {actions && !more && <div className="ui-dialogue-actions" onClick={event => event.stopPropagation()}>{actions}</div>}
          {more && !typing && <button type="button" className="ui-dialogue-more" aria-label={continueLabel} title={continueLabel} onClick={event => { event.stopPropagation(); next(); }}><span /></button>}
        </>}
    </div>
    {back && <div className="ui-dialogue-back">{back}</div>}
    {composer && <div className="ui-dialogue-row">{composer}</div>}
  </section>;
}

type CompanionProps = { children?: ReactNode; working?: boolean; talking?: boolean; /** happy: a smile, only on good news (her change saved, a reply ready, the walk checked) */ mood?: 'happy'; /** px; --companion by default */ size?: number; className?: string; style?: CSSProperties };
/**
 * The guide itself, on screen all the time: the bot floating free where the screen places it (64 px, 52 on a phone; --companion), never on the dialogue.
 * Its face follows what it really does, never at random: idle, eyes only (it looks around and blinks); talking while a page types, eyes and a light bob;
 * working only while something real runs (the model reading, the map service, a route being found), with a thin arc; mood="happy" smiles, and only on good news.
 * Working never shows the mouth, so the library's wide working grin never appears.
 * Leave children out for the guide's own bot.
 */
export function Companion({ children, working, talking, mood, size, className, style }: CompanionProps) {
  const [color] = useState(() => (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue('--field').trim()) || 'gray');
  return <span className={cx('ui-companion', className)} data-working={working || undefined} data-talking={talking || undefined} style={style} aria-hidden="true">
    <span className="ui-companion-bot">{children ?? <BotAvatar type="blob" state={working ? 'working' : 'default'} face={mood === 'happy' && !working ? 'mouth' : 'eyes'} size={size ?? 'var(--companion)'} color={color}
      shading="plastic" speed={0.4} turn={0.25} jumpEvery={0} interactive={false} saturation={1} theme="light" />}</span>
  </span>;
}

/** Her choices, as their own list beside the photo or message they act on. At most one lead: the answer the guide expects, as a white pill. */
export function Choices({ label, children, className }: { label?: string; children: ReactNode; className?: string }) {
  return <div className={cx('ui-choices', className)} role="group" aria-label={label}>{children}</div>;
}

type ChoiceProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { icon?: ReactNode; lead?: boolean; selected?: boolean; children: ReactNode };
/** One choice: a 40 px charcoal pill in a 44 px target, an icon and words. lead is the expected answer; selected marks the one she gave. */
export const Choice = forwardRef<HTMLButtonElement, ChoiceProps>(function Choice({ icon, lead, selected, className, children, type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} className={cx('ui-choice', className)} data-lead={lead || undefined} aria-pressed={selected === undefined ? undefined : selected} {...rest}>
    {icon && <span className="ui-button-icon">{icon}</span>}
    <span className="ui-button-label">{children}</span>
  </button>;
});

type ComposerProps = {
  /** The field's name for screen readers, such as "In your words"; also its placeholder unless one is given. */
  label: string;
  placeholder?: string;
  /** The send button's name, such as "Send". */
  sendLabel: string;
  onSend: (text: string) => void;
  /** Controlled text. Leave it out and the field keeps its own, cleared after each send. */
  value?: string;
  onChange?: (text: string) => void;
  disabled?: boolean;
  lang?: string;
  maxLength?: number;
  autoFocus?: boolean;
  className?: string;
};

/** Her own words: a field that grows to five lines, with its send action inside it. Enter sends, Shift+Enter starts a new line, and an input method's Enter never sends. */
export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer({ label, placeholder, sendLabel, onSend, value, onChange, disabled, lang, maxLength, autoFocus, className }, ref) {
  const field = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => field.current!, []);
  const [own, setOwn] = useState('');
  const text = value ?? own;
  const ready = !disabled && text.trim().length > 0;
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [text]);
  const change = (next: string) => { if (value === undefined) setOwn(next); onChange?.(next); };
  const send = () => {
    if (!ready) return;
    onSend(text.trim());
    if (value === undefined) setOwn('');
  };
  return <form className={cx('ui-composer', className)} data-disabled={disabled || undefined} onSubmit={event => { event.preventDefault(); send(); }}>
    <textarea ref={field} className="ui-composer-field" rows={1} value={text} lang={lang} maxLength={maxLength} autoFocus={autoFocus} disabled={disabled}
      aria-label={label} placeholder={placeholder ?? label} enterKeyHint="send"
      onChange={event => change(event.target.value)}
      onKeyDown={event => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        send();
      }} />
    <button type="submit" className="ui-composer-send" aria-label={sendLabel} title={sendLabel} disabled={!ready}><SendIcon /></button>
  </form>;
});

type CopyBoxProps = {
  /** The words to copy, exactly. */
  text: string;
  /** What shows, when it differs from the text; the text by default. */
  children?: ReactNode;
  copyLabel: string;
  copiedLabel: string;
  /** Short muted words at the start of the box's last line, such as a language or "Machine-translated". */
  meta?: ReactNode;
  /** Copying is the screen's one primary action: a slim pill instead of a quiet button. */
  lead?: boolean;
  lang?: string;
  onCopy?: () => void;
  className?: string;
};

/** Words she can copy, with the Copy action inside the box. Long words scroll inside it, faded at the clipped edge. If the clipboard refuses, the words are selected so she can copy them herself. */
export function CopyBox({ text, children, copyLabel, copiedLabel, meta, lead, lang, onCopy, className }: CopyBoxProps) {
  const [copied, setCopied] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    if (!await copyText(text)) { selectContents(body.current); return; }
    setCopied(true);
    onCopy?.();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };
  const Action = lead ? PrimaryAction : TextButton;
  return <div className={cx('ui-copy-box', className)}>
    <ScrollFade ref={body} className="ui-copy-text" lang={lang}>{children ?? text}</ScrollFade>
    <div className="ui-copy-foot">
      {meta ? <span className="ui-copy-meta">{meta}</span> : <span />}
      <Action icon={copied ? <CheckIcon /> : <CopyIcon />} onClick={copy}>{copied ? copiedLabel : copyLabel}</Action>
    </div>
    <span className="sr-only" role="status">{copied ? copiedLabel : ''}</span>
  </div>;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const focused = document.activeElement as HTMLElement | null;
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.append(area);
    area.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch { done = false; }
    area.remove();
    focused?.focus();
    return done;
  }
}

function selectContents(node: HTMLElement | null) {
  const selection = node && getSelection();
  if (!node || !selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Marks a scroll box while there is more to scroll each way (data-more-start, data-more-end); the CSS fades that edge.
 * follow keeps the newest content in view while she is at the end, and leaves her where she is once she scrolls back.
 */
export function useScrollFade(ref: RefObject<HTMLElement | null>, { follow = false, axis = 'y' }: { follow?: boolean; axis?: 'x' | 'y' } = {}) {
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    let atEnd = true, following = 0, frame = 0;
    const measure = () => {
      const at = axis === 'y' ? box.scrollTop : Math.abs(box.scrollLeft);
      const room = (axis === 'y' ? box.scrollHeight - box.clientHeight : box.scrollWidth - box.clientWidth) - at;
      box.toggleAttribute('data-more-start', at > 1);
      box.toggleAttribute('data-more-end', room > 1);
      if (!following) atEnd = room < 48;
    };
    const changed = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (follow && atEnd && box.scrollHeight - box.clientHeight - box.scrollTop > 1) {
          const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
          window.clearTimeout(following);
          following = window.setTimeout(() => { following = 0; measure(); }, instant ? 0 : 480);
          box.scrollTo({ top: box.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
        }
        measure();
      });
    };
    const sizes = new ResizeObserver(changed);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(box);
      for (const child of Array.from(box.children)) sizes.observe(child);
    };
    const edits = new MutationObserver(() => { watch(); changed(); });
    watch();
    edits.observe(box, { childList: true, subtree: true, characterData: true });
    box.addEventListener('scroll', measure, { passive: true });
    if (follow) box.scrollTop = box.scrollHeight;
    measure();
    return () => {
      sizes.disconnect();
      edits.disconnect();
      box.removeEventListener('scroll', measure);
      cancelAnimationFrame(frame);
      window.clearTimeout(following);
    };
  }, [ref, follow, axis]);
}

type ScrollFadeProps = HTMLAttributes<HTMLDivElement> & { follow?: boolean; axis?: 'x' | 'y' };

/** A scroll box that fades the edge where more is hidden, so clipped content always shows that it goes on. Give it a height or a max-height. */
export const ScrollFade = forwardRef<HTMLDivElement, ScrollFadeProps>(function ScrollFade({ follow, axis = 'y', className, children, ...rest }, ref) {
  const own = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => own.current!, []);
  useScrollFade(own, { follow, axis });
  return <div ref={own} className={cx('ui-scroll-fade', className)} data-axis={axis === 'x' ? 'x' : undefined} {...rest}>{children}</div>;
});

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type ReactNode, type RefObject } from 'react';
import { PrimaryAction, TextButton } from './Button';
import { cx } from './cx';
import { CheckIcon, CopyIcon, SendIcon } from './icons';

/*
 * The guide's dialogue, as a game shows it: one clean line on its own at the bottom of the screen, charcoal glass and white words,
 * with her own words' field under it. The guide itself floats in the map beside what it talks about (Companion), and her choices
 * are their own list beside the photo or message they act on (Choices). One hierarchy: the line leads; at most one muted meta line.
 */

type DialogueProps = {
  /** The guide's words: one or two short paragraphs. Give the Dialogue a key per line, so a new line enters as new. */
  children?: ReactNode;
  /** One short muted line above the words, such as "2 of 8". */
  meta?: ReactNode;
  /** Her own words: a Composer, under the line. */
  composer?: ReactNode;
  /** The guide is working, as while the model reads a message: three dots in place of the words. Never a pause put on for show. */
  working?: boolean;
  /** The dots' name for screen readers, such as "Reading". */
  workingLabel?: string;
  /** The region's name, such as "Guide". */
  label: string;
  lang?: string;
  className?: string;
};

/** The bottom dialogue: always in the same place, centred, clear of the home indicator and a landscape notch. */
export function Dialogue({ children, meta, composer, working, workingLabel, label, lang, className }: DialogueProps) {
  return <section className={cx('ui-dialogue', className)} aria-label={label} data-tone="dark">
    <div className="ui-dialogue-line" lang={lang} aria-live="polite" data-working={working || undefined}>
      {working
        ? <span className="ui-typing" role={workingLabel ? 'img' : undefined} aria-label={workingLabel} aria-hidden={workingLabel ? undefined : true}><i /><i /><i /></span>
        : <>
          {meta != null && meta !== false && <p className="ui-dialogue-meta">{meta}</p>}
          <div className="ui-dialogue-text">{children}</div>
        </>}
    </div>
    {composer}
  </section>;
}

/** The guide out in the world: the avatar small, in a charcoal glass disc with a white ring, placed by the screen beside what it talks about. working turns a thin arc around it. */
export function Companion({ children, working, className, style }: { children: ReactNode; working?: boolean; className?: string; style?: CSSProperties }) {
  return <span className={cx('ui-companion', className)} data-working={working || undefined} style={style} aria-hidden="true">{children}</span>;
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

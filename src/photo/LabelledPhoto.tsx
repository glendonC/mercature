import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import type { Photo, View } from '../destinations/data';
import { LOCALES, useLanguage, type Lang } from '../i18n';
import { fromRecord } from '../i18n/records';
import { FitIcon } from '../ui/icons';
import { markOf } from '../ui/kinds';
import '../ui/ui.css';
import { PHOTO_WORDS } from './copy';
import { GROUND, KindIcon, kindOf } from './kinds';
import { autoBudget, boundsOf, placeLabels, type Box, type Point } from './layout';
import { drawOrder, labelOrder, type PhotoMark } from './marks';
import './photo.css';

export type LabelledPhotoProps = {
  view: View; photo: Photo; src: string; marks: readonly PhotoMark[];
  /** Controlled: the selected mark's id (a finding id for findings), or null. */
  selected?: string | null;
  /** A tap or click on an outline or its chip, or Enter on a focused chip. */
  onSelect?: (id: string) => void;
  /** trace: outlines draw themselves and labels land one after another, then onTraced. Static under reduced motion. A new key replays it. */
  mode?: 'static' | 'trace';
  onTraced?: () => void;
  /** Trace: milliseconds between one mark's start and the next. */
  pace?: number;
  /** Trace: milliseconds for every outline together, in place of pace. */
  duration?: number;
  /** Trace: milliseconds after mount before the first outline starts. */
  delay?: number;
  /** Pinch, double-tap, wheel and a reset button. */
  zoomable?: boolean;
  /** When `selected` changes, zoom to frame a small outline; a large one shows the whole photo. */
  frameSelected?: boolean;
  fit?: 'contain' | 'cover';
  /** The photo's height; by default the view's own ratio at full width. */
  height?: number | string;
  /** How many labels show before the rest wait behind a '+N' chip. */
  labels?: 'auto' | number;
  credit?: 'below' | 'overlay';
  lang?: Lang;
  className?: string;
};

type Size = { w: number; h: number };
/** The photo at rest in the frame: its offset, size and scale from view pixels. */
type Base = Size & { x: number; y: number; s: number };
/** Zoom and pan: screen = x + k * rest, y + k * rest. */
type Zoom = { k: number; x: number; y: number };
const REST: Zoom = { k: 1, x: 0, y: 0 };
const MAX_ZOOM = 5, DRAW_MS = 600, LAND_MS = 280;
const CHIP_H = 24, CHIP_FONT = '500 13px Outfit, system-ui, sans-serif';
/** The chip's padding, kind disc and gap around its words, as photo.css draws them. */
const CHIP_EXTRA = 35;
const CREDIT_STRIP = 30;

let measurer: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string) {
  if (measurer === undefined) measurer = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!measurer) return text.length * 7.4;
  measurer.font = CHIP_FONT;
  return measurer.measureText(text).width;
}

function useSize(ref: RefObject<HTMLElement | null>): Size | null {
  const [size, setSize] = useState<Size | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize(old => old && Math.abs(old.w - el.clientWidth) < 0.5 && Math.abs(old.h - el.clientHeight) < 0.5 ? old : el.clientWidth && el.clientHeight ? { w: el.clientWidth, h: el.clientHeight } : old);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

const REDUCED = '(prefers-reduced-motion: reduce)';
function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia(REDUCED).matches);
  useEffect(() => { const list = matchMedia(REDUCED), change = () => setReduced(list.matches); list.addEventListener('change', change); return () => list.removeEventListener('change', change); }, []);
  return reduced;
}

const restOf = (view: View, size: Size, fit: 'contain' | 'cover'): Base => {
  const s = (fit === 'cover' ? Math.max : Math.min)(size.w / view.width, size.h / view.height), w = view.width * s, h = view.height * s;
  return { x: (size.w - w) / 2, y: (size.h - h) / 2, w, h, s };
};
/** Keeps the photo over the frame: centred while it is smaller than the frame, its edges never inside the frame once larger. */
function bound(z: Zoom, base: Base, size: Size): Zoom {
  const k = Math.min(MAX_ZOOM, Math.max(1, z.k));
  const axis = (at: number, frame: number, offset: number, extent: number) => extent * k <= frame + 0.5 ? (frame - extent * k) / 2 - offset * k : Math.min(-offset * k, Math.max(frame - (offset + extent) * k, at));
  return { k, x: axis(z.x, size.w, base.x, base.w), y: axis(z.y, size.h, base.y, base.h) };
}
const zoomAround = (z: Zoom, k: number, at: Point): Zoom => ({ k, x: at[0] - (at[0] - z.x) * (k / z.k), y: at[1] - (at[1] - z.y) * (k / z.k) });
const licenceName = (licence: string) => /^CC-BY-SA-4\.0$/i.test(licence) ? 'CC BY-SA 4.0' : licence.replace(/-/g, ' ');

/** A recorded photo with every model outline drawn on it and a label chip beside each, in its kind's hue. */
export function LabelledPhoto({ view, photo, src, marks, selected = null, onSelect, mode = 'static', onTraced, pace = 220, duration, delay = 0, zoomable = true, frameSelected = true, fit = 'contain', height, labels = 'auto', credit = 'below', lang: chosen, className }: LabelledPhotoProps) {
  const { lang: appLang } = useLanguage();
  const lang = chosen ?? appLang, words = PHOTO_WORDS[lang] ?? PHOTO_WORDS.en;
  const frame = useRef<HTMLDivElement>(null);
  const size = useSize(frame);
  const reduced = useReducedMotion();
  const [zoom, setZoomState] = useState<Zoom>(REST);
  const zoomRef = useRef<Zoom>(REST);
  const [failed, setFailed] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [fontsReady, setFontsReady] = useState(0);
  const [traceDone, setTraceDone] = useState(false);
  const base = useMemo(() => size && restOf(view, size, fit), [size, view, fit]);

  const setZoom = useCallback((next: Zoom) => { zoomRef.current = next; setZoomState(next); }, []);
  const tween = useRef(0);
  const animateTo = useCallback((target: Zoom) => {
    cancelAnimationFrame(tween.current);
    const from = zoomRef.current, start = performance.now();
    if (reduced) { setZoom(target); return; }
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 280), e = 1 - (1 - t) ** 3;
      setZoom({ k: from.k + (target.k - from.k) * e, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e });
      if (t < 1) tween.current = requestAnimationFrame(step);
    };
    tween.current = requestAnimationFrame(step);
  }, [reduced, setZoom]);
  useEffect(() => () => cancelAnimationFrame(tween.current), []);

  // A new photo starts whole; a resized frame keeps the photo over it.
  useEffect(() => { cancelAnimationFrame(tween.current); setZoom(REST); setFailed(false); setListOpen(false); }, [view.id, setZoom]);
  useEffect(() => { if (base && size) setZoom(bound(zoomRef.current, base, size)); }, [base, size, setZoom]);
  useEffect(() => { if (typeof document !== 'undefined' && document.fonts) document.fonts.load(CHIP_FONT).then(() => setFontsReady(n => n + 1), () => undefined); }, []);

  const nameOf = useCallback((m: PhotoMark) => { const kind = markOf(m.concept); return kind ? words.kinds[kind] : fromRecord(m.kindLabel ?? m.label, lang); }, [words, lang]);
  const spoken = useCallback((m: PhotoMark) => m.flagged ? words.possible(fromRecord(m.label, lang)) : words.mark(fromRecord(m.label, lang)), [words, lang]);
  const ranked = useMemo(() => labelOrder(marks), [marks]);
  const drawn = useMemo(() => { const order = drawOrder(marks), at = order.findIndex(m => m.id === selected); return at < 0 ? order : [...order.slice(0, at), ...order.slice(at + 1), order[at]]; }, [marks, selected]);
  // Trace timing: each outline draws in `draw` ms, the next starts `step` ms later, its label lands three quarters into its draw.
  const draw = duration ? Math.min(DRAW_MS, duration * 0.6) : DRAW_MS;
  const step = duration ? marks.length > 1 ? (duration - draw) / (marks.length - 1) : 0 : pace;
  const traceAt = useMemo(() => new Map(drawOrder(marks).map((m, i) => [m.id, delay + i * step])), [marks, delay, step]);
  const hasSelected = marks.some(m => m.id === selected);

  const projected = useMemo(() => base ? new Map(marks.map(m => [m.id, m.outline.map(([x, y]) => [zoom.x + zoom.k * (base.x + x * base.s), zoom.y + zoom.k * (base.y + y * base.s)] as Point)])) : null, [marks, base, zoom]);
  const zoomed = zoom.k > 1.02;
  const budget = labels === 'auto' ? size ? autoBudget(size.w, size.h) : 3 : labels;
  const layout = useMemo(() => {
    if (!projected || !size) return null;
    void fontsReady;
    const first = ranked.filter(m => m.id === selected), last = ranked.filter(m => m.id === focused && m.id !== selected);
    const order = [...first, ...ranked.filter(m => m.id !== selected && m.id !== focused), ...last];
    const avoid: Box[] = [{ x: size.w - 56, y: size.h - 36 - (credit === 'overlay' ? CREDIT_STRIP : 0), w: 52, h: 32 }];
    if (zoomed) avoid.push({ x: size.w - 48, y: 4, w: 44, h: 44 });
    if (credit === 'overlay') avoid.push({ x: 0, y: size.h - CREDIT_STRIP, w: size.w, h: CREDIT_STRIP });
    const weighty = new Set(marks.filter(m => m.barrier || m.flagged || m.id === selected).map(m => m.id));
    return placeLabels(order.map(m => ({ id: m.id, points: projected.get(m.id) ?? [], w: Math.ceil(textWidth(nameOf(m))) + CHIP_EXTRA, h: CHIP_H, force: m.id === selected || m.id === focused })), size, budget, avoid, weighty);
  }, [projected, size, ranked, marks, selected, focused, budget, credit, zoomed, nameOf, fontsReady]);
  const spots = useMemo(() => new Map(layout?.placed.map(p => [p.id, p]) ?? []), [layout]);
  const hidden = useMemo(() => ranked.filter(m => !spots.has(m.id)), [ranked, spots]);
  const ready = !!layout;

  // Trace: start once the frame is measured, finish when the last label has landed.
  const tracing = mode === 'trace' && !reduced && !traceDone;
  const tracedRef = useRef(onTraced);
  tracedRef.current = onTraced;
  const count = drawn.length;
  useEffect(() => {
    if (mode !== 'trace' || !ready) return;
    setTraceDone(false);
    const timer = setTimeout(() => { setTraceDone(true); tracedRef.current?.(); }, reduced ? 0 : delay + Math.max(0, count - 1) * step + draw * 0.75 + LAND_MS + 40);
    return () => clearTimeout(timer);
    // The trace runs once per view; later layout changes keep it going.
  }, [mode, ready, view.id, reduced]);

  // Frame the selected mark when the selection changes, after any trace.
  const framed = useRef('');
  useEffect(() => {
    if (!base || !size || tracing) return;
    const key = `${view.id}|${selected ?? ''}`;
    if (framed.current === key) return;
    framed.current = key;
    const mark = frameSelected && selected ? marks.find(m => m.id === selected) : null;
    if (!mark || mark.outline.length < 3) return;
    const b = boundsOf(mark.outline.map(([x, y]) => [base.x + x * base.s, base.y + y * base.s] as Point));
    const fitK = Math.min(3, size.w / Math.max(1, b.w * 3.2), size.h / Math.max(1, b.h * 3.2)), k = fitK < 1.4 ? 1 : fitK;
    animateTo(bound({ k, x: size.w / 2 - k * (b.x + b.w / 2), y: size.h / 2 - k * (b.y + b.h / 2) }, base, size));
  }, [selected, view.id, base, size, tracing, frameSelected, marks, animateTo]);

  // Gestures: one finger or the mouse pans a zoomed photo, two fingers pinch, a double tap or double click zooms.
  const gesture = useRef<{ pointers: Map<number, Point>; start: { zoom: Zoom; d: number; m: Point } | null; dragged: boolean; type: string; tap: { at: number; p: Point } | null }>({ pointers: new Map(), start: null, dragged: false, type: 'mouse', tap: null });
  const local = (e: { clientX: number; clientY: number }): Point => { const r = frame.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const toggleZoom = (p: Point) => {
    if (!base || !size) return;
    const z = zoomRef.current;
    animateTo(bound(z.k > 1.02 ? REST : zoomAround(z, 2.5, p), base, size));
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    g.type = e.pointerType;
    if (!zoomable || !base || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const p = local(e);
    g.pointers.set(e.pointerId, p);
    if (g.pointers.size === 1) { g.dragged = false; g.start = { zoom: zoomRef.current, d: 0, m: p }; }
    else if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()];
      cancelAnimationFrame(tween.current);
      g.start = { zoom: zoomRef.current, d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      g.dragged = true;
      for (const id of g.pointers.keys()) try { frame.current?.setPointerCapture(id); } catch { /* The pointer already ended. */ }
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.pointers.has(e.pointerId) || !g.start || !base || !size) return;
    const p = local(e), s = g.start;
    g.pointers.set(e.pointerId, p);
    if (g.pointers.size >= 2) {
      const [a, b] = [...g.pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const k = Math.min(MAX_ZOOM, Math.max(1, s.zoom.k * d / Math.max(1, s.d)));
      setZoom(bound({ k, x: m[0] - (s.m[0] - s.zoom.x) * (k / s.zoom.k), y: m[1] - (s.m[1] - s.zoom.y) * (k / s.zoom.k) }, base, size));
      return;
    }
    const next = bound({ k: s.zoom.k, x: s.zoom.x + p[0] - s.m[0], y: s.zoom.y + p[1] - s.m[1] }, base, size);
    if (!g.dragged) {
      if (Math.hypot(p[0] - s.m[0], p[1] - s.m[1]) < 6 || (Math.abs(next.x - s.zoom.x) < 0.5 && Math.abs(next.y - s.zoom.y) < 0.5)) return;
      g.dragged = true;
      cancelAnimationFrame(tween.current);
      try { frame.current?.setPointerCapture(e.pointerId); } catch { /* The pointer already ended. */ }
    }
    setZoom(next);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.pointers.has(e.pointerId)) return;
    const single = g.pointers.size === 1;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size === 1) { const [rest] = g.pointers.values(); g.start = { zoom: zoomRef.current, d: 0, m: rest }; return; }
    if (!single || g.dragged || e.type !== 'pointerup' || e.pointerType === 'mouse') return;
    const p = local(e), now = performance.now(), last = g.tap;
    if (last && now - last.at < 320 && Math.hypot(p[0] - last.p[0], p[1] - last.p[1]) < 32) { g.tap = null; toggleZoom(p); } else g.tap = { at: now, p };
  };
  // The wheel zooms only while there is room to zoom, so a panel around the photo still scrolls.
  useEffect(() => {
    const el = frame.current;
    if (!el || !zoomable || !base || !size) return;
    const onWheel = (e: WheelEvent) => {
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * size.h : e.deltaY;
      const z = zoomRef.current, k = Math.min(MAX_ZOOM, Math.max(1, z.k * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002))));
      if (Math.abs(k - z.k) < 1e-3) return;
      e.preventDefault();
      cancelAnimationFrame(tween.current);
      const r = el.getBoundingClientRect();
      setZoom(bound(zoomAround(z, k, [e.clientX - r.left, e.clientY - r.top]), base, size));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomable, base, size, setZoom]);

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => { if (gesture.current.dragged) { gesture.current.dragged = false; e.stopPropagation(); e.preventDefault(); } };
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element, id = target.closest?.('[data-mark-id]')?.getAttribute('data-mark-id');
    if (id) { onSelect?.(id); setListOpen(false); }
    else if (listOpen && !target.closest?.('.lp-more, .lp-list')) setListOpen(false);
  };
  const onDoubleClick = (e: MouseEvent<HTMLDivElement>) => { if (zoomable && gesture.current.type === 'mouse' && !(e.target as Element).closest?.('button')) toggleZoom(local(e)); };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Escape' && listOpen) { e.stopPropagation(); setListOpen(false); } };

  const date = useMemo(() => { if (!photo.capturedAt) return ''; const d = new Date(photo.capturedAt); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(LOCALES[lang], { year: 'numeric', month: 'short' }).format(d); }, [photo.capturedAt, lang]);
  const kinds = useMemo(() => [...new Set(ranked.map(nameOf))].join(', '), [ranked, nameOf]);
  const at = (id: string) => ({ '--lp-at': `${traceAt.get(id) ?? 0}ms` }) as CSSProperties;
  const pointsOf = (id: string) => (projected?.get(id) ?? []).map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  return <figure className={className ? `lp ${className}` : 'lp'} data-credit={credit} data-has-selected={hasSelected || undefined}
    data-trace={tracing || undefined} data-traced={mode === 'trace' && (traceDone || reduced) ? true : undefined} style={{ '--lp-draw': `${draw}ms` } as CSSProperties}>
    <div ref={frame} className="lp-frame" data-zoomed={zoomed || undefined} data-zoomable={zoomable || undefined} style={height != null ? { height } : { aspectRatio: `${view.width} / ${view.height}` }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture} onClick={onClick} onDoubleClick={onDoubleClick} onKeyDown={onKeyDown}>
      {failed ? <p className="lp-missing" role="img" aria-label={words.missing}>{words.missing}</p>
        : base && <img className="lp-image" src={src} alt={words.alt(kinds)} draggable={false} decoding="async" onError={() => setFailed(true)}
          style={{ width: base.w, height: base.h, transform: `translate(${zoom.x + zoom.k * base.x}px, ${zoom.y + zoom.k * base.y}px) scale(${zoom.k})` }} />}
      {!failed && projected && size && <svg className="lp-marks" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
        {drawn.map(m => {
          const points = pointsOf(m.id), b = boundsOf(projected.get(m.id) ?? []), small = b.w < 44 || b.h < 44, mine = m.id === selected;
          const kind = kindOf(m.concept), ground = GROUND.has(kind), length = ground ? undefined : 1;
          return <g key={m.id} className="lp-mark" data-mark-id={m.id} data-kind={kind} data-ground={ground || undefined} data-barrier={m.barrier || undefined} data-flagged={m.flagged || undefined} data-selected={mine || undefined} style={at(m.id)}>
            {small && <rect className="lp-hit" x={b.x + b.w / 2 - Math.max(44, b.w) / 2} y={b.y + b.h / 2 - Math.max(44, b.h) / 2} width={Math.max(44, b.w)} height={Math.max(44, b.h)} />}
            <polygon className="lp-fill" points={points} />
            <polygon className="lp-halo" points={points} pathLength={length} />
            {mine && <polygon className="lp-ink" points={points} pathLength={length} />}
            <polygon className="lp-line" points={points} pathLength={length} />
          </g>;
        })}
        {layout?.placed.map(({ id, box, anchor }) => {
          if (!anchor) return null;
          const edge: Point = [Math.min(box.x + box.w, Math.max(box.x, anchor[0])), Math.min(box.y + box.h, Math.max(box.y, anchor[1]))];
          if (Math.hypot(edge[0] - anchor[0], edge[1] - anchor[1]) < 5) return null;
          const m = marks.find(x => x.id === id);
          return <g key={id} className="lp-lead" data-kind={m ? kindOf(m.concept) : undefined} data-selected={id === selected || undefined} style={at(id)}>
            <line x1={edge[0]} y1={edge[1]} x2={anchor[0]} y2={anchor[1]} /><circle cx={anchor[0]} cy={anchor[1]} r={2.75} />
          </g>;
        })}
      </svg>}
      {!failed && layout && ranked.map(m => {
        const spot = spots.get(m.id), b = spot ? null : boundsOf(projected?.get(m.id) ?? [[0, 0]]);
        const style = spot ? { ...at(m.id), left: spot.box.x, top: spot.box.y } : { left: Math.max(0, b!.x + b!.w / 2), top: Math.max(0, b!.y + b!.h / 2) };
        return <button key={m.id} type="button" className="lp-chip" data-mark-id={m.id} data-kind={kindOf(m.concept)} data-barrier={m.barrier || undefined} data-flagged={m.flagged || undefined}
          data-selected={m.id === selected || undefined} data-hidden={spot ? undefined : true} aria-pressed={m.id === selected} aria-label={spoken(m)} title={fromRecord(m.label, lang)}
          style={style} onFocus={() => setFocused(m.id)} onBlur={() => setFocused(id => id === m.id ? null : id)}>
          <span className="lp-glyph" aria-hidden="true"><KindIcon concept={m.concept} size={12} /></span><span className="lp-name">{nameOf(m)}</span>{m.flagged && <span className="lp-badge" aria-hidden="true" />}
        </button>;
      })}
      {!failed && hidden.length > 0 && <>
        <button type="button" className="lp-more" aria-expanded={listOpen} aria-label={words.more(hidden.length)} onClick={() => setListOpen(open => !open)}>+{hidden.length}</button>
        {listOpen && <div className="lp-list" role="group" aria-label={words.marks}>
          {hidden.map(m => <button key={m.id} type="button" data-mark-id={m.id} data-kind={kindOf(m.concept)} aria-label={spoken(m)}><span className="lp-glyph" aria-hidden="true"><KindIcon concept={m.concept} size={12} /></span>{nameOf(m)}{m.flagged && <span className="lp-badge" aria-hidden="true" />}</button>)}
        </div>}
      </>}
      {zoomable && zoomed && <button type="button" className="lp-reset" aria-label={words.whole} title={words.whole} onClick={() => base && size && animateTo(bound(REST, base, size))}><FitIcon size={18} /></button>}
    </div>
    <figcaption className="lp-credit">
      <span>{photo.creator}{date ? `, ${date}` : ''} · {/BY-SA-4\.0/i.test(photo.licence) ? <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">{licenceName(photo.licence)}</a> : licenceName(photo.licence)} · {photo.link ? <a href={photo.link} target="_blank" rel="noreferrer">Mapillary</a> : 'Mapillary'}</span>
      <span className="lp-note">{words.note}</span>
    </figcaption>
  </figure>;
}

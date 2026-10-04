import { forwardRef, memo, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import type { Destination } from './data';
import GeographicMap, { routeFrame, type MapWords } from './GeographicMap';
import { aimed, framing, hazeAt, lens, tiltChosen, tiltFor, type Box, type Lens, type Tilt, type View } from './lens';
import './destinations.css';
import './map.css';
import type { Point, Walk } from './walk';
import { AddedIcon, FixedIcon, KerbIcon, MessageIcon, NoPhotosIcon, RemoveIcon, RoadIcon, StepsIcon, type Icon } from '../ui/icons';

export type Camera = { x: number; y: number; k: number };
export type Insets = { top: number; right: number; bottom: number; left: number };
export type MarkerState = 'open' | 'barrier' | 'not-barrier' | 'check' | 'no-photos' | 'landmark' | 'clear' | 'fixed';
export type MarkerIcon = 'steps' | 'kerb' | 'path' | 'no-photos' | 'fixed' | 'added' | 'check' | 'dismissed';
export type Marker = {
  id: string; at: Point; label: string; state: MarkerState; selected: boolean; rank?: number;
  /** A short caption beside the marker, such as "Steps · 340 m". Where it would collide it shortens to the part before " · ", or hides. */
  tag?: string;
  /** A small icon before the caption: one of the marker kinds, or any icon from the shared set, such as iconFor(concept). */
  icon?: MarkerIcon | Icon;
  /** Visitor messages filed at this spot, shown with the caption, or as a small count when the caption is hidden. Say it in the label too. */
  count?: number;
};
/** Check on site: a lens over the spot, drawn like the shared set until it has one. */
const CheckIcon: Icon = ({ size = 18 }) => <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={Math.min(2.25, Math.max(1.5, 33.6 / size))} strokeLinecap="round" strokeLinejoin="round" className="ui-icon" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></svg>;
const ICONS: Record<MarkerIcon, Icon> = { steps: StepsIcon, kerb: KerbIcon, path: RoadIcon, 'no-photos': NoPhotosIcon, fixed: FixedIcon, added: AddedIcon, check: CheckIcon, dismissed: RemoveIcon };
type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export type MapHandle = {
  fit: (animate?: boolean) => void;
  /** Moves the camera so a map point lands on a screen point, optionally closer in. */
  focus: (at: Point, screen: Point, zoom?: number) => void;
  /** Shows every given point inside the free part of the screen, never closer than a street. */
  frame: (points: Point[], free: Insets) => void;
  size: () => { width: number; height: number; fitK: number };
};
type Props = {
  data: Destination;
  walk: Walk;
  /** The view whose camera position and heading to draw, when a photo is open. */
  photoView: string;
  markers: Marker[];
  /** Map words; dy moves one below a point drawn by the map itself. */
  labels: { name: string; at: Point; dy?: number }[];
  insets: Insets;
  highlight: Point[] | null;
  onMarker: (id: string) => void;
  /** A tap on the map itself, with the scale where it landed so the caller can judge what is near. */
  onMap: (at: Point, pixelsPerMetre: number) => void;
  /** A tap on one of the photos this place can open, with the view to show. Without it, such a tap is a tap on the map. */
  onPhoto?: (viewId: string) => void;
  /** Rendered beside the selected marker on wide screens. */
  card?: ReactNode;
  cardFor?: string | null;
  ariaLabel: string;
  /** Pixels at the bottom kept free of map words, for the guide line and any sheet. */
  clearBottom: number;
  words: MapWords;
  /** A backdrop that only shows the walk: no pan, zoom or taps, and markers are plain dots. */
  still?: boolean;
  /** Starts at the leaned framing, with no flat first frame and no lean-in, for a map that opens with a leaned replay. */
  settled?: boolean;
  /** Called with the map's projection whenever it changes, to draw in step with the map. It runs on every frame of a move. */
  onLens?: (lens: Lens) => void;
  /** A fine pointer entering a marker, or keyboard focus reaching it, with its id; null when it leaves. Touch never hovers. */
  onHover?: (markerId: string | null) => void;
  /** A marker the page points at, such as a hovered message row: drawn raised, without moving the camera. */
  hovered?: string | null;
};

const quiet = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const line = (points: Point[], to?: (p: Point) => Point) => points.map(p => to ? to(p) : p).map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
const settle = (t: number) => 1 - Math.pow(1 - t, 3);
const sway = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
/** How long the map takes to lean back once the reveal has landed on it. */
const LEAN_FOR = 1000;
type Tween = { from: View; to: View; started: number; duration: number; ease: (t: number) => number };

/** Every recorded photo position, faint and one size at any zoom or lean, and the photos that open a little stronger. */
const Cameras = memo(function Cameras({ walk, open, lens }: { walk: Walk; open: Point[]; lens: Lens | null }) {
  const dots = (points: Point[]) => points.map(c => { const p = lens ? lens.at(c) : c; return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}h0`; }).join('');
  return <g className="route-cameras"><path d={dots(walk.cameras)} /><path d={dots(open)} className="is-open-ring" /><path d={dots(open)} className="is-open" /></g>;
});
/** Over the shared map's blue walk: the stretches without photos, the selected spot, and where the open photo was taken. */
const Overlay = memo(function Overlay({ walk, highlight, photo, lens }: { walk: Walk; highlight: Point[] | null; photo: Point | null; lens: Lens | null }) {
  const to = lens ? (p: Point) => lens.at(p) : undefined, at = photo && (to ? to(photo) : photo);
  return <g className="route-overlay">
    {walk.runs.filter(run => run.kind === 'no-photos').map((run, i) => <g key={i}><polyline className="route-unseen-cover" points={line(run.path, to)} /><polyline className="route-unseen" points={line(run.path, to)} /></g>)}
    {highlight && <><polyline className="route-highlight-halo" points={line(highlight, to)} /><polyline className="route-highlight" points={line(highlight, to)} /></>}
    {at && <><path className="route-photo-ring" d={`M${at[0].toFixed(1)} ${at[1].toFixed(1)}h0`} /><path className="route-photo-at" d={`M${at[0].toFixed(1)} ${at[1].toFixed(1)}h0`} /></>}
  </g>;
});

/** The walk shaded by what was found: a soft clay glow where a barrier may be, a grey hatch where no photo was taken. */
const Zones = memo(function Zones({ walk, glowing, lens }: { walk: Walk; glowing: string; lens: Lens | null }) {
  const hatch = useId(), to = lens ? (p: Point) => lens.at(p) : undefined, ids = new Set(glowing.split(' '));
  return <g className="route-zones">
    <defs><pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5" /></pattern></defs>
    {walk.runs.filter(run => run.kind === 'no-photos').map((run, i) => <polyline key={`u${i}`} points={line(run.path, to)} className="is-unseen" stroke={`url(#${hatch})`} />)}
    {walk.spots.filter(spot => ids.has(spot.id)).map(spot => <g key={spot.id}><polyline points={line(spot.path, to)} className="is-glow-wide" /><polyline points={line(spot.path, to)} className="is-glow" /></g>)}
  </g>;
});

/** Moves apart markers whose targets would overlap on screen, so each keeps a whole one; a selected marker stays where it is. */
function spread(points: Point[], pinned: boolean[], gap: number): Point[] {
  const out = points.map((p): Point => [p[0], p[1]]);
  for (let pass = 0; pass < 24; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const dx = out[j][0] - out[i][0], dy = out[j][1] - out[i][1], d = Math.hypot(dx, dy);
      if (d >= gap - 0.5 || (pinned[i] && pinned[j])) continue;
      const ux = d > 0.01 ? dx / d : 0, uy = d > 0.01 ? dy / d : 1, push = gap - d, share = pinned[i] ? 0 : pinned[j] ? 1 : 0.5;
      out[i] = [out[i][0] - ux * push * share, out[i][1] - uy * push * share];
      out[j] = [out[j][0] + ux * push * (1 - share), out[j][1] + uy * push * (1 - share)];
      moved = true;
    }
    if (!moved) break;
  }
  return out;
}

const RouteMap = forwardRef<MapHandle, Props>(function RouteMap({ data, walk, photoView, markers, labels, insets, highlight, onMarker, onMap, onPhoto, card, cardFor, ariaLabel, clearBottom, words, still = false, settled = false, onLens, onHover, hovered = null }, ref) {
  const leaning = useMemo(tiltChosen, []);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<View | null>(null);
  const live = useRef<View | null>(null);
  /** The lean the map is heading for. Framing aims at it, so a frame still holds when the lean settles. */
  const goal = useRef(leaning && settled ? 1 : 0);
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const reach = useMemo(() => [...walk.route, walk.target.at, ...(walk.start ? [walk.start.at] : [])], [walk]);
  /** The photos this place can open, the packaged views, each with the first view to show. */
  const openable = useMemo(() => {
    const first = new Map(data.views.map(view => [view.photoId, view.id] as const).reverse());
    return data.photos.flatMap(photo => { const viewId = first.get(photo.id); return viewId ? [{ viewId, at: walk.project(photo.position) }] : []; });
  }, [data, walk]);
  const openDots = useMemo(() => openable.map(photo => photo.at), [openable]);
  const photoAt = useMemo(() => { const view = data.views.find(item => item.id === photoView), photo = view && data.photos.find(item => item.id === view.photoId); return photo ? walk.project(photo.position) : null; }, [data, walk, photoView]);
  /** The flat fit and the free box it fills, from the insets. */
  const fitFlat = useCallback((width: number, height: number) => {
    const { minX, minY, maxX, maxY } = walk.extent, i = insetsRef.current;
    const w = Math.max(1, width - i.left - i.right), h = Math.max(1, height - i.top - i.bottom);
    const k = Math.min(w / Math.max(maxX - minX, 40), h / Math.max(maxY - minY, 40)) * 0.9;
    const sx = i.left + w / 2, sy = i.top + h / 2;
    const flat: View = { k, x: (minX + maxX) / 2 - (sx - width / 2) / k, y: (minY + maxY) / 2 - (sy - height / 2) / k, lean: 0 };
    const free: Box = { left: i.left + w * 0.05, top: i.top + h * 0.05, right: width - i.right - w * 0.05, bottom: height - i.bottom - h * 0.05 };
    return { flat, free, key: [width, height, i.top, i.right, i.bottom, i.left].join(' ') };
  }, [walk]);
  /** The lean for a screen and its free box, turned to lay the walk across or stand it upright, whichever shows it larger. */
  const aims = useRef(new Map<string, Tilt>());
  const tiltOf = useCallback((width: number, height: number): Tilt => {
    const { flat, free, key } = fitFlat(width, height), known = aims.current.get(key);
    if (known) return known;
    if (!width || !height) return tiltFor(width);
    const [across, upright] = [tiltFor(width).course, 90].map(course => aimed({ ...tiltFor(width), course }, walk.route[0] ?? [0, 0], walk.route.at(-1) ?? [0, 0]));
    const size = (tilt: Tilt) => framing(reach, free, 1, tilt, width, height, flat).k;
    const chosen = size(upright) > size(across) * 1.05 ? upright : across;
    aims.current.set(key, chosen);
    return chosen;
  }, [walk, reach, fitFlat]);
  const tilt = tiltOf(size.width, size.height);
  /** Block height in map units: the same few metres for every building. */
  const rise = useMemo(() => tilt.rise * routeFrame(data).scale, [data, tilt]);

  // Fitting a leaning map takes a few passes, and every drag asks for the fit, so keep it per screen and lean.
  const fits = useRef(new Map<string, View>());
  const fitCamera = useCallback((width: number, height: number, lean = goal.current): View => {
    const { flat, free, key } = fitFlat(width, height), known = fits.current.get(`${key} ${lean}`);
    if (known) return known;
    const fit = lean ? framing(reach, free, lean, tiltOf(width, height), width, height, flat) : flat;
    fits.current.set(`${key} ${lean}`, fit);
    return fit;
  }, [reach, fitFlat, tiltOf]);
  useEffect(() => { fits.current.clear(); aims.current.clear(); }, [fitCamera]);

  // One loop moves the camera and the lean; a gesture stops the camera and leaves the lean to finish.
  const tween = useRef<Tween | null>(null);
  const leanTween = useRef<{ from: number; to: number; started: number } | null>(null);
  const frame = useRef(0);
  const step = useRef<(now: number) => void>(() => {});
  step.current = now => {
    frame.current = 0;
    let next = live.current;
    if (!next) return;
    const c = tween.current, l = leanTween.current;
    if (c) {
      const t = Math.min(1, (now - c.started) / c.duration), e = c.ease(t);
      next = { ...next, x: c.from.x + (c.to.x - c.from.x) * e, y: c.from.y + (c.to.y - c.from.y) * e, k: c.from.k * Math.pow(c.to.k / c.from.k, e) };
      if (t >= 1) tween.current = null;
    }
    if (l) {
      const t = Math.min(1, (now - l.started) / LEAN_FOR);
      next = { ...next, lean: l.from + (l.to - l.from) * sway(t) };
      if (t >= 1) leanTween.current = null;
    }
    live.current = next; setCamera(next);
    if (tween.current || leanTween.current) frame.current = requestAnimationFrame(time => step.current(time));
  };
  const run = useCallback(() => { if (!frame.current) frame.current = requestAnimationFrame(time => step.current(time)); }, []);
  const go = useCallback((target: View, animate = true) => {
    const from = live.current;
    if (!from || !animate || quiet()) { tween.current = null; const next = { ...target, lean: from?.lean ?? target.lean }; live.current = next; setCamera(next); return; }
    tween.current = { from, to: target, started: performance.now(), duration: 520, ease: settle };
    run();
  }, [run]);
  const limits = useCallback(() => { const fit = fitCamera(size.width, size.height).k; return { min: fit * 0.6, max: fit * 9 }; }, [fitCamera, size]);
  /** Keeps the walk on screen whatever the person drags. */
  const clamp = useCallback((c: View): View => {
    const { minX, minY, maxX, maxY } = walk.extent, { min, max } = limits(), k = Math.max(min, Math.min(max, c.k));
    const hw = size.width / 2 / k, hh = size.height / 2 / k;
    return { ...c, k, x: Math.max(minX - hw + 30 / k, Math.min(maxX + hw - 30 / k, c.x)), y: Math.max(minY - hh + 30 / k, Math.min(maxY + hh - 30 / k, c.y)) };
  }, [walk, limits, size]);
  /** The view at a zoom and lean that puts a map point under a screen point. */
  const place = useCallback((at: Point, screen: Point, k: number, lean: number): View => {
    const offset = lens({ x: 0, y: 0, k, lean }, tiltOf(size.width, size.height), size.width, size.height).ground(screen);
    return { x: at[0] - offset[0], y: at[1] - offset[1], k, lean };
  }, [size, tiltOf]);

  useLayoutEffect(() => {
    const element = box.current!;
    const measure = () => { const r = element.getBoundingClientRect(); setSize(s => s.width === r.width && s.height === r.height ? s : { width: r.width, height: r.height }); };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const fitted = useRef(false);
  useEffect(() => {
    if (!size.width || !size.height) return;
    if (!fitted.current) { fitted.current = true; go(fitCamera(size.width, size.height), false); }
    else if (live.current) go(clamp(live.current), false);
  }, [size, fitCamera, go, clamp]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // The reveal lands on the flat map, which it can match; once it has gone, the map leans back.
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!leaning) return;
    const reveal = document.querySelector('.reveal'), host = reveal?.parentNode;
    if (!reveal || !host) { setLanded(true); return; }
    const watch = new MutationObserver(() => { if (!reveal.isConnected) { watch.disconnect(); setLanded(true); } });
    watch.observe(host, { childList: true });
    return () => watch.disconnect();
  }, [leaning]);
  useEffect(() => {
    if (!landed || !size.width || !live.current || goal.current === 1) return;
    goal.current = 1;
    const target = fitCamera(size.width, size.height);
    if (quiet()) { live.current = target; setCamera(target); return; }
    const now = performance.now();
    tween.current = { from: live.current, to: target, started: now, duration: LEAN_FOR, ease: sway };
    leanTween.current = { from: live.current.lean, to: 1, started: now };
    run();
  }, [landed, size, fitCamera, run]);

  // The map credit of a map people use: the full line at first, folded to a small chip after the first move or a few seconds;
  // a tap opens it again.
  const [credit, setCredit] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => setCredit(false), 6000); return () => clearTimeout(timer); }, []);

  // The selected marker, or the one last opened while it is still in view, stays in the free band between the place title
  // and the guide, or any sheet, as they change. Panning or the whole route lets the last one go.
  const chosen = markers.find(marker => marker.selected) ?? null;
  const lastOpened = useRef<string | null>(null);
  useEffect(() => {
    if (chosen) lastOpened.current = chosen.id;
    const spot = chosen ?? markers.find(marker => marker.id === lastOpened.current) ?? null, current = tween.current?.to ?? live.current;
    if (!spot || !current || !size.height) return;
    const top = insetsRef.current.top, bottom = size.height - clearBottom, aim = { ...current, lean: goal.current };
    const [x, y] = lens(aim, tiltOf(size.width, size.height), size.width, size.height).at(spot.at);
    if (!chosen && (x < 0 || x > size.width || y < 0 || y > size.height)) return;
    if (y >= top && y <= bottom - 28) return;
    go(clamp(place(spot.at, [x, Math.max(Math.min((top + bottom) / 2, bottom - 28), Math.min(top + 28, bottom - 28))], aim.k, aim.lean)));
  // Only a new selection or a new band moves the camera; a person's own panning is left alone.
  }, [chosen?.id, clearBottom]);

  useImperativeHandle(ref, () => ({
    fit: (animate = true) => go(fitCamera(size.width, size.height), animate),
    focus: (at, screen, zoom) => {
      const current = live.current ?? fitCamera(size.width, size.height);
      go(clamp(place(at, screen, Math.max(current.k, zoom ?? current.k), goal.current)));
    },
    frame: (points, free) => {
      if (!points.length) return;
      const xs = points.map(p => p[0]), ys = points.map(p => p[1]), fit = fitCamera(size.width, size.height).k;
      const w = Math.max(1, size.width - free.left - free.right), h = Math.max(1, size.height - free.top - free.bottom);
      if (goal.current) {
        const inner: Box = { left: free.left + w * 0.1, top: free.top + h * 0.1, right: size.width - free.right - w * 0.1, bottom: size.height - free.bottom - h * 0.1 };
        go(clamp(framing(points, inner, goal.current, tiltOf(size.width, size.height), size.width, size.height, live.current ?? fitCamera(size.width, size.height), { min: fit * 0.6, max: fit * 2.4 })));
        return;
      }
      const k = Math.max(fit * 0.6, Math.min(fit * 2.4, w / Math.max(Math.max(...xs) - Math.min(...xs), 1) * 0.8, h / Math.max(Math.max(...ys) - Math.min(...ys), 1) * 0.8));
      const sx = free.left + w / 2, sy = free.top + h / 2, cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      go(clamp({ k, x: cx - (sx - size.width / 2) / k, y: cy - (sy - size.height / 2) / k, lean: 0 }));
    },
    size: () => ({ ...size, fitK: fitCamera(size.width, size.height).k }),
  }), [go, fitCamera, clamp, place, size, tiltOf]);

  const view = useMemo(() => camera && size.width ? lens(camera, tilt, size.width, size.height) : null, [camera, tilt, size]);
  useEffect(() => { if (view && onLens) onLens(view); }, [view, onLens]);
  const toScreen = (p: Point): Point => view ? view.at(p) : [-999, -999];

  // Drag to pan, pinch or wheel to zoom; a tap without movement selects the walk under it.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; camera: View; x: number; y: number; spread: number } | null>(null);
  function local(event: ReactPointerEvent) { const r = box.current!.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (still || (event.target as HTMLElement).closest('button, a, .route-card')) return;
    setCredit(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, local(event));
    const points = [...pointers.current.values()], x = points.reduce((s, p) => s + p.x, 0) / points.length, y = points.reduce((s, p) => s + p.y, 0) / points.length;
    const spread = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
    gesture.current = { moved: gesture.current?.moved ?? false, camera: live.current ?? camera!, x, y, spread };
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, local(event));
    const points = [...pointers.current.values()], g = gesture.current;
    const x = points.reduce((s, p) => s + p.x, 0) / points.length, y = points.reduce((s, p) => s + p.y, 0) / points.length;
    if (Math.hypot(x - g.x, y - g.y) > 4) g.moved = true;
    let k = g.camera.k;
    if (points.length > 1 && g.spread > 0) { k = g.camera.k * Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) / g.spread; g.moved = true; }
    if (!g.moved) return;
    lastOpened.current = null;
    const anchor = lens(g.camera, tilt, size.width, size.height).ground([g.x, g.y]);
    tween.current = null;
    const next = clamp(place(anchor, [x, y], k, live.current?.lean ?? g.camera.lean));
    live.current = next; setCamera(next);
  }
  function up(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const point = local(event), tap = !gesture.current?.moved;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size) { const rest = [...pointers.current.values()][0]; gesture.current = { moved: true, camera: live.current!, x: rest.x, y: rest.y, spread: 0 }; return; }
    gesture.current = null;
    if (!tap || event.type !== 'pointerup' || !view) return;
    // A photo that can open takes a tap within a finger's reach of its dot; anywhere else is the map.
    const near = onPhoto ? openable.map(photo => ({ photo, d: Math.hypot(view.at(photo.at)[0] - point.x, view.at(photo.at)[1] - point.y) })).filter(item => item.d <= 22).sort((a, b) => a.d - b.d)[0] : undefined;
    if (near && onPhoto) { onPhoto(near.photo.viewId); return; }
    const at = view.ground([point.x, point.y]); onMap(at, view.scale(at));
  }
  useEffect(() => {
    const element = box.current!;
    if (still) return;
    const wheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest('.route-card')) return;
      event.preventDefault();
      setCredit(false);
      const c = live.current; if (!c) return;
      const r = element.getBoundingClientRect(), sx = event.clientX - r.left, sy = event.clientY - r.top;
      const anchor = lens(c, tiltOf(r.width, r.height), r.width, r.height).ground([sx, sy]);
      tween.current = null; lastOpened.current = null;
      const next = clamp(place(anchor, [sx, sy], c.k * Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0018)), c.lean));
      live.current = next; setCamera(next);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [clamp, place, still, tiltOf]);

  // Card placement beside its marker, flipped or nudged to stay inside the canvas.
  const cardBox = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ width: 340, height: 420 });
  useLayoutEffect(() => {
    const element = cardBox.current; if (!element) return;
    const measure = () => setCardSize(s => s.width === element.offsetWidth && s.height === element.offsetHeight ? s : { width: element.offsetWidth, height: element.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, [card, cardFor]);
  // Markers sit on their spots unless their 44 px targets would overlap; then they step apart, and a hairline leads back.
  const spots = markers.map(marker => toScreen(marker.at)), apart = spread(spots, markers.map(marker => marker.selected), 46);
  const placed = markers.map((marker, i) => ({ marker, spot: spots[i], at: apart[i], nudged: Math.hypot(apart[i][0] - spots[i][0], apart[i][1] - spots[i][1]) > 3 }));
  const anchor = cardFor ? placed.find(p => p.marker.id === cardFor) : null;
  let cardStyle: { left: number; top: number } | null = null, leader: { left: number; top: number; width: number } | null = null;
  if (anchor && card && camera) {
    const [sx, sy] = anchor.at, gap = 30;
    const right = sx + gap + cardSize.width <= size.width - 16 || sx < size.width / 2;
    const left = right ? sx + gap : sx - gap - cardSize.width;
    const top = Math.max(insets.top, Math.min(size.height - insets.bottom - cardSize.height, sy - cardSize.height * 0.42));
    cardStyle = { left, top };
    if (sy > top + 12 && sy < top + cardSize.height - 12) leader = { left: right ? sx + 12 : left + cardSize.width, top: sy, width: gap - 12 };
  }
  // The flat map frames itself through the view box, which the reveal lands on; a leaning map is drawn in screen pixels.
  const flat = !view || view.view.lean < 0.001;
  const vb = camera && size.width ? `${camera.x - size.width / 2 / camera.k} ${camera.y - size.height / 2 / camera.k} ${size.width / camera.k} ${size.height / camera.k}` : '0 0 1 1';
  /** Spots that may hold a barrier glow along the walk until someone decides otherwise. */
  const glowing = markers.filter(marker => marker.state === 'open' || marker.state === 'barrier' || marker.state === 'check').map(marker => marker.id).join(' ');
  /** Markers that the lean pushes up under the place title lose their tags; every marker fades with the haze it stands in. */
  const far = (at: Point) => !flat && at[1] < insets.top - 8 ? '' : undefined;
  const faded = (marker: Marker, at: Point) => flat || marker.selected ? undefined : +(1 - 0.6 * hazeAt(at[1], size.height, view!.view.lean)).toFixed(2);
  // Captions and map words never cover a marker or each other; the selected and hovered markers' captions go first.
  const own = new Map(placed.map(p => [p.marker.id, { x: p.at[0] - 22, y: p.at[1] - 22, w: 44, h: 44 }] as const));
  const taken: Rect[] = [...own.values()];
  const controls = box.current?.querySelector('.destination-map-controls')?.getBoundingClientRect(), bounds = box.current?.getBoundingClientRect();
  if (controls && bounds && controls.width) taken.push({ x: controls.left - bounds.left - 8, y: controls.top - bounds.top - 8, w: controls.width + 16, h: controls.height + 16 });
  const captions = new Map<string, { side: 'right' | 'left'; text: string }>();
  for (const { marker, at } of [...placed].sort((a, b) => Number(b.marker.selected || b.marker.id === hovered) - Number(a.marker.selected || a.marker.id === hovered))) {
    if (!marker.tag || !camera) continue;
    const y = at[1] - (flat ? 0 : 11), raised = marker.selected || marker.id === hovered, forms = [...new Set([marker.tag, marker.tag.split(' · ')[0]])];
    for (const text of forms) {
      const w = Math.round(text.length * 7 + 18 + (marker.icon ? 15 : 0) + (marker.count ? 26 : 0)), h = size.width > 640 ? 23 : 24;
      const side = (['right', 'left'] as const).find(side => {
        const rect = { x: side === 'right' ? at[0] + 14 : at[0] - 14 - w, y: y - h / 2, w, h };
        // A caption stays in the part of the map the page keeps free, so a panel over the map never hides one.
        if (rect.x < Math.max(8, insets.left - 24) || rect.x + w > size.width - Math.max(8, insets.right - 24) || rect.y + h > size.height - clearBottom || (!raised && rect.y < insets.top - 4) || rect.y < 4) return false;
        if (taken.some(other => other !== own.get(marker.id) && overlaps(other, rect))) return false;
        taken.push(rect);
        return true;
      });
      if (side) { captions.set(marker.id, { side, text }); break; }
    }
  }
  const visibleLabels = camera ? labels.map(label => { const at = toScreen(label.at); return { label, at: [at[0], at[1] + (label.dy ?? 0)] as Point }; }).filter(({ label, at }) => {
    const w = Math.min(180, label.name.length * 6.6) + 8, h = label.name.length * 6.6 > 180 ? 34 : 18, box = { x: at[0] - w / 2, y: at[1] - h / 2, w, h };
    if (at[0] < 8 || at[0] > size.width - 8 || at[1] < insets.top || at[1] > size.height - clearBottom) return false;
    if (taken.some(other => overlaps(other, box))) return false;
    taken.push(box);
    return true;
  }) : [];

  // The shared map's own zoom buttons drive this camera; level 1 is the whole walk.
  const zoomTo = (action: SetStateAction<number>) => {
    lastOpened.current = null;
    const fit = fitCamera(size.width, size.height), current = live.current ?? fit;
    const level = typeof action === 'function' ? action(current.k / fit.k) : action;
    go(level <= 1 ? fit : clamp({ ...current, k: fit.k * level }));
  };
  // How much a circle on the ground flattens, for the ring under the selected marker.
  const squash = { '--squash': Math.cos((camera?.lean ?? 0) * tilt.pitch * Math.PI / 180).toFixed(3) } as CSSProperties;
  return <div className="route-map" ref={box} data-still={still || undefined} data-lean={flat ? undefined : ''} style={flat ? undefined : squash} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label={ariaLabel} role="group">
    <GeographicMap data={data} selected={photoView} onSelect={() => {}} hidden={false} zoom={1} setZoom={zoomTo} shown={0} className="is-canvas" viewBox={vb} words={words} still={still} credit={still}
      lens={flat ? undefined : view} rise={rise} underlay={<><Zones walk={walk} glowing={glowing} lens={flat ? null : view} /><Cameras walk={walk} open={openDots} lens={flat ? null : view} /></>}>
      <Overlay walk={walk} highlight={highlight} photo={photoAt} lens={flat ? null : view} />
    </GeographicMap>
    <div className="route-labels" aria-hidden="true">
      {visibleLabels.map(({ label, at }) => <span key={label.name} style={{ left: at[0], top: at[1] }}>{label.name}</span>)}
    </div>
    <div className="route-markers">
      <svg className="route-nudges" aria-hidden="true">{placed.filter(p => p.nudged).map(({ marker, spot, at }) => <g key={marker.id}><line x1={spot[0]} y1={spot[1]} x2={at[0]} y2={at[1]} /><circle cx={spot[0]} cy={spot[1]} r="2.5" /></g>)}</svg>
      {placed.map(({ marker, at }) => {
        const caption = captions.get(marker.id), count = marker.count ? marker.count > 99 ? '99+' : String(marker.count) : '';
        const Glyph = typeof marker.icon === 'string' ? ICONS[marker.icon] : marker.icon;
        const inside = <>
          <span className="route-marker-ping" aria-hidden="true" />
          <span className="route-marker-dot" aria-hidden="true">{marker.rank ?? ''}</span>
          {count && !caption && <span className="route-marker-count" aria-hidden="true">{count}</span>}
          {caption && <span className="route-marker-tag" aria-hidden="true">{Glyph && <Glyph size={13} />}{caption.text}{count && <span className="route-marker-said"><MessageIcon size={12} />{count}</span>}</span>}
        </>;
        const shared = { className: 'route-marker', 'data-state': marker.state, 'data-rank': marker.rank, 'data-far': far(at), 'data-side': caption?.side, 'data-hovered': marker.id === hovered || undefined, style: { left: at[0], top: at[1], opacity: faded(marker, at) } };
        return still ? <span key={marker.id} {...shared} aria-hidden="true">{inside}</span>
          : <button key={marker.id} type="button" {...shared} aria-pressed={marker.selected} aria-label={marker.label} onClick={() => onMarker(marker.id)}
            onPointerEnter={event => { if (event.pointerType !== 'touch') onHover?.(marker.id); }} onPointerLeave={event => { if (event.pointerType !== 'touch') onHover?.(null); }}
            onFocus={event => { if (event.currentTarget.matches(':focus-visible')) onHover?.(marker.id); }} onBlur={() => onHover?.(null)}>{inside}</button>;
      })}
    </div>
    {leader && <span className="route-leader" style={leader} aria-hidden="true" />}
    {card && <div className="route-card-slot" ref={cardBox} style={cardStyle ?? { left: -9999, top: 0 }}>{card}</div>}
    {/* A backdrop keeps the plain credit line its page places; a map people use gets the folding control. */}
    {!still && <button type="button" className="route-credit" aria-expanded={credit} aria-label={words.credit} onClick={() => setCredit(open => !open)}
      style={{ right: Math.max(8, insets.right), bottom: Math.max(4, clearBottom + 4) }}><span>{credit ? words.credit : '© OSM'}</span></button>}
  </div>;
});
export default RouteMap;

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import type { Destination } from './data';
import GeographicMap, { type MapWords } from './GeographicMap';
import './destinations.css';
import type { Point, Walk } from './walk';

export type Camera = { x: number; y: number; k: number };
export type Insets = { top: number; right: number; bottom: number; left: number };
export type MarkerState = 'open' | 'barrier' | 'not-barrier' | 'check' | 'no-photos' | 'landmark' | 'clear';
export type Marker = { id: string; at: Point; label: string; state: MarkerState; selected: boolean; rank?: number; tag?: string };
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
  photoAt: Point | null;
  markers: Marker[];
  /** Map words; dy moves one below a point drawn by the map itself. */
  labels: { name: string; at: Point; dy?: number }[];
  insets: Insets;
  highlight: Point[] | null;
  onMarker: (id: string) => void;
  /** A tap on the map itself, with the current scale so the caller can judge what is near. */
  onMap: (at: Point, pixelsPerMetre: number) => void;
  /** Rendered beside the selected marker on wide screens. */
  card?: ReactNode;
  cardFor?: string | null;
  ariaLabel: string;
  /** Pixels at the bottom kept free of map words, for the guide line and any sheet. */
  clearBottom: number;
  words: MapWords;
};

const quiet = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const line = (points: Point[]) => points.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

/** Every recorded camera, faint, beneath the walk. */
const Cameras = memo(function Cameras({ walk }: { walk: Walk }) {
  return <g className="route-cameras">{walk.cameras.map((c, i) => <circle key={i} cx={c[0].toFixed(1)} cy={c[1].toFixed(1)} r="1.3" />)}</g>;
});
/** Over the shared map's blue walk: the stretches without photos, and the selected spot. */
const Overlay = memo(function Overlay({ walk, highlight, photoAt }: { walk: Walk; highlight: Point[] | null; photoAt: Point | null }) {
  return <g className="route-overlay">
    {walk.runs.filter(run => run.kind === 'no-photos').map((run, i) => <g key={i}><polyline className="route-unseen-cover" points={line(run.path)} /><polyline className="route-unseen" points={line(run.path)} /></g>)}
    {highlight && <><polyline className="route-highlight-halo" points={line(highlight)} /><polyline className="route-highlight" points={line(highlight)} /></>}
    {photoAt && <circle className="route-photo-camera" cx={photoAt[0]} cy={photoAt[1]} r="4" />}
  </g>;
});

const RouteMap = forwardRef<MapHandle, Props>(function RouteMap({ data, walk, photoView, photoAt, markers, labels, insets, highlight, onMarker, onMap, card, cardFor, ariaLabel, clearBottom, words }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera | null>(null);
  const live = useRef<Camera | null>(null);
  const frame = useRef(0);
  const insetsRef = useRef(insets);
  insetsRef.current = insets;

  const fitCamera = useCallback((width: number, height: number): Camera => {
    const { minX, minY, maxX, maxY } = walk.extent, i = insetsRef.current;
    const w = Math.max(1, width - i.left - i.right), h = Math.max(1, height - i.top - i.bottom);
    const k = Math.min(w / Math.max(maxX - minX, 40), h / Math.max(maxY - minY, 40)) * 0.9;
    const sx = i.left + w / 2, sy = i.top + h / 2;
    return { k, x: (minX + maxX) / 2 - (sx - width / 2) / k, y: (minY + maxY) / 2 - (sy - height / 2) / k };
  }, [walk]);
  const go = useCallback((target: Camera, animate = true) => {
    cancelAnimationFrame(frame.current);
    const from = live.current;
    if (!from || !animate || quiet()) { live.current = target; setCamera(target); return; }
    const started = performance.now(), duration = 520;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration), e = 1 - Math.pow(1 - t, 3);
      const next = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, k: from.k * Math.pow(target.k / from.k, e) };
      live.current = next; setCamera(next);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, []);
  const limits = useCallback(() => { const fit = fitCamera(size.width, size.height).k; return { min: fit * 0.6, max: fit * 9 }; }, [fitCamera, size]);
  /** Keeps the walk on screen whatever the person drags. */
  const clamp = useCallback((c: Camera): Camera => {
    const { minX, minY, maxX, maxY } = walk.extent, { min, max } = limits(), k = Math.max(min, Math.min(max, c.k));
    const hw = size.width / 2 / k, hh = size.height / 2 / k;
    return { k, x: Math.max(minX - hw + 30 / k, Math.min(maxX + hw - 30 / k, c.x)), y: Math.max(minY - hh + 30 / k, Math.min(maxY + hh - 30 / k, c.y)) };
  }, [walk, limits, size]);

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

  useImperativeHandle(ref, () => ({
    fit: (animate = true) => go(fitCamera(size.width, size.height), animate),
    focus: (at, screen, zoom) => {
      const current = live.current ?? fitCamera(size.width, size.height);
      const k = Math.max(current.k, zoom ?? current.k);
      go(clamp({ k, x: at[0] - (screen[0] - size.width / 2) / k, y: at[1] - (screen[1] - size.height / 2) / k }));
    },
    frame: (points, free) => {
      if (!points.length) return;
      const xs = points.map(p => p[0]), ys = points.map(p => p[1]), fit = fitCamera(size.width, size.height).k;
      const w = Math.max(1, size.width - free.left - free.right), h = Math.max(1, size.height - free.top - free.bottom);
      const k = Math.max(fit * 0.6, Math.min(fit * 2.4, w / Math.max(Math.max(...xs) - Math.min(...xs), 1) * 0.8, h / Math.max(Math.max(...ys) - Math.min(...ys), 1) * 0.8));
      const sx = free.left + w / 2, sy = free.top + h / 2, cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      go(clamp({ k, x: cx - (sx - size.width / 2) / k, y: cy - (sy - size.height / 2) / k }));
    },
    size: () => ({ ...size, fitK: fitCamera(size.width, size.height).k }),
  }), [go, fitCamera, clamp, size]);

  const toScreen = (p: Point): Point => camera ? [(p[0] - camera.x) * camera.k + size.width / 2, (p[1] - camera.y) * camera.k + size.height / 2] : [-999, -999];
  const toMap = (sx: number, sy: number): Point => camera ? [camera.x + (sx - size.width / 2) / camera.k, camera.y + (sy - size.height / 2) / camera.k] : [0, 0];

  // Drag to pan, pinch or wheel to zoom; a tap without movement selects the walk under it.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; camera: Camera; x: number; y: number; spread: number } | null>(null);
  function local(event: ReactPointerEvent) { const r = box.current!.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button, a, .route-card')) return;
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
    const anchor: Point = [g.camera.x + (g.x - size.width / 2) / g.camera.k, g.camera.y + (g.y - size.height / 2) / g.camera.k];
    if (!g.moved) return;
    cancelAnimationFrame(frame.current);
    const next = clamp({ k, x: anchor[0] - (x - size.width / 2) / k, y: anchor[1] - (y - size.height / 2) / k });
    live.current = next; setCamera(next);
  }
  function up(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const point = local(event), tap = !gesture.current?.moved;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size) { const rest = [...pointers.current.values()][0]; gesture.current = { moved: true, camera: live.current!, x: rest.x, y: rest.y, spread: 0 }; return; }
    gesture.current = null;
    if (tap && event.type === 'pointerup' && camera) onMap(toMap(point.x, point.y), camera.k);
  }
  useEffect(() => {
    const element = box.current!;
    const wheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest('.route-card')) return;
      event.preventDefault();
      const c = live.current; if (!c) return;
      const r = element.getBoundingClientRect(), sx = event.clientX - r.left, sy = event.clientY - r.top;
      const anchor: Point = [c.x + (sx - r.width / 2) / c.k, c.y + (sy - r.height / 2) / c.k];
      const k = c.k * Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0018));
      cancelAnimationFrame(frame.current);
      const next = clamp({ k, x: anchor[0] - (sx - r.width / 2) / k, y: anchor[1] - (sy - r.height / 2) / k });
      live.current = next; setCamera(next);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [clamp]);

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
  const anchor = cardFor ? markers.find(m => m.id === cardFor) : null;
  let cardStyle: { left: number; top: number } | null = null, leader: { left: number; top: number; width: number } | null = null;
  if (anchor && card && camera) {
    const [sx, sy] = toScreen(anchor.at), gap = 30;
    const right = sx + gap + cardSize.width <= size.width - 16 || sx < size.width / 2;
    const left = right ? sx + gap : sx - gap - cardSize.width;
    const top = Math.max(insets.top, Math.min(size.height - insets.bottom - cardSize.height, sy - cardSize.height * 0.42));
    cardStyle = { left, top };
    if (sy > top + 12 && sy < top + cardSize.height - 12) leader = { left: right ? sx + 12 : left + cardSize.width, top: sy, width: gap - 12 };
  }
  const vb = camera && size.width ? `${camera.x - size.width / 2 / camera.k} ${camera.y - size.height / 2 / camera.k} ${size.width / camera.k} ${size.height / camera.k}` : '0 0 1 1';
  const placed = markers.map(marker => ({ marker, at: toScreen(marker.at) }));
  // Labels never cover a marker or each other; earlier labels win.
  const taken: { x: number; y: number; w: number; h: number }[] = placed.map(p => ({ x: p.at[0] - 22, y: p.at[1] - 22, w: 44, h: 44 }));
  const visibleLabels = camera ? labels.map(label => { const at = toScreen(label.at); return { label, at: [at[0], at[1] + (label.dy ?? 0)] as Point }; }).filter(({ label, at }) => {
    const w = Math.min(180, label.name.length * 6.6) + 8, h = label.name.length * 6.6 > 180 ? 34 : 18, box = { x: at[0] - w / 2, y: at[1] - h / 2, w, h };
    if (at[0] < 8 || at[0] > size.width - 8 || at[1] < insets.top || at[1] > size.height - clearBottom) return false;
    if (taken.some(t => box.x < t.x + t.w && t.x < box.x + box.w && box.y < t.y + t.h && t.y < box.y + box.h)) return false;
    taken.push(box);
    return true;
  }) : [];

  // The shared map's own zoom buttons drive this camera; level 1 is the whole walk.
  const zoomTo = (action: SetStateAction<number>) => {
    const fit = fitCamera(size.width, size.height), current = live.current ?? fit;
    const level = typeof action === 'function' ? action(current.k / fit.k) : action;
    go(level <= 1 ? fit : clamp({ ...current, k: fit.k * level }));
  };
  return <div className="route-map" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label={ariaLabel} role="group">
    <GeographicMap data={data} selected={photoView} onSelect={() => {}} hidden={false} zoom={1} setZoom={zoomTo} shown={0} className="is-canvas" viewBox={vb} words={words} underlay={<Cameras walk={walk} />}>
      <Overlay walk={walk} highlight={highlight} photoAt={photoAt} />
    </GeographicMap>
    <div className="route-labels" aria-hidden="true">
      {visibleLabels.map(({ label, at }) => <span key={label.name} style={{ left: at[0], top: at[1] }}>{label.name}</span>)}
    </div>
    <div className="route-markers">
      {placed.map(({ marker, at }) => <button key={marker.id} type="button" className="route-marker" data-state={marker.state} aria-pressed={marker.selected}
        data-rank={marker.rank} style={{ left: at[0], top: at[1] }} aria-label={marker.label} onClick={() => onMarker(marker.id)}>
        <span className="route-marker-dot" aria-hidden="true">{marker.rank ?? ''}</span>
        {marker.tag && <span className="route-marker-tag" aria-hidden="true">{marker.tag}</span>}
      </button>)}
    </div>
    {leader && <span className="route-leader" style={leader} aria-hidden="true" />}
    {card && <div className="route-card-slot" ref={cardBox} style={cardStyle ?? { left: -9999, top: 0 }}>{card}</div>}
  </div>;
});
export default RouteMap;

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { routeFrame } from '../destinations/GeographicMap';
import type { Marker } from '../destinations/RouteMap';
import { metres, type Coordinate, type Destination, type ScanMark } from '../destinations/data';
import { useLanguage } from '../i18n';
import { IconButton, markOf } from '../ui';
import { FitIcon, MinusIcon, PlusIcon } from '../ui/icons';
import { Renderer, project, type Camera, type Pin, type Vec3 } from './render';
import { groundAt, loadArea, loadSpace, nearest, pointAt, track, type Space, type Track } from './space';
import './space3d.css';

export type Space3DProps = {
  data: Destination;
  /** The same markers the route map draws; their `at` is in the route frame. */
  markers?: Marker[];
  /** Draw the scan's marks that lie near the walk, in their kinds' hues. */
  marks?: boolean;
  onMarker?: (id: string) => void;
  onMark?: (mark: ScanMark) => void;
  /** Frame these stretches of the walk instead of the whole walk. */
  focus?: number[] | null;
  /** Show only these 3D areas (capture area ids such as s01), framed together. */
  areas?: string[] | null;
  /** Assemble: the areas rise into place along the walk, the line draws, the marks land. */
  intro?: boolean;
  /** End the assembly looking straight down, framed as the map. */
  settle?: boolean;
  onIntroEnd?: () => void;
  /** No WebGL2, or the 3D could not load: show the map or the photo instead. */
  onUnavailable?: (reason: string) => void;
  /** Hide the zoom and fit controls, for a still replay. */
  still?: boolean;
  /** Read the areas from another folder than the place's package, for review. */
  from?: string;
  className?: string;
};

const WORDS = {
  en: { label: '3D from street photos', loading: 'Loading 3D', zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit the walk', built: 'built by VGGT', photos: 'Photos', more: (n: number) => `and ${n} more`, view: 'Drag to turn, pinch or scroll to zoom' },
  es: { label: '3D a partir de fotos de la calle', loading: 'Cargando 3D', zoomIn: 'Acercar', zoomOut: 'Alejar', fit: 'Ver todo el recorrido', built: 'hecho con VGGT', photos: 'Fotos', more: (n: number) => `y ${n} más`, view: 'Arrastra para girar, pellizca o desplaza para acercar' },
} as const;

/** Times of the assembly, in seconds. */
const RISE_FROM = 0.15, RISE_SPREAD = 1.5, LINE_FROM = 0.5, LINE_FOR = 1.7, PINS_FROM = 2.1, PINS_FOR = 0.55, SETTLE_FROM = 2.75, SETTLE_FOR = 1.05;
const MIN_PITCH = 0.14, MAX_PITCH = 1.5, OBLIQUE = 0.86;

const css = (name: string, fallback: string) => (typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;
function rgbOf(colour: string): Vec3 {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour);
  if (hex) { const n = parseInt(hex[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  const rgb = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(colour);
  return rgb ? [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255] : [0.6, 0.6, 0.6];
}
/** Lighter, for a mark that must read on the dark glass. */
const lift = (rgb: Vec3, by: number): Vec3 => rgb.map(c => c + (1 - c) * by) as Vec3;
const STATE_TOKEN: Record<Marker['state'], [string, string]> = {
  open: ['--blocked', '#a6501c'], barrier: ['--blocked', '#a6501c'], 'not-barrier': ['--unknown', '#5f6368'], 'no-photos': ['--unknown', '#5f6368'],
  landmark: ['--field', '#8a9095'], clear: ['--reachable', '#1f5fa8'], fixed: ['--reachable', '#1f5fa8'], added: ['--blocked', '#a6501c'], osm: ['--field', '#8a9095'],
};
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The camera that shows a set of ground points, its long side across the screen. */
function framing(points: Vec3[], aspect: number, pitch: number, walk: Track): Camera {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]), zs = points.map(p => p[2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const target: Vec3 = [(minX + maxX) / 2, (minY + maxY) / 2, zs.reduce((a, b) => a + b, 0) / zs.length];
  const first = walk.points[0] ?? [0, 0], last = walk.points.at(-1) ?? [1, 0], vx = last[0] - first[0], vy = last[1] - first[1];
  // Landscape: the walk runs left to right; portrait: it runs up the screen, away from the viewer.
  const yaw = aspect >= 1 ? Math.atan2(vy, vx) : Math.atan2(-vx, vy);
  const radius = Math.max(12, Math.hypot(maxX - minX, maxY - minY) / 2);
  const half = Math.atan(Math.tan(20 * Math.PI / 180) * Math.min(1, aspect));
  return { target, yaw, pitch, distance: radius / Math.sin(half) * 1.02 };
}

export default function Space3D({ data, markers = [], marks = true, onMarker, onMark, focus = null, areas = null, intro = false, settle = false, onIntroEnd, onUnavailable, still = false, from, className }: Space3DProps) {
  const { lang } = useLanguage();
  const words = WORDS[lang === 'es' ? 'es' : 'en'];
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const walk = useMemo(() => track(data), [data]);
  const camera = useRef<Camera | null>(null);
  const goal = useRef<{ from: Camera; to: Camera; at: number; for: number } | null>(null);
  const clock = useRef({ start: 0, done: !intro });
  const dirty = useRef(true);
  const pins = useRef<(Pin & { scan?: ScanMark })[]>([]);
  const matrix = useRef<Float32Array | null>(null);
  const callbacks = useRef({ onMarker, onMark, onIntroEnd, onUnavailable });
  callbacks.current = { onMarker, onMark, onIntroEnd, onUnavailable };

  const fail = (reason: string) => { setFailed(reason); callbacks.current.onUnavailable?.(reason); };

  // The renderer and the records.
  useEffect(() => {
    if (!canvas.current) return;
    let r: Renderer;
    try { r = new Renderer(canvas.current); } catch (error) { fail(error instanceof Error ? error.message : 'WebGL2 is not available.'); return; }
    renderer.current = r;
    const lost = (event: Event) => { event.preventDefault(); fail('The 3D view stopped.'); };
    canvas.current.addEventListener('webglcontextlost', lost);
    const controller = new AbortController();
    (async () => {
      const all = await loadSpace(data, controller.signal, from);
      const s = areas?.length ? { ...all, pieces: all.pieces.filter(p => areas.includes(p.id)) } : all;
      setSpace(s);
      // Areas rise in the order the walk passes them.
      const order = [...s.pieces].sort((a, b) => nearest(walk, ...metres(a.center, [data.origin[0], data.origin[1]])).along - nearest(walk, ...metres(b.center, [data.origin[0], data.origin[1]])).along);
      const queue = order.map((piece, i) => ({ piece, start: RISE_FROM + RISE_SPREAD * i / Math.max(1, order.length - 1) }));
      let count = 0;
      await Promise.all(queue.map(async ({ piece, start }) => {
        const area = await loadArea(s, piece, controller.signal);
        if (controller.signal.aborted) return;
        r.addArea(area, start); count++; setLoaded(count); dirty.current = true;
      }));
    })().catch(error => { if (!controller.signal.aborted) fail(error instanceof Error ? error.message : 'The 3D could not load.'); });
    const element = canvas.current;
    return () => { controller.abort(); element.removeEventListener('webglcontextlost', lost); r.dispose(); renderer.current = null; setSpace(null); setLoaded(0); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, areas?.join(',')]);

  const lineHeight = 0.3, pinHeight = 1.4;
  const ground = (east: number, north: number) => space ? groundAt(space, nearest(walk, east, north).along) : 0;

  // The walk's line on the ground.
  useEffect(() => {
    const r = renderer.current;
    if (!r || !space) return;
    const points: Vec3[] = [], along: number[] = [];
    for (let d = 0; d < walk.length; d += 2) { const [x, y] = pointAt(walk, d); points.push([x, y, groundAt(space, d) + lineHeight]); along.push(d); }
    const [x, y] = pointAt(walk, walk.length); points.push([x, y, groundAt(space, walk.length) + lineHeight]); along.push(walk.length);
    r.setLine(points, along, lift(rgbOf(css('--reachable', '#1f5fa8')), 0.35));
    dirty.current = true;
  }, [space, walk]);

  // Markers and marks as pins at their ground positions.
  useEffect(() => {
    const r = renderer.current;
    if (!r || !space) return;
    const frame = routeFrame(data), zero = frame.fromMetres(0, 0);
    const fromFrame = ([x, y]: [number, number]): [number, number] => [(x - zero[0]) / frame.scale, -(y - zero[1]) / frame.scale];
    const any = markers.some(m => m.selected);
    const list: (Pin & { scan?: ScanMark })[] = markers.map(m => {
      // A marker takes its kind's hue where the map gives it one, else its state's colour.
      const [east, north] = fromFrame(m.at as [number, number]), [token, fallback] = STATE_TOKEN[m.state] ?? ['--field', '#8a9095'], hue = m.kind ? css(`--mark-${m.kind}`, '') : '';
      return { id: m.id, at: [east, north, ground(east, north) + pinHeight], rgb: lift(rgbOf(hue || css(token, fallback)), 0.12), size: m.selected ? 30 : m.state === 'osm' ? 14 : 22, selected: m.selected, dim: any && !m.selected };
    });
    if (marks) {
      const origin: Coordinate = [data.origin[0], data.origin[1]];
      for (const mark of data.marks) {
        if (!mark.position) continue;
        const [east, north] = metres(mark.position, origin), kind = markOf(mark.concept) ?? 'road';
        list.push({ id: `mark:${mark.id}`, scan: mark, at: [east, north, ground(east, north) + 0.5], rgb: lift(rgbOf(css(`--mark-${kind}`, '#8a9095')), 0.25), size: mark.barrier ? 10 : 7, selected: false, dim: false, mark: true });
      }
    }
    pins.current = list;
    r.setPins(list);
    dirty.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space, markers, marks, data]);

  // Where the camera looks: the whole walk, or the focused stretches.
  const focusKey = focus?.join(',') ?? '';
  useEffect(() => {
    if (!space || !host.current) return;
    const { width, height } = host.current.getBoundingClientRect(), aspect = width / Math.max(1, height);
    const origin: Coordinate = [data.origin[0], data.origin[1]];
    // The intro shows the whole walk; otherwise the focused stretches, or the areas there are.
    const chosen = focus?.length ? data.stretches.filter(s => focus.includes(s.index)).flatMap(s => s.line) : intro ? data.line : space.pieces.map(p => p.center);
    const points = (chosen.length ? chosen : data.line).map(p => { const [x, y] = metres(p, origin); return [x, y, ground(x, y)] as Vec3; });
    const close = !intro || !!focus?.length;
    const to = framing(points, aspect, close ? 0.95 : OBLIQUE, walk);
    if (close) to.distance = Math.max(to.distance + 30, 70);
    if (!camera.current || reduced()) camera.current = to;
    else goal.current = { from: { ...camera.current }, to, at: performance.now(), for: 700 };
    dirty.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space, focusKey, walk, areas?.join(',')]);

  // The frame loop: draws only when something changed or moves.
  useEffect(() => {
    const r = renderer.current;
    if (!r || !space) return;
    let frame = 0, ended = !intro;
    const still = reduced();
    if (intro && !still) clock.current = { start: performance.now(), done: false };
    const resize = () => {
      const box = host.current?.getBoundingClientRect();
      if (!box) return;
      r.resize(box.width, box.height, Math.min(window.devicePixelRatio || 1, 2));
      dirty.current = true;
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (host.current) observer.observe(host.current);
    let settleFrom: Camera | null = null;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const playing = intro && !still && !clock.current.done;
      const t = playing ? (now - clock.current.start) / 1000 : 99;
      let moving = playing;
      if (goal.current && camera.current) {
        const g = goal.current, k = ease((now - g.at) / g.for);
        camera.current = { target: g.from.target.map((v, i) => v + (g.to.target[i] - v) * k) as Vec3, yaw: g.from.yaw + (g.to.yaw - g.from.yaw) * k, pitch: g.from.pitch + (g.to.pitch - g.from.pitch) * k, distance: g.from.distance * Math.pow(g.to.distance / g.from.distance, k) };
        if (k >= 1) goal.current = null;
        moving = true;
      }
      if (playing && settle && camera.current && t >= SETTLE_FROM) {
        settleFrom ??= { ...camera.current };
        const k = ease((t - SETTLE_FROM) / SETTLE_FOR);
        camera.current = { ...settleFrom, pitch: settleFrom.pitch + (MAX_PITCH + 0.06 - settleFrom.pitch) * k, yaw: settleFrom.yaw * (1 - k) };
      }
      if (!moving && !dirty.current) return;
      dirty.current = false;
      if (!camera.current) return;
      const reveal = playing ? walk.length * ease((t - LINE_FROM) / LINE_FOR) : walk.length + 1;
      const pinsK = playing ? ease((t - PINS_FROM) / PINS_FOR) : 1;
      matrix.current = r.draw({ camera: camera.current, time: t, reveal, pinsDrop: (1 - pinsK) * 14, pinsAlpha: pinsK, limit: 1 });
      if (playing && t >= SETTLE_FROM + (settle ? SETTLE_FOR : 0) + 0.1 && !ended) { ended = true; clock.current.done = true; callbacks.current.onIntroEnd?.(); }
    };
    frame = requestAnimationFrame(tick);
    if (!ended && still) { ended = true; callbacks.current.onIntroEnd?.(); }
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [space, intro, settle, walk]);

  // Touch and mouse: one finger or the left button turns, two fingers pinch and pan, the right button or Shift pans, the wheel zooms.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; at: number; moved: number; pan: boolean; spread: number } | null>(null);
  const move = (change: Partial<Camera>) => {
    if (!camera.current) return;
    goal.current = null;
    camera.current = { ...camera.current, ...change, pitch: clamp(change.pitch ?? camera.current.pitch, MIN_PITCH, MAX_PITCH), distance: clamp(change.distance ?? camera.current.distance, 6, 1600) };
    dirty.current = true;
  };
  const pan = (dx: number, dy: number) => {
    const c = camera.current, box = host.current?.getBoundingClientRect();
    if (!c || !box) return;
    const perPixel = 2 * Math.tan(20 * Math.PI / 180) * c.distance / box.height, right = [Math.cos(c.yaw), Math.sin(c.yaw)], ahead = [-Math.sin(c.yaw), Math.cos(c.yaw)];
    const forward = dy * perPixel / Math.max(0.35, Math.sin(c.pitch));
    move({ target: [c.target[0] - right[0] * dx * perPixel + ahead[0] * forward, c.target[1] - right[1] * dx * perPixel + ahead[1] * forward, c.target[2]] });
  };
  const spread = () => { const [a, b] = [...pointers.current.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
  const centre = () => { const all = [...pointers.current.values()]; return { x: all.reduce((s, p) => s + p.x, 0) / all.length, y: all.reduce((s, p) => s + p.y, 0) / all.length }; };
  const pick = (x: number, y: number) => {
    const m = matrix.current, box = host.current?.getBoundingClientRect(), r = renderer.current;
    if (!m || !box || !r) return;
    let best: { pin: (typeof pins.current)[number]; d: number } | null = null;
    for (const pin of pins.current) {
      const at = project(m, pin.at, box.width, box.height);
      if (!at) continue;
      const d = Math.hypot(at[0] - x, at[1] - y), reach = Math.max(22, pin.size / 2 + 8) + (pin.scan ? 0 : 4);
      if (pin.scan && camera.current && camera.current.distance > 140) continue;
      if (d <= reach && (!best || d - (pin.scan ? 0 : 10) < best.d - (best.pin.scan ? 0 : 10))) best = { pin, d };
    }
    if (!best) return;
    if (best.pin.scan) callbacks.current.onMark?.(best.pin.scan); else callbacks.current.onMarker?.(best.pin.id);
  };
  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const c = centre();
      gesture.current = { x: c.x, y: c.y, at: performance.now(), moved: gesture.current && pointers.current.size > 1 ? 99 : 0, pan: e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey, spread: spread() };
    },
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!pointers.current.has(e.pointerId) || !gesture.current) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesture.current, c = centre(), dx = c.x - g.x, dy = c.y - g.y;
      g.moved += Math.hypot(dx, dy);
      if (pointers.current.size >= 2) {
        const s = spread();
        if (g.spread > 0 && s > 0 && camera.current) move({ distance: camera.current.distance * g.spread / s });
        pan(dx, dy);
        g.spread = s;
      } else if (g.pan) pan(dx, dy);
      else if (camera.current) move({ yaw: camera.current.yaw - dx * 0.006, pitch: camera.current.pitch + dy * 0.005 });
      g.x = c.x; g.y = c.y;
    },
    onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => {
      const g = gesture.current, box = host.current?.getBoundingClientRect();
      pointers.current.delete(e.pointerId);
      if (g && box && pointers.current.size === 0 && g.moved < 8 && performance.now() - g.at < 500) pick(e.clientX - box.left, e.clientY - box.top);
      if (pointers.current.size === 0) gesture.current = null;
      else { const c = centre(); if (gesture.current) Object.assign(gesture.current, { x: c.x, y: c.y, spread: spread() }); }
    },
    onPointerCancel: (e: React.PointerEvent<HTMLCanvasElement>) => { pointers.current.delete(e.pointerId); if (!pointers.current.size) gesture.current = null; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); if (camera.current) move({ distance: camera.current.distance * Math.exp(clamp(e.deltaY, -120, 120) * 0.0022) }); };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  const zoom = (by: number) => { if (!camera.current) return; const to = { ...camera.current, distance: clamp(camera.current.distance * by, 6, 1600) }; if (reduced()) move(to); else goal.current = { from: { ...camera.current }, to, at: performance.now(), for: 260 }; dirty.current = true; };
  const fit = () => {
    if (!host.current || !camera.current || !space) return;
    const { width, height } = host.current.getBoundingClientRect(), origin: Coordinate = [data.origin[0], data.origin[1]];
    const to = framing(space.pieces.map(p => { const [x, y] = metres(p.center, origin); return [x, y, ground(x, y)] as Vec3; }), width / Math.max(1, height), 0.95, walk);
    to.distance = Math.max(to.distance + 30, 70);
    if (reduced()) move(to); else goal.current = { from: { ...camera.current }, to, at: performance.now(), for: 600 };
    dirty.current = true;
  };
  const keys = (e: ReactKeyboardEvent) => {
    const c = camera.current;
    if (!c) return;
    const actions: Record<string, () => void> = { ArrowLeft: () => move({ yaw: c.yaw + 0.12 }), ArrowRight: () => move({ yaw: c.yaw - 0.12 }), ArrowUp: () => move({ pitch: c.pitch + 0.08 }), ArrowDown: () => move({ pitch: c.pitch - 0.08 }), '+': () => zoom(0.8), '=': () => zoom(0.8), '-': () => zoom(1.25) };
    if (actions[e.key]) { e.preventDefault(); actions[e.key](); }
  };

  // Credits: the people whose photos built the areas shown, then the model.
  const credit = useMemo(() => {
    if (!space) return null;
    const used = new Set(space.pieces.filter(p => !focus?.length || p.stretches.some(i => focus.includes(i))).flatMap(p => p.photos));
    const names = [...new Set(data.photos.filter(p => used.has(p.id)).map(p => p.creator))].sort();
    const shown = names.slice(0, 3).join(', ');
    return `${words.photos}: ${shown}${names.length > 3 ? ` ${words.more(names.length - 3)}` : ''}, Mapillary, ${space.licence} · ${words.built}`;
  }, [space, data, focus, words]);

  if (failed) return null;
  return <div ref={host} className={['space3d', className].filter(Boolean).join(' ')} data-ready={loaded > 0 || undefined}>
    <canvas ref={canvas} className="space3d-canvas" tabIndex={0} role="img" aria-label={`${words.label}. ${words.view}.`} onKeyDown={keys} {...handlers} />
    <p className="space3d-label">{words.label}</p>
    {space && loaded < space.pieces.length && <p className="space3d-loading" role="status">{words.loading}</p>}
    {!still && <div className="space3d-controls">
      <IconButton label={words.zoomIn} surface="glass" onClick={() => zoom(0.7)}><PlusIcon /></IconButton>
      <IconButton label={words.zoomOut} surface="glass" onClick={() => zoom(1.4)}><MinusIcon /></IconButton>
      <IconButton label={words.fit} surface="glass" onClick={fit}><FitIcon /></IconButton>
    </div>}
    {credit && <p className="space3d-credit">{credit}</p>}
  </div>;
}

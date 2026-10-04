import { forwardRef, memo, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import type { Coordinate, Destination } from './data';
import GeographicMap, { routeFrame, viewSector, type MapWords } from './GeographicMap';
import { aimed, folded, framing, hazeAt, lens, tiltChosen, tiltFor, turnToward, type Box, type Lens, type Tilt, type View } from './lens';
import './destinations.css';
import './map.css';
import RouteFx from '../fx/RouteFx';
import { riseWave } from '../fx/rise';
import { useChanges } from '../fx/changes';
import type { Point, Run, Walk } from './walk';
import { AddedIcon, BollardIcon, BrokenPavementIcon, CobblestonesIcon, CrossingIcon, FixedIcon, KerbIcon, MessageIcon, NoPhotosIcon, PathIcon, RemoveIcon, StepsIcon, iconFor, type Icon } from '../ui/icons';

export type Insets = { top: number; right: number; bottom: number; left: number };
/** open: a possible barrier nobody has answered; barrier: she says it is still there; fixed: she fixed it; not-barrier: she says it
 * is none; added: her own record of something the photos missed; osm: an OpenStreetMap record, drawn quietly on the ground. */
export type MarkerState = 'open' | 'barrier' | 'not-barrier' | 'no-photos' | 'landmark' | 'clear' | 'fixed' | 'added' | 'osm';
/** What OpenStreetMap records along a walk, as the place records name the kinds. */
export type OsmKind = 'steps' | 'handrail' | 'ramp' | 'surface' | 'smoothness' | 'kerb' | 'tactile_paving' | 'crossing' | 'gate' | 'bollard' | 'bench' | 'toilets' | 'lit' | 'wheelchair';
export type MarkerIcon = OsmKind | 'path' | 'no-photos' | 'fixed' | 'added' | 'dismissed';
export type Marker = {
  id: string; at: Point; label: string; state: MarkerState; selected: boolean; rank?: number;
  /** A short caption beside the marker, such as "Steps · 340 m". Where it would collide it shortens to the part before " · ", or hides. */
  tag?: string;
  /** A small icon before the caption: one of the marker kinds, or any icon from the shared set, such as iconFor(concept). */
  icon?: MarkerIcon | Icon;
  /** Visitor messages filed at this spot, shown with the caption, or as a small count when the caption is hidden. Say it in the label too. */
  count?: number;
  /** The record says the icon's thing is missing, such as no handrail or no ramp: the icon is struck through. Say it in the label too. */
  missing?: boolean;
  /** The kind it is, such as 'steps' or 'bench', as kindOf names it: the marker takes the kind's hue. */
  kind?: string;
};
const ICONS: Partial<Record<MarkerIcon, Icon>> = {
  steps: StepsIcon, kerb: KerbIcon, path: PathIcon, 'no-photos': NoPhotosIcon, fixed: FixedIcon, added: AddedIcon, dismissed: RemoveIcon,
  surface: CobblestonesIcon, smoothness: BrokenPavementIcon, crossing: CrossingIcon, bollard: BollardIcon,
};
/** A marker's icon: its own, a marker kind's, or the shared set's for the kind it names. */
const glyphOf = (icon: Marker['icon']): Icon | null => typeof icon === 'string' ? ICONS[icon] ?? iconFor(icon === 'lit' ? 'lighting' : icon) : icon ?? null;
type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Whether a line through screen points, or a single point, passes through a box. */
function crosses(points: Point[], r: Rect) {
  return points.some((a, i) => {
    const b = points[i + 1] ?? a, dx = b[0] - a[0], dy = b[1] - a[1];
    let from = 0, to = 1;
    for (const [p, q] of [[-dx, a[0] - r.x], [dx, r.x + r.w - a[0]], [-dy, a[1] - r.y], [dy, r.y + r.h - a[1]]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const t = q / p;
      if (p < 0) from = Math.max(from, t); else to = Math.min(to, t);
      if (from > to) return false;
    }
    return true;
  });
}
/** A line beside the walk, in [lon, lat]: a way around the walk's mapped steps, or a street she added, which only the map shows. */
export type MapPath = { id: string; kind: 'around' | 'street'; line: Coordinate[] };
/** What the camera can show: the whole walk, some points (a spot's path, a finding, a message's spots), or a photo's view on the
 * ground with any points, such as the spot it shows. */
export type Shot = { kind: 'route' } | { kind: 'points'; points: Point[] } | { kind: 'photo'; view: string; points?: Point[] };
export type MapHandle = {
  /** The whole walk at its own bearing. */
  fit: (animate?: boolean) => void;
  /** Moves the camera so a map point lands on a screen point, optionally closer in. */
  focus: (at: Point, screen: Point, zoom?: number) => void;
  /** Shows every given point inside the free part of the screen, never closer than a street. */
  frame: (points: Point[], free: Insets) => void;
  /** Shows a shot whole inside the free part of the screen, the insets by default, never closer than a street. The whole walk
   * returns to its own bearing; points keep the bearing the map has; a photo's view turns the map only as far as it takes to look
   * up the screen, the way the photo looks. */
  show: (shot: Shot, free?: Insets, animate?: boolean) => void;
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
  /** A tap on the map itself, never on a marker or a photo that opens: where it landed, the scale there so the caller can judge
   * what is near, and its [lon, lat]. */
  onMap: (at: Point, pixelsPerUnit: number, lonLat: Coordinate) => void;
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
  /** A settled map raises its blocks from the walk outward as it first shows. */
  riseIn?: boolean;
  /** Called with the map's projection whenever it changes, to draw in step with the map. It runs on every frame of a move. */
  onLens?: (lens: Lens) => void;
  /** A fine pointer entering a marker, or keyboard focus reaching it, with its id; null when it leaves. Touch never hovers. */
  onHover?: (markerId: string | null) => void;
  /** A marker the page points at, such as a hovered message row: drawn raised, without moving the camera. */
  hovered?: string | null;
  /** The page asks her to tap a place: a crosshair, and a ring under a fine pointer where her tap would land, on the walk, or
   * anywhere when 'free'. The tap still arrives through onMap. */
  picking?: boolean | 'free';
  /** Lines beside the walk, drawn under it. "Whole route" shows them too. */
  paths?: MapPath[];
};

const quiet = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const NO_PATHS: MapPath[] = [];
/** The point of a polyline nearest a point. */
function nearestOn(points: Point[], p: Point): Point {
  let best: Point = points[0] ?? p, d = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b[0] - a[0], dy = b[1] - a[1], squared = dx * dx + dy * dy;
    const u = squared ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / squared)) : 0, q: Point = [a[0] + u * dx, a[1] + u * dy];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) < d) { d = Math.hypot(q[0] - p[0], q[1] - p[1]); best = q; }
  }
  return best;
}
const line = (points: Point[], to?: (p: Point) => Point) => points.map(p => to ? to(p) : p).map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
const settle = (t: number) => 1 - Math.pow(1 - t, 3);
const sway = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
/** How long the map takes to lean back once the reveal has landed on it. */
const LEAN_FOR = 1000;
/** A camera move; arc is how far it draws back halfway, so a long flight keeps both ends in sight. */
type Tween = { from: View; to: View; started: number; duration: number; ease: (t: number) => number; arc?: number };

/** Every recorded photo position, faint and one size at any zoom or lean, and the photos that open a little stronger. */
const Cameras = memo(function Cameras({ walk, open, lens }: { walk: Walk; open: Point[]; lens: Lens | null }) {
  const dots = (points: Point[]) => points.map(c => { const p = lens ? lens.at(c) : c; return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}h0`; }).join('');
  return <g className="route-cameras"><path d={dots(walk.cameras)} /><path d={dots(open)} className="is-open-ring" /><path d={dots(open)} className="is-open" /></g>;
});
/** Over the shared map's blue walk: the stretches without photos, the selected spot, and where the open photo was taken. */
const Overlay = memo(function Overlay({ unseen, highlight, photo, lens }: { unseen: Run[]; highlight: Point[] | null; photo: Point | null; lens: Lens | null }) {
  const to = lens ? (p: Point) => lens.at(p) : undefined, at = photo && (to ? to(photo) : photo);
  return <g className="route-overlay">
    {unseen.map((run, i) => <g key={i}><polyline className="route-unseen-cover" points={line(run.path, to)} /><polyline className="route-unseen" points={line(run.path, to)} /></g>)}
    {highlight && <><polyline className="route-highlight-halo" points={line(highlight, to)} /><polyline className="route-highlight" points={line(highlight, to)} /></>}
    {at && <><path className="route-photo-ring" d={`M${at[0].toFixed(1)} ${at[1].toFixed(1)}h0`} /><path className="route-photo-at" d={`M${at[0].toFixed(1)} ${at[1].toFixed(1)}h0`} /></>}
  </g>;
});

/** Lines beside the walk, under it: a way around in a quieter blue, a street she added as a thin dashed line. */
const Paths = memo(function Paths({ paths, lens }: { paths: { id: string; kind: MapPath['kind']; points: Point[] }[]; lens: Lens | null }) {
  const to = lens ? (p: Point) => lens.at(p) : undefined;
  return <g className="route-paths">{paths.map(path => <g key={path.id} data-kind={path.kind}>
    <polyline className="route-path-halo" points={line(path.points, to)} /><polyline className="route-path-line" points={line(path.points, to)} />
  </g>)}</g>;
});

/** The walk shaded by what was found: a soft clay glow where a barrier may be, a grey hatch where no photo was taken. */
const Zones = memo(function Zones({ walk, unseen, glowing, lens }: { walk: Walk; unseen: Run[]; glowing: string; lens: Lens | null }) {
  const hatch = useId(), to = lens ? (p: Point) => lens.at(p) : undefined, ids = new Set(glowing.split(' '));
  return <g className="route-zones">
    <defs><pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5" /></pattern></defs>
    {unseen.map((run, i) => <polyline key={`u${i}`} points={line(run.path, to)} className="is-unseen" stroke={`url(#${hatch})`} />)}
    {walk.spots.filter(spot => ids.has(spot.id)).map(spot => <g key={spot.id}><polyline points={line(spot.path, to)} className="is-glow-wide" /><polyline points={line(spot.path, to)} className="is-glow" /></g>)}
  </g>;
});

/** Moves apart markers whose targets would overlap on screen, so each keeps a whole one, and steps them off any box the map keeps
 * clear by the shortest way out; a selected marker stays where it is. */
function spread(points: Point[], pinned: boolean[], gap: number, avoid: Rect[] = []): Point[] {
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
    for (let i = 0; i < out.length; i++) for (const r of avoid) {
      const [x, y] = out[i];
      if (pinned[i] || x <= r.x || x >= r.x + r.w || y <= r.y || y >= r.y + r.h) continue;
      const ways: Point[] = [[r.x - x, 0], [r.x + r.w - x, 0], [0, r.y - y], [0, r.y + r.h - y]];
      const [dx, dy] = ways.reduce((a, b) => Math.hypot(a[0], a[1]) <= Math.hypot(b[0], b[1]) ? a : b);
      out[i] = [x + dx, y + dy];
      moved = true;
    }
    if (!moved) break;
  }
  return out;
}

const RouteMap = forwardRef<MapHandle, Props>(function RouteMap({ data, walk, photoView, markers, labels, insets, highlight, onMarker, onMap, onPhoto, card, cardFor, ariaLabel, clearBottom, words, still = false, settled = false, riseIn = false, onLens, onHover, hovered = null, picking = false, paths = NO_PATHS }, ref) {
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
  /** The runs of the walk no photo shows. A walk built from the map alone had no photos read at all, so it draws plain. */
  const unseen = useMemo(() => data.photos.length ? walk.runs.filter(run => run.kind === 'no-photos') : [], [data, walk]);
  const frameOf = useMemo(() => routeFrame(data), [data]), perMetre = frameOf.scale;
  // Kept by what the lines are, so a page that builds them anew on every render does not move the camera.
  const pathsKey = JSON.stringify(paths);
  const drawn = useMemo(() => (JSON.parse(pathsKey) as MapPath[]).map(path => ({ id: path.id, kind: path.kind, points: path.line.map(walk.project) })), [pathsKey, walk]);
  /** The whole route with the lines beside it, and a key for it; lines reaching far beyond the walk are left out, so it stays large. */
  const whole = useMemo(() => {
    const span = (points: Point[]) => { const xs = points.map(p => p[0]), ys = points.map(p => p[1]); return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1); };
    const near = drawn.filter(path => path.points.length && span([...reach, ...path.points]) <= span(reach) * 1.5);
    return { points: [...reach, ...near.flatMap(path => path.points)], key: near.map(path => `${path.id}:${path.points.length}`).join(' ') };
  }, [reach, drawn]);
  /** The flat fit and the free box it fills, from the insets or the free part of the screen given. */
  const fitFlat = useCallback((width: number, height: number, i: Insets = insetsRef.current) => {
    const { minX, minY, maxX, maxY } = walk.extent;
    const w = Math.max(1, width - i.left - i.right), h = Math.max(1, height - i.top - i.bottom);
    const k = Math.min(w / Math.max(maxX - minX, 40), h / Math.max(maxY - minY, 40)) * 0.9;
    const sx = i.left + w / 2, sy = i.top + h / 2;
    const flat: View = { k, x: (minX + maxX) / 2 - (sx - width / 2) / k, y: (minY + maxY) / 2 - (sy - height / 2) / k, lean: 0 };
    const free: Box = { left: i.left + w * 0.05, top: i.top + h * 0.05, right: width - i.right - w * 0.05, bottom: height - i.bottom - h * 0.05 };
    return { flat, free, key: [width, height, i.top, i.right, i.bottom, i.left].join(' ') };
  }, [walk]);
  /** The lean for a screen, turned to lay the walk across or stand it upright, whichever shows it larger in the free box the screen
   * first has. It is kept for that screen size, so a sheet growing or shrinking never turns the map under her. */
  const aims = useRef(new Map<string, Tilt>());
  const tiltOf = useCallback((width: number, height: number): Tilt => {
    const { flat, free } = fitFlat(width, height), key = `${width} ${height}`, known = aims.current.get(key);
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
  const rise = tilt.rise * perMetre;

  // Fitting a leaning map takes a few passes, and every drag asks for the fit, so keep it per screen and lean.
  const fits = useRef(new Map<string, View>());
  // The first framing shows the walk alone, as the reveal before it did; "Whole route" shows the lines beside it too.
  const fitCamera = useCallback((width: number, height: number, lean = goal.current, i?: Insets, beside = false): View => {
    const { flat, free, key } = fitFlat(width, height, i), points = beside && whole.key ? whole.points : reach, at = `${key} ${lean} ${beside ? whole.key : ''}`, known = fits.current.get(at);
    if (known) return known;
    const fit = lean ? framing(points, free, lean, tiltOf(width, height), width, height, flat) : flat;
    fits.current.set(at, fit);
    return fit;
  }, [reach, whole, fitFlat, tiltOf]);
  useEffect(() => { aims.current.clear(); }, [tiltOf]);
  useEffect(() => { fits.current.clear(); }, [fitCamera]);

  // One loop moves the camera and the lean; a gesture stops the camera and leaves the lean to finish.
  const tween = useRef<Tween | null>(null);
  const leanTween = useRef<{ from: number; to: number; started: number } | null>(null);
  /** When a settled map began raising its blocks; each frame of the rise draws the map again without moving its camera. */
  const riseTween = useRef<number | null>(null);
  const [, setRiseFrame] = useState(0);
  const frame = useRef(0);
  const step = useRef<(now: number) => void>(() => {});
  step.current = now => {
    frame.current = 0;
    let next = live.current;
    if (!next) return;
    const c = tween.current, l = leanTween.current;
    if (c) {
      const t = Math.min(1, (now - c.started) / c.duration), e = c.ease(t);
      const turn = (c.from.turn ?? 0) + ((c.to.turn ?? 0) - (c.from.turn ?? 0)) * e;
      const back = 1 + (c.arc ?? 0) * Math.sin(Math.PI * e);
      next = { ...next, x: c.from.x + (c.to.x - c.from.x) * e, y: c.from.y + (c.to.y - c.from.y) * e, k: c.from.k * Math.pow(c.to.k / c.from.k, e) / back, turn };
      if (t >= 1) tween.current = null;
    }
    if (l) {
      const t = Math.min(1, (now - l.started) / LEAN_FOR);
      next = { ...next, lean: l.from + (l.to - l.from) * sway(t) };
      if (t >= 1) leanTween.current = null;
    }
    if (riseTween.current != null) {
      if (now - riseTween.current >= LEAN_FOR) riseTween.current = null;
      setRiseFrame(n => n + 1);
    }
    live.current = next; setCamera(next);
    if (tween.current || leanTween.current || riseTween.current != null) frame.current = requestAnimationFrame(time => step.current(time));
  };
  const run = useCallback(() => { if (!frame.current) frame.current = requestAnimationFrame(time => step.current(time)); }, []);
  const go = useCallback((aim: View, animate = true) => {
    const from = live.current;
    // The map turns the shorter way round.
    const target = from ? { ...aim, turn: (from.turn ?? 0) + folded((aim.turn ?? 0) - (from.turn ?? 0)) } : aim;
    if (!from || !animate || quiet()) { tween.current = null; const next = { ...target, lean: from?.lean ?? target.lean }; live.current = next; setCamera(next); return; }
    // A long flight draws back halfway, as far as keeps both ends on screen; it and a move that turns the map take longer, so
    // the turn reads as one with the flight.
    const screen = box.current ? Math.hypot(box.current.clientWidth, box.current.clientHeight) : 1000;
    const far = Math.hypot(target.x - from.x, target.y - from.y), mean = Math.sqrt(from.k * target.k), both = far ? 0.6 * screen / far : Infinity;
    const arc = mean > both ? Math.min(4, mean / both - 1) : 0, turning = Math.abs((target.turn ?? 0) - (from.turn ?? 0));
    tween.current = { from, to: target, started: performance.now(), duration: 520 + Math.min(400, Math.max(turning * 3, arc * 160)), ease: settle, arc };
    run();
  }, [run]);
  // As close as nine times the whole walk, or 30 m across the screen for a long walk.
  const limits = useCallback(() => { const fit = fitCamera(size.width, size.height).k; return { min: fit * 0.6, max: Math.max(fit * 9, Math.min(size.width, size.height) / (30 * perMetre)) }; }, [fitCamera, size, perMetre]);
  /** Keeps the walk on screen whatever the person drags. */
  const clamp = useCallback((c: View): View => {
    const { minX, minY, maxX, maxY } = walk.extent, { min, max } = limits(), k = Math.max(min, Math.min(max, c.k));
    const hw = size.width / 2 / k, hh = size.height / 2 / k;
    return { ...c, k, x: Math.max(minX - hw + 30 / k, Math.min(maxX + hw - 30 / k, c.x)), y: Math.max(minY - hh + 30 / k, Math.min(maxY + hh - 30 / k, c.y)) };
  }, [walk, limits, size]);
  /** The view at a zoom, lean and turn that puts a map point under a screen point. */
  const place = useCallback((at: Point, screen: Point, k: number, lean: number, turn = 0): View => {
    const offset = lens({ x: 0, y: 0, k, lean, turn }, tiltOf(size.width, size.height), size.width, size.height).ground(screen);
    return { x: at[0] - offset[0], y: at[1] - offset[1], k, lean, turn };
  }, [size, tiltOf]);

  useLayoutEffect(() => {
    const element = box.current!;
    const measure = () => { const r = element.getBoundingClientRect(); setSize(s => s.width === r.width && s.height === r.height ? s : { width: r.width, height: r.height }); };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // The first size frames the whole walk; a new size keeps the camera in bounds.
  const fitted = useRef(false), measured = useRef('');
  useEffect(() => {
    if (!size.width || !size.height) return;
    const key = `${size.width} ${size.height}`;
    if (!fitted.current) {
      fitted.current = true; go(fitCamera(size.width, size.height), false);
      if (settled && riseIn && !quiet()) { riseTween.current = performance.now(); run(); }
    }
    else if (live.current && measured.current !== key) go(clamp(live.current), false);
    measured.current = key;
  }, [size, fitCamera, go, clamp, settled, riseIn, run]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // The reveal lands on the flat map, which it can match; once it has gone, the map leans back.
  const [landed, setLanded] = useState(false);
  /** As the map first leans or rises, its blocks go up from the walk outward. */
  const wave = useMemo(() => riseWave(data, walk, LEAN_FOR), [data, walk]);
  const rising = leanTween.current?.started ?? riseTween.current;
  /** While a replay covers this map its spots wait; once it lifts, or as the map leans in, they arrive in walking order. */
  const [arriving, setArriving] = useState<'wait' | 'go' | null>(() => !still && leaning && !!document.querySelector('.reveal') ? 'wait' : null);
  useEffect(() => {
    if (!landed || still) return;
    if (quiet()) { setArriving(null); return; }
    setArriving('go');
    const timer = window.setTimeout(() => setArriving(null), 1400);
    return () => clearTimeout(timer);
  }, [landed, still]);
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
  const creditText = credit ? words.credit : '© OSM';

  // The marker raised by a fine pointer or keyboard focus, as the map sees it, so a page that does not point at markers itself
  // still gets the raise and the motion layer's ring; a marker the page points at comes first. Only a pointer that really moves
  // raises one: a marker sliding under a still pointer as the camera flies does not, nor any for a moment after one is chosen.
  const [pointed, setPointed] = useState<string | null>(null);
  const pointedNow = useRef<string | null>(null), moving = useRef<PointerEvent | null>(null), quietUntil = useRef(0);
  useEffect(() => {
    if (still) return;
    let last: [number, number] | null = null;
    // Captured first, so a marker hearing the same move knows whether the pointer went anywhere.
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || (last && Math.abs(event.clientX - last[0]) + Math.abs(event.clientY - last[1]) < 1)) return;
      last = [event.clientX, event.clientY]; moving.current = event;
    };
    addEventListener('pointermove', move, { capture: true, passive: true });
    return () => removeEventListener('pointermove', move, { capture: true });
  }, [still]);
  const lifted = hovered ?? (markers.some(marker => marker.id === pointed) ? pointed : null);
  const raise = (id: string | null) => { if (pointedNow.current === id) return; pointedNow.current = id; setPointed(id); onHover?.(id); };

  // The selected marker, or the one last opened while it is still in view, stays in the free band between the place title
  // and the guide, or any sheet, as they change. Panning or the whole route lets the last one go.
  const chosen = markers.find(marker => marker.selected) ?? null;
  const lastOpened = useRef<string | null>(null);
  /** When a page last framed a shot; a selection it framed needs no other move. */
  const shown = useRef(0);
  useEffect(() => {
    if (chosen) lastOpened.current = chosen.id;
    // A page that frames its selection does so a moment later; wait for it, so the camera makes one move, not two.
    const since = performance.now(), timer = window.setTimeout(() => {
      const spot = chosen ?? markers.find(marker => marker.id === lastOpened.current) ?? null, current = tween.current?.to ?? live.current;
      if (shown.current >= since || !spot || !current || !size.height) return;
      const top = insetsRef.current.top, bottom = size.height - clearBottom, aim = { ...current, lean: goal.current };
      const [x, y] = lens(aim, tiltOf(size.width, size.height), size.width, size.height).at(spot.at);
      if (!chosen && (x < 0 || x > size.width || y < 0 || y > size.height)) return;
      if (y >= top && y <= bottom - 28) return;
      go(clamp(place(spot.at, [x, Math.max(Math.min((top + bottom) / 2, bottom - 28), Math.min(top + 28, bottom - 28))], aim.k, aim.lean, aim.turn)));
    }, 200);
    return () => clearTimeout(timer);
  // Only a new selection or a new band moves the camera; a person's own panning is left alone.
  }, [chosen?.id, clearBottom]);

  /** Frames a shot inside the free part of the screen; see MapHandle.show. */
  const show = useCallback((shot: Shot, free: Insets = insetsRef.current, animate = true) => {
    const { width, height } = size;
    if (!width || !height) return;
    shown.current = performance.now();
    if (shot.kind === 'route') { lastOpened.current = null; go(fitCamera(width, height, goal.current, free, true), animate); return; }
    const lean = goal.current, current = tween.current?.to ?? live.current ?? fitCamera(width, height), tilt = tiltOf(width, height);
    const sector = shot.kind === 'photo' ? viewSector(data, shot.view, walk.project, perMetre) : null;
    const points = [...(shot.points ?? []), ...(sector?.points ?? [])];
    if (!points.length) return;
    // Never closer than a street: whatever is shown keeps 35 m around its middle in view.
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]), mid: Point = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    const street = Array.from({ length: 12 }, (_, i): Point => [mid[0] + Math.cos(i * Math.PI / 6) * 35 * perMetre, mid[1] + Math.sin(i * Math.PI / 6) * 35 * perMetre]);
    // The margin inside the free box shrinks with it, so a short box still shows the shot whole; a marker stands above its spot.
    const w = Math.max(1, width - free.left - free.right), h = Math.max(1, height - free.top - free.bottom), mx = Math.min(28, w * 0.08), my = Math.min(28, h * 0.08);
    const inner: Box = { left: free.left + mx, top: free.top + my + Math.min(22, h * 0.08), right: width - free.right - mx, bottom: height - free.bottom - my };
    const fit = fitCamera(width, height).k, at = (turn: number) => framing([...points, ...street], inner, lean, tilt, width, height, { ...current, turn }, { min: fit * 0.6, max: Infinity });
    // The flat map never turns. A photo's view turns the map to look up the screen; points keep the bearing the map has, unless
    // the walk's own bearing shows them clearly larger.
    const kept = current.turn ?? 0;
    if (!lean || !sector) { const keep = at(kept), home = lean && kept ? at(0) : keep; go(clamp(home.k > keep.k * 1.2 ? home : keep), animate); return; }
    go(clamp(at(turnToward(sector.heading, tilt, kept))), animate);
  }, [size, go, fitCamera, tiltOf, data, walk, perMetre, clamp]);

  useImperativeHandle(ref, () => ({
    fit: (animate = true) => show({ kind: 'route' }, undefined, animate),
    focus: (at, screen, zoom) => {
      const current = live.current ?? fitCamera(size.width, size.height);
      go(clamp(place(at, screen, Math.max(current.k, zoom ?? current.k), goal.current, current.turn)));
    },
    frame: (points, free) => show({ kind: 'points', points }, free),
    show,
    size: () => ({ ...size, fitK: fitCamera(size.width, size.height).k }),
  }), [go, fitCamera, clamp, place, size, show]);

  const view = useMemo(() => camera && size.width ? lens(camera, tilt, size.width, size.height) : null, [camera, tilt, size]);
  useEffect(() => { if (view && onLens) onLens(view); }, [view, onLens]);
  const toScreen = (p: Point): Point => view ? view.at(p) : [-999, -999];

  // Asked to tap a place, a ring follows a fine pointer where the tap would land.
  const [pick, setPick] = useState<Point | null>(null);
  useEffect(() => { if (!picking) setPick(null); }, [picking]);

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
    if (picking && view && event.pointerType !== 'touch' && !pointers.current.size) {
      const { x, y } = local(event), at = view.ground([x, y]), on = picking === 'free' ? at : nearestOn(walk.route, at), seen = view.at(on);
      setPick(picking === 'free' || Math.hypot(seen[0] - x, seen[1] - y) <= 28 ? on : null);
    }
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
    const next = clamp(place(anchor, [x, y], k, live.current?.lean ?? g.camera.lean, g.camera.turn));
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
    const near = onPhoto && !picking ? openable.map(photo => ({ photo, d: Math.hypot(view.at(photo.at)[0] - point.x, view.at(photo.at)[1] - point.y) })).filter(item => item.d <= 22).sort((a, b) => a.d - b.d)[0] : undefined;
    if (near && onPhoto) { onPhoto(near.photo.viewId); return; }
    const at = view.ground([point.x, point.y]); onMap(at, view.scale(at), frameOf.unproject(at));
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
      const next = clamp(place(anchor, [sx, sy], c.k * Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0018)), c.lean, c.turn));
      live.current = next; setCamera(next);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [clamp, place, still, tiltOf]);

  /** Markers one of her edits has just changed, so the marker and the motion layer can show what the edit did. */
  const changes = useChanges(markers);

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
  // The flat map frames itself through the view box, which the reveal lands on; a leaning map is drawn in screen pixels.
  const flat = !view || view.view.lean < 0.001;
  const controls = box.current?.querySelector('.destination-map-controls')?.getBoundingClientRect(), bounds = box.current?.getBoundingClientRect();
  const zoomBox: Rect | null = controls && bounds && controls.width ? { x: controls.left - bounds.left - 8, y: controls.top - bounds.top - 8, w: controls.width + 16, h: controls.height + 16 } : null;
  // The credit chip takes the bottom corner of the free map that the whole walk leaves clear, the right one when both are, judged
  // at the whole-route framing with the chip open, so it never hops while the map moves or the chip folds. Where the open line
  // would cover the walk either way, it folds sooner, before the light reaches the end of the walk.
  const creditBottom = Math.max(4, clearBottom + 4), creditMiddle = size.height - creditBottom - 22, chip = (x: number, w: number): Rect => ({ x: x - 4, y: creditMiddle - 16, w: w + 8, h: 32 });
  const { left: creditLeft, crowded } = (() => {
    if (still || !camera) return { left: false, crowded: false };
    const whole = lens(fitCamera(size.width, size.height), tilt, size.width, size.height), w = Math.max(60, words.credit.length * 6.6 + 18);
    const seen = (r: Rect) => crosses(walk.route.map(p => whole.at(p)), r) || crosses([whole.at(walk.target.at)], { x: r.x - 8, y: r.y - 8, w: r.w + 16, h: r.h + 16 });
    const left = chip(Math.max(8, insets.left), w), right = seen(chip(size.width - Math.max(8, insets.right) - w, w));
    return right && !seen(left) && !(zoomBox && overlaps(zoomBox, left)) ? { left: true, crowded: false } : { left: false, crowded: right };
  })();
  const creditWidth = Math.max(60, creditText.length * 6.6 + 18), creditX = creditLeft ? Math.max(8, insets.left) : size.width - Math.max(8, insets.right) - creditWidth;
  useEffect(() => {
    if (leaning && !landed) return;
    const timer = window.setTimeout(() => setCredit(false), crowded ? 3000 : 6000);
    return () => clearTimeout(timer);
  }, [leaning, landed, crowded]);
  // Markers sit on their spots unless their 44 px targets would overlap, or a marker would cover the credit chip; then they step
  // aside, and a hairline leads back. The chip's box is kept clear of a marker's dot, which floats 11 px up on a leaning map.
  const clearOf = (lift: number): Rect[] => still ? [] : [{ x: creditX - 14, y: creditMiddle - 25.5 + lift, w: creditWidth + 28, h: 51 }], keepClear = clearOf(flat ? 0 : 11);
  // An OpenStreetMap record stays on its spot, under the others, and never pushes one aside unless it is the one chosen.
  const spots = markers.map(marker => toScreen(marker.at)), standing = markers.flatMap((marker, i) => marker.state !== 'osm' || marker.selected ? [i] : []);
  const apart = [...spots], stepped = spread(standing.map(i => spots[i]), standing.map(i => markers[i].selected), 46, keepClear);
  standing.forEach((i, j) => { apart[i] = stepped[j]; });
  // The quiet ones lie on the ground and give way to the credit chip.
  const chipBox = clearOf(0)[0], under = (p: Point) => !!chipBox && p[0] > chipBox.x && p[0] < chipBox.x + chipBox.w && p[1] > chipBox.y && p[1] < chipBox.y + chipBox.h;
  const placed = markers.map((marker, i) => ({ marker, spot: spots[i], at: apart[i], nudged: Math.hypot(apart[i][0] - spots[i][0], apart[i][1] - spots[i][1]) > 3 }))
    .filter(({ marker, spot }) => marker.state !== 'osm' || marker.selected || !under(spot));
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
  const vb = camera && size.width ? `${camera.x - size.width / 2 / camera.k} ${camera.y - size.height / 2 / camera.k} ${size.width / camera.k} ${size.height / camera.k}` : '0 0 1 1';
  /** Spots that may hold a barrier glow along the walk until someone decides otherwise. */
  const glowing = markers.filter(marker => marker.state === 'open' || marker.state === 'barrier').map(marker => marker.id).join(' ');
  /** Markers that the lean pushes up under the place title lose their tags; every marker's dot fades with the haze it stands in,
   * while its caption and count keep their full contrast. */
  const far = (at: Point) => !flat && at[1] < insets.top - 8 ? '' : undefined;
  const faded = (marker: Marker, at: Point) => flat || marker.selected ? undefined : +(1 - 0.6 * hazeAt(at[1], size.height, view!.view.lean)).toFixed(2);
  // Captions and map words never cover a marker or each other; the selected and hovered markers' captions go first.
  const quietly = (marker: Marker) => marker.state === 'osm' && !marker.selected && marker.id !== lifted;
  const own = new Map(placed.filter(p => !quietly(p.marker)).map(p => [p.marker.id, { x: p.at[0] - 22, y: p.at[1] - 22, w: 44, h: 44 }] as const));
  const taken: Rect[] = [...own.values()], boxes = new Set(taken);
  if (zoomBox) taken.push(zoomBox);
  if (!still) taken.push(chip(creditX, creditWidth));
  const captions = new Map<string, { side: 'right' | 'left'; text: string }>();
  for (const { marker, at } of [...placed].sort((a, b) => Number(b.marker.selected || b.marker.id === lifted) - Number(a.marker.selected || a.marker.id === lifted))) {
    if (!marker.tag || !camera || quietly(marker)) continue;
    const y = at[1] - (flat ? 0 : 11), raised = marker.selected || marker.id === lifted, forms = [...new Set([marker.tag, marker.tag.split(' · ')[0]])];
    for (const text of forms) {
      const w = Math.round(text.length * 7 + 18 + (marker.icon ? 15 : 0) + (marker.count ? 26 : 0)), h = size.width > 640 ? 23 : 24;
      const side = (['right', 'left'] as const).find(side => {
        const rect = { x: side === 'right' ? at[0] + 14 : at[0] - 14 - w, y: y - h / 2, w, h };
        // A caption stays in the part of the map the page keeps free, so a panel over the map never hides one.
        if (rect.x < Math.max(8, insets.left - 24) || rect.x + w > size.width - Math.max(8, insets.right - 24) || rect.y + h > size.height - clearBottom || (!raised && rect.y < insets.top - 4) || rect.y < 4) return false;
        // The chosen marker's caption may cover other markers; every other caption keeps clear of them.
        if (taken.some(other => other !== own.get(marker.id) && !(marker.selected && boxes.has(other)) && overlaps(other, rect))) return false;
        taken.push(rect);
        return true;
      });
      if (side) { captions.set(marker.id, { side, text }); break; }
    }
  }
  // A map word wraps at 180 px, or 130 px on a phone, as map.css sets.
  const wraps = size.width > 640 ? 180 : 130;
  const visibleLabels = camera ? labels.map(label => { const at = toScreen(label.at); return { label, at: [at[0], at[1] + (label.dy ?? 0)] as Point }; }).filter(({ label, at }) => {
    const long = label.name.length * 6.6, w = Math.min(wraps, long) + 8, h = Math.ceil(long / wraps) * 16 + 2, box = { x: at[0] - w / 2, y: at[1] - h / 2, w, h };
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
    if (level <= 1) show({ kind: 'route' }); else go(clamp({ ...current, k: fit.k * level }));
  };
  // How much a circle on the ground flattens, for the ring under the selected marker; and the free part of the map, so a page can
  // keep its controls in it.
  const frameStyle = { '--squash': flat ? undefined : Math.cos((camera?.lean ?? 0) * tilt.pitch * Math.PI / 180).toFixed(3),
    '--map-free-top': `${insets.top}px`, '--map-free-right': `${insets.right}px`, '--map-free-bottom': `${insets.bottom}px`, '--map-free-left': `${insets.left}px` } as CSSProperties;
  const picked = pick && view ? view.at(pick) : null;
  return <div className="route-map" ref={box} data-still={still || undefined} data-lean={flat ? undefined : ''} data-arriving={arriving ?? undefined} data-picking={picking && !still ? '' : undefined} style={frameStyle}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => setPick(null)} aria-label={ariaLabel} role="group">
    <GeographicMap data={data} selected={photoView} onSelect={() => {}} hidden={false} zoom={1} setZoom={zoomTo} shown={0} className="is-canvas" viewBox={vb} words={words} still={still} credit={still}
      lens={flat ? undefined : view} rise={rise} riseOf={rising != null ? id => wave(id, performance.now() - rising) : undefined} underlay={<><Zones walk={walk} unseen={unseen} glowing={glowing} lens={flat ? null : view} /><Paths paths={drawn} lens={flat ? null : view} /><Cameras walk={walk} open={openDots} lens={flat ? null : view} /></>}>
      <Overlay unseen={unseen} highlight={highlight} photo={photoAt} lens={flat ? null : view} />
    </GeographicMap>
    {!still && <RouteFx data={data} walk={walk} lens={view} tilt={view?.tilt} markers={markers} hover={lifted} changes={changes} />}
    <div className="route-labels" aria-hidden="true">
      {visibleLabels.map(({ label, at }) => <span key={label.name} style={{ left: at[0], top: at[1] }}>{label.name}</span>)}
    </div>
    {/* A backdrop keeps the plain credit line its page places; a map people use gets the folding control, under its markers. */}
    {!still && <button type="button" className="route-credit" aria-expanded={credit} aria-label={words.credit} onClick={() => setCredit(open => !open)}
      style={creditLeft ? { left: Math.max(8, insets.left), bottom: creditBottom } : { right: Math.max(8, insets.right), bottom: creditBottom }}><span data-tone="dark">{creditText}</span></button>}
    <div className="route-markers">
      <svg className="route-nudges" aria-hidden="true">{placed.filter(p => p.nudged).map(({ marker, spot, at }) => <g key={marker.id}><line x1={spot[0]} y1={spot[1]} x2={at[0]} y2={at[1]} /><circle cx={spot[0]} cy={spot[1]} r="2.5" /></g>)}</svg>
      {placed.map(({ marker, at }) => {
        const caption = captions.get(marker.id), count = marker.count ? marker.count > 99 ? '99+' : String(marker.count) : '';
        const Glyph = glyphOf(marker.icon);
        const inside = <>
          <span className="route-marker-dot" aria-hidden="true">{marker.state === 'osm' && Glyph ? <Glyph size={12} /> : marker.rank ?? ''}</span>
          {count && !caption && <span className="route-marker-count" aria-hidden="true">{count}</span>}
          {caption && <span className="route-marker-tag" aria-hidden="true">{Glyph && <Glyph size={13} />}{caption.text}{count && <span className="route-marker-said"><MessageIcon size={12} />{count}</span>}</span>}
        </>;
        const shared = { className: 'route-marker', 'data-state': marker.state, 'data-rank': marker.rank, 'data-far': far(at), 'data-side': caption?.side, 'data-hovered': marker.id === lifted || undefined, 'data-missing': marker.missing || undefined, 'data-mark': marker.kind, 'data-change': changes.get(marker.id)?.change, 'data-was': changes.get(marker.id)?.was ?? undefined, style: { left: at[0], top: at[1], '--haze': faded(marker, at) } as CSSProperties };
        return still ? <span key={marker.id} {...shared} aria-hidden="true">{inside}</span>
          : <button key={marker.id} type="button" {...shared} aria-pressed={marker.selected} aria-label={marker.label} onClick={() => { quietUntil.current = performance.now() + 650; onMarker(marker.id); }}
            onPointerMove={event => { if (event.nativeEvent === moving.current && performance.now() >= quietUntil.current) raise(marker.id); }} onPointerLeave={() => { if (pointedNow.current === marker.id) raise(null); }}
            onFocus={event => { if (event.currentTarget.matches(':focus-visible')) raise(marker.id); }} onBlur={() => { if (pointedNow.current === marker.id) raise(null); }}>{inside}</button>;
      })}
    </div>
    {picked && <span className="route-pick" style={{ left: picked[0], top: picked[1] }} aria-hidden="true" />}
    {leader && <span className="route-leader" style={leader} aria-hidden="true" />}
    {card && <div className="route-card-slot" ref={cardBox} style={cardStyle ?? { left: -9999, top: 0 }}>{card}</div>}
  </div>;
});
export default RouteMap;

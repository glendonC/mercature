import type { Point } from './walk';

/** The map plane leaning away from the viewer, like a mission map in a game. Presentation only: no record changes. */
export type Tilt = {
  /** Degrees the plane leans back at full tilt. */
  pitch: number;
  /** Degrees the plane turns clockwise at full tilt. */
  yaw: number;
  /** Viewing distance in pixels; a smaller one is a stronger perspective. */
  depth: number;
  /** Height of the drawn blocks in metres. Every building gets the same height; none is measured. */
  rise: number;
  /** Screen angle the walk should run at, in degrees below the horizontal. */
  course: number;
  /** Most degrees the plane may turn to get there. */
  swing: number;
};
/** The map point at the centre of the screen, pixels per map unit there, and the lean from 0 (flat) to 1 (full tilt). */
export type View = { x: number; y: number; k: number; lean: number };
export type Box = { left: number; top: number; right: number; bottom: number };
export type Lens = {
  view: View;
  width: number;
  height: number;
  /** Screen position of a map point, raised above the ground by map units when up is given. */
  at: (p: Point, up?: number) => Point;
  /** The map point under a screen position. */
  ground: (s: Point) => Point;
  /** Screen pixels per map unit around a map point. */
  scale: (p: Point) => number;
};

const RADIANS = Math.PI / 180;
/** Blocks never stand taller than this many pixels, so a close view stays readable. */
const HIGHEST = 12;

/** The yaw here is a default; aimed() sets it for each walk. */
export const TILT = {
  wide: { pitch: 50, yaw: 0, depth: 1150, rise: 5, course: 35, swing: 20 },
  phone: { pitch: 40, yaw: 0, depth: 900, rise: 5, course: 35, swing: 35 },
} satisfies Record<string, Tilt>;

/** Phones lean less and may turn further, so the walk can stand upright when that shows it larger. */
export const tiltFor = (width: number): Tilt => width > 640 ? TILT.wide : TILT.phone;

/** Turns the plane so a walk from one point to another runs at the screen angle the tilt prefers, within its swing. */
export function aimed(tilt: Tilt, from: Point, to: Point): Tilt {
  const fold = (degrees: number) => ((degrees % 180) + 270) % 180 - 90;
  const along = Math.atan2(to[1] - from[1], to[0] - from[0]) / RADIANS;
  const yaw = [tilt.course, -tilt.course].map(course => fold(course - along)).reduce((best, turn) => Math.abs(turn) < Math.abs(best) ? turn : best);
  return { ...tilt, yaw: Math.max(-tilt.swing, Math.min(tilt.swing, yaw)) };
}

/** Projects the map plane, leaning back about the centre of the screen, with a perspective of the tilt's depth. */
export function lens(view: View, tilt: Tilt, width: number, height: number): Lens {
  const pitch = view.lean * tilt.pitch * RADIANS, yaw = view.lean * tilt.yaw * RADIANS, d = tilt.depth;
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cx = width / 2, cz = height / 2;
  const at = (p: Point, up = 0): Point => {
    const ex = (p[0] - view.x) * view.k, ey = (p[1] - view.y) * view.k, h = Math.min(up * view.k, HIGHEST) * view.lean;
    const rx = ex * cy - ey * sy, ry = ex * sy + ey * cy;
    // Anything this close to the viewer is far below the screen; holding it there keeps its shape finite.
    const z = Math.min(ry * sp + h * cp, d * 0.9), s = d / (d - z);
    return [cx + rx * s, cz + (ry * cp - h * sp) * s];
  };
  const ground = (screen: Point): Point => {
    const u = screen[0] - cx, v = screen[1] - cz;
    // Above the horizon there is no ground; take the farthest ground still in view.
    const ry = v * d / Math.max(d * cp + v * sp, d * 0.05), rx = u * (d - ry * sp) / d;
    return [view.x + (rx * cy + ry * sy) / view.k, view.y + (ry * cy - rx * sy) / view.k];
  };
  const scale = (p: Point) => {
    const a = at(p), b = at([p[0] + 1, p[1]]), c = at([p[0], p[1] + 1]);
    return Math.sqrt(Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])));
  };
  return { view, width, height, at, ground, scale };
}

/** The view at one lean that centres the points in a screen box and fills it, within zoom limits. */
export function framing(points: Point[], box: Box, lean: number, tilt: Tilt, width: number, height: number, start: View, limits = { min: 0, max: Infinity }): View {
  let view: View = { ...start, lean };
  if (!points.length) return view;
  for (let i = 0; i < 24; i++) {
    const l = lens(view, tilt, width, height), seen = points.map(p => l.at(p));
    const xs = seen.map(p => p[0]), ys = seen.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const ratio = Math.min((box.right - box.left) / Math.max(1, maxX - minX), (box.bottom - box.top) / Math.max(1, maxY - minY));
    const from = l.ground([(minX + maxX) / 2, (minY + maxY) / 2]), to = l.ground([(box.left + box.right) / 2, (box.top + box.bottom) / 2]);
    const k = Math.max(limits.min, Math.min(limits.max, view.k * ratio));
    const next = { ...view, x: view.x + from[0] - to[0], y: view.y + from[1] - to[1], k };
    const settled = Math.abs(k / view.k - 1) < 1e-4 && Math.hypot(next.x - view.x, next.y - view.y) * k < 0.05;
    view = next;
    if (settled) break;
  }
  return view;
}

const KEY = 'mercature.map.v1';
/** The tilted map stays behind a switch until it is approved: ?map=tilt or ?map=flat, remembered on this device. */
export function tiltChosen(): boolean {
  try {
    const asked = new URLSearchParams(location.search).get('map');
    if (asked === 'tilt' || asked === 'flat') localStorage.setItem(KEY, asked);
    return (asked ?? localStorage.getItem(KEY)) === 'tilt';
  } catch {
    return false;
  }
}

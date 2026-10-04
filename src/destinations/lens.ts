import type { Point } from './walk';

/** The map plane leaning away from the viewer, like a mission map in a game. Presentation only: no record changes. */
export type Tilt = {
  /** Degrees the plane leans back at full tilt. */
  pitch: number;
  /** Degrees the plane turns clockwise at full tilt. */
  yaw: number;
  /** Viewing distance in pixels; a smaller one is a stronger perspective. */
  depth: number;
  /** Height of an ordinary block in metres, about two and a half storeys. Illustrative: no height is measured. */
  rise: number;
  /** Screen angle the tour route should run at, in degrees below the horizontal. */
  course: number;
  /** Most degrees the plane may turn to get there. */
  swing: number;
};
/** The map point at the centre of the screen, pixels per map unit there, the lean from 0 (flat) to 1 (full tilt), and the degrees
 * the map turns clockwise beyond its tilt's yaw, at full lean. */
export type View = { x: number; y: number; k: number; lean: number; turn?: number };
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
  /** How far a ground point lies inside the nearest depth the lens draws faithfully; below zero it is too close to the viewer, so a
   * shape on the ground is cut there before it is drawn. */
  near: (p: Point) => number;
  /** The tilt it leans with, its yaw including the view's turn, so a layer can lift things off the ground in step with it. Never
   * give it back to lens(), which would add the turn twice. */
  tilt: Tilt;
};

const RADIANS = Math.PI / 180;
/** Blocks ease toward this many pixels at most, so a close view stays readable and tall stays taller than low. */
const TALLEST = 46;

/** The far plane fades into the ground colour: fully down to this share of the screen height, clear again by this share. */
export const HAZE = { solid: 0.054, clear: 0.36 };
/** How much of the haze covers a screen height, from 0 (clear) to 1 (solid ground), at a lean. */
export const hazeAt = (y: number, height: number, lean: number) => lean * Math.max(0, Math.min(1, (HAZE.clear * height - y) / ((HAZE.clear - HAZE.solid) * height)));

/** The yaw here is a default; aimed() sets it for each route. */
export const TILT = {
  wide: { pitch: 50, yaw: 0, depth: 1150, rise: 8, course: 35, swing: 20 },
  phone: { pitch: 40, yaw: 0, depth: 900, rise: 8, course: 35, swing: 35 },
} satisfies Record<string, Tilt>;

/** Phones lean less and may turn further, so the route can stand upright when that shows it larger. */
export const tiltFor = (width: number): Tilt => width > 640 ? TILT.wide : TILT.phone;

/** Turns the plane so a route from one point to another runs at the screen angle the tilt prefers, within its swing. */
export function aimed(tilt: Tilt, from: Point, to: Point): Tilt {
  const fold = (degrees: number) => ((degrees % 180) + 270) % 180 - 90;
  const along = Math.atan2(to[1] - from[1], to[0] - from[0]) / RADIANS;
  const yaw = [tilt.course, -tilt.course].map(course => fold(course - along)).reduce((best, turn) => Math.abs(turn) < Math.abs(best) ? turn : best);
  return { ...tilt, yaw: Math.max(-tilt.swing, Math.min(tilt.swing, yaw)) };
}

/** Projects the map plane, leaning back about the centre of the screen, with a perspective of the tilt's depth. */
export function lens(view: View, tilt: Tilt, width: number, height: number): Lens {
  const turned = { ...tilt, yaw: tilt.yaw + (view.turn ?? 0) };
  const pitch = view.lean * tilt.pitch * RADIANS, yaw = view.lean * turned.yaw * RADIANS, d = tilt.depth;
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cx = width / 2, cz = height / 2;
  const at = (p: Point, up = 0): Point => {
    const ex = (p[0] - view.x) * view.k, ey = (p[1] - view.y) * view.k, h = TALLEST * Math.tanh(up * view.k / TALLEST) * view.lean;
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
  const near = (p: Point) => d * 0.8 - ((p[0] - view.x) * view.k * sy + (p[1] - view.y) * view.k * cy) * sp;
  return { view, width, height, at, ground, scale, near, tilt: turned };
}

/** Degrees folded into -180 to 180. */
export const folded = (degrees: number) => ((degrees % 360) + 540) % 360 - 180;
/** The turn that makes a compass heading point up the screen, reached from the current turn the shorter way round, and none while
 * the heading already points within a few degrees of up. */
export function turnToward(heading: number, tilt: Tilt, current = 0, within = 15): number {
  const off = folded(-heading - tilt.yaw - current);
  return Math.abs(off) <= within ? current : current + off;
}

/** The view at one lean that centres the points in a screen box and fills it, within zoom limits. */
export function framing(points: Point[], box: Box, lean: number, tilt: Tilt, width: number, height: number, start: View, limits = { min: 0, max: Infinity }): View {
  let view: View = { ...start, lean };
  // No points, or no room to show them (a panel taller than the screen while it resizes): keep the view as it is.
  if (!points.length || box.right - box.left < 1 || box.bottom - box.top < 1) return view;
  for (let i = 0; i < 24; i++) {
    const l = lens(view, tilt, width, height), seen = points.map(p => l.at(p));
    const xs = seen.map(p => p[0]), ys = seen.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const ratio = Math.min((box.right - box.left) / Math.max(1, maxX - minX), (box.bottom - box.top) / Math.max(1, maxY - minY));
    const from = l.ground([(minX + maxX) / 2, (minY + maxY) / 2]), to = l.ground([(box.left + box.right) / 2, (box.top + box.bottom) / 2]);
    const k = Math.max(limits.min, Math.min(limits.max, view.k * ratio));
    const next = { ...view, x: view.x + from[0] - to[0], y: view.y + from[1] - to[1], k };
    if (!(k > 0) || !Number.isFinite(next.x) || !Number.isFinite(next.y)) break;
    const settled = Math.abs(k / view.k - 1) < 1e-4 && Math.hypot(next.x - view.x, next.y - view.y) * k < 0.05;
    view = next;
    if (settled) break;
  }
  return view;
}

const KEY = 'mercature.map.v1';
/** The map leans by default; ?map=flat keeps it flat on this device and ?map=tilt leans it again. */
export function tiltChosen(): boolean {
  try {
    const asked = new URLSearchParams(location.search).get('map');
    if (asked === 'tilt' || asked === 'flat') localStorage.setItem(KEY, asked);
    return (asked ?? localStorage.getItem(KEY)) !== 'flat';
  } catch {
    return true;
  }
}

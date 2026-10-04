import type { Lens, Tilt, View } from '../destinations/lens';
import type { Point } from '../destinations/walk';

/** A polyline measured along its length, in route-frame units. */
export type Track = { points: Point[]; along: number[]; length: number };

export function track(points: Point[]): Track {
  const along = [0];
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return { points, along, length: along[along.length - 1] ?? 0 };
}

/** The point at a distance along the track, held to its ends. */
export function pointAt(t: Track, s: number): Point {
  if (t.points.length < 2) return t.points[0] ?? [0, 0];
  const at = Math.max(0, Math.min(t.length, s));
  let i = 1;
  while (i < t.along.length - 1 && t.along[i] < at) i++;
  const a = t.points[i - 1], b = t.points[i], step = t.along[i] - t.along[i - 1], u = step ? (at - t.along[i - 1]) / step : 0;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

/** The part of the track between two distances, with its corners. */
export function slice(t: Track, from: number, to: number): Point[] {
  const out = [pointAt(t, from)];
  for (let i = 0; i < t.points.length; i++) if (t.along[i] > from && t.along[i] < to) out.push(t.points[i]);
  out.push(pointAt(t, to));
  return out;
}

/** How far along the track a point's nearest place is, and how far the point is from it. */
export function locate(t: Track, p: Point): { s: number; d: number } {
  let best = { s: 0, d: Infinity };
  for (let i = 1; i < t.points.length; i++) {
    const a = t.points[i - 1], b = t.points[i], dx = b[0] - a[0], dy = b[1] - a[1], squared = dx * dx + dy * dy;
    const u = squared ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / squared)) : 0;
    const d = Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
    if (d < best.d) best = { s: t.along[i - 1] + u * Math.sqrt(squared), d };
  }
  return best;
}

/** Screen x, y and the perspective scale there. */
export type Seen = [number, number, number];
/** Where a map point shows on screen, lifted by some pixels above the ground. */
export type Project = (p: Point, lift?: number) => Seen;

const RADIANS = Math.PI / 180;

/**
 * The map's lens without its height limit, for effects that rise above the ground: a point lifted on a flat map comes toward
 * the viewer, on a leaning one it stands up. Same plane, pitch, yaw and depth as lens() in destinations/lens.ts.
 */
export function project(view: View, tilt: Tilt, width: number, height: number): Project {
  const pitch = view.lean * tilt.pitch * RADIANS, yaw = view.lean * tilt.yaw * RADIANS, d = tilt.depth;
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw), cx = width / 2, cz = height / 2;
  return (p, lift = 0) => {
    const ex = (p[0] - view.x) * view.k, ey = (p[1] - view.y) * view.k;
    const rx = ex * cy - ey * sy, ry = ex * sy + ey * cy;
    const z = Math.min(ry * sp + lift * cp, d * 0.9), s = d / (d - z);
    return [cx + rx * s, cz + (ry * cp - lift * sp) * s, s];
  };
}

/** How much a circle on the ground flattens on screen at a view's lean. */
export const squashOf = (view: View, tilt: Tilt) => Math.cos(view.lean * tilt.pitch * RADIANS);

/**
 * The frame of a map drawn through a lens, for an effects canvas in the same box. With the lens's tilt the projection is exact;
 * without it, a lift follows the lens's own upright, measured with a small step at the centre of the screen.
 */
export function spaceOf(lens: Lens, tilt?: Tilt): { project: Project; squash: number; scale: number } {
  const known = tilt ?? (lens as Lens & { tilt?: Tilt }).tilt;
  if (known) return { project: project(lens.view, known, lens.width, lens.height), squash: squashOf(lens.view, known), scale: lens.view.k };
  const { k, lean } = lens.view, centre = lens.ground([lens.width / 2, lens.height / 2]), step = 0.5;
  const a = lens.at(centre), b = lens.at(centre, step), per = lean > 0.01 ? [(b[0] - a[0]) / (step * k * lean), (b[1] - a[1]) / (step * k * lean)] : [0, 0];
  const upright = Math.min(1, Math.hypot(per[0], per[1]));
  return { scale: k, squash: Math.sqrt(1 - upright * upright), project: (p, lift = 0) => { const [x, y] = lens.at(p); return [x + per[0] * lift, y + per[1] * lift, 1]; } };
}

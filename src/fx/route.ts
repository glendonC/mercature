import type { Effect } from './FxCanvas';
import type { FxScene } from './scene';
import { pointAt, slice, type Seen } from './space';
import { clamp01, dot, easeInOut, easeOut, glow, line, mix, palette, rgba, ring, within, type Palette } from './paint';
import type { Destination } from '../destinations/data';
import type { Point } from '../destinations/walk';

type Rgb = Palette['way'];

/** A marker's colour by what it means: clay a possible barrier, blue the way, grey anything unknown or dismissed. */
export function meaning(state: string): keyof Palette {
  return state === 'open' || state === 'barrier' || state === 'check' ? 'barrier' : state === 'clear' || state === 'fixed' ? 'way' : 'unknown';
}

/**
 * Light runs once along the walk from its start to its end, the way a visitor walks it: grey where the walk has no photos,
 * and a ring at each spot it passes.
 */
export function flow(scene: FxScene, started: number, { travel = 3000, tail = 95 } = {}): Effect {
  return ({ ctx, project, squash, now }) => {
    const u = (now - started) / travel;
    if (u < 0) return true;
    if (u >= 1) return false;
    const colours = palette(), length = scene.route.length, trail = tail * scene.unit;
    const head = -trail * 0.2 + (length + trail * 1.2) * easeInOut(u);
    const unseen = (s: number) => scene.stretches.some(stretch => stretch.status === 'no-photos' && s >= stretch.from && s <= stretch.to);
    const steps = 30;
    for (let i = 0; i < steps; i++) {
      const from = Math.max(0, head - trail * (1 - i / steps)), to = Math.min(length, head - trail * (1 - (i + 1) / steps));
      if (to <= from) continue;
      const j = (i + 1) / steps, base = unseen((from + to) / 2) ? colours.unknown : colours.way, path = slice(scene.route, from, to).map(p => project(p));
      line(ctx, path, rgba(base, 0.2 * j * j), 6 + 16 * j);
      line(ctx, path, rgba(mix(base, colours.surface, Math.pow(j, 2.2) * 0.9), 0.2 + 0.8 * j), 3 + 3 * j);
    }
    if (head > 0 && head < length) {
      const [x, y] = project(pointAt(scene.route, head)), base = unseen(head) ? colours.unknown : colours.way;
      glow(ctx, x, y, 26, rgba(colours.surface, 0.95), rgba(base, 0));
      glow(ctx, x, y, 26, rgba(base, 0.22), rgba(base, 0));
    }
    for (const spot of scene.spots) {
      const v = (head - spot.s) / (scene.unit * 60);
      if (v <= 0 || v >= 1) continue;
      const [x, y] = project(spot.at);
      ring(ctx, x, y, 9 + 22 * easeOut(v), squash, rgba(spot.kind === 'no-photos' ? colours.unknown : colours.barrier, 0.6 * (1 - v)), 1.5);
    }
    return true;
  };
}

/** A tapped spot sends a ring over the ground, and the photos that saw it light as the ring reaches them, then settle. */
export function ping(scene: FxScene, at: Point, saw: ReadonlySet<string>, started: number, { reach = 70, spread = 1100 } = {}): Effect {
  return ({ ctx, project, now }) => {
    const t = now - started, u = t / spread, colours = palette(), radius = reach * scene.unit;
    if (u >= 2.2) return false;
    if (u > 0 && u < 1) {
      const circle = (r: number) => Array.from({ length: 49 }, (_, i) => { const a = i / 48 * Math.PI * 2; return project([at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r]); });
      line(ctx, circle(radius * easeOut(u)), rgba(colours.surface, 0.7 * (1 - u)), 3);
      line(ctx, circle(radius * easeOut(u)), rgba(colours.ink, 0.45 * (1 - u)), 1.2);
    }
    for (const photo of scene.photos) {
      if (!saw.has(photo.id)) continue;
      const d = Math.hypot(photo.at[0] - at[0], photo.at[1] - at[1]);
      if (d > radius) continue;
      const reached = spread * Math.cbrt(d / radius), lit = within(t, reached, 220) * (1 - within(t, reached + 900, 600));
      if (lit <= 0) continue;
      const [x, y] = project(photo.at), swell = 1 + 0.5 * Math.sin(Math.PI * within(t, reached, 380));
      dot(ctx, x, y, 4.4 * swell, rgba(colours.surface, 0.95 * lit));
      dot(ctx, x, y, 3 * swell, rgba(colours.ink, 0.85 * lit));
    }
    return true;
  };
}

/** The photos that saw a run of stretches: the views the place keeps for them, and every photo taken on the walk beside them. */
export function sawStretches(scene: FxScene, data: Destination, stretches: readonly number[]): Set<string> {
  const ids = new Set<string>(), photoOf = new Map(data.views.map(view => [view.id, view.photoId] as const));
  for (const index of stretches) for (const view of data.stretches[index]?.views ?? []) { const photo = photoOf.get(view); if (photo) ids.add(photo); }
  const covered = scene.stretches.filter(stretch => stretches.includes(stretch.index));
  if (!covered.length) return ids;
  const from = Math.min(...covered.map(s => s.from)) - 10 * scene.unit, to = Math.max(...covered.map(s => s.to)) + 10 * scene.unit;
  for (const photo of scene.photos) if (photo.s >= from && photo.s <= to && photo.d <= 12 * scene.unit) ids.add(photo.id);
  return ids;
}

/** Where a photo was taken and which way it faced, and what it saw, as colours across its width. */
export type Shot = { id: string; at: Point; heading: number; colours: Rgb[] | null; image: HTMLImageElement | null };

/** Sixteen colours across a photo, left to right, kept mostly to their lightness so stone never reads as clay. */
export function columns(image: HTMLImageElement, count = 16): Rgb[] | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = count; canvas.height = 12;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, count, 12);
    const pixels = context.getImageData(0, 0, count, 12).data, out: Rgb[] = [];
    for (let column = 0; column < count; column++) {
      const sum = [0, 0, 0];
      for (let row = 0; row < 12; row++) for (let k = 0; k < 3; k++) sum[k] += pixels[(row * count + column) * 4 + k];
      const mean = sum.map(v => v / 12) as Rgb, grey = 0.299 * mean[0] + 0.587 * mean[1] + 0.114 * mean[2];
      out.push(mix([grey, grey, grey], mean, 0.3));
    }
    return out;
  } catch {
    return null;
  }
}

/** The half angle and length of the view, the same as the map's own wedge: a sketch of a direction, not a measured field of view. */
const HALF = Math.atan2(14, 31), REACH = 31;

/**
 * The open photo as a camera standing where it was taken: its view laid on the ground in the photo's own light and shade inside
 * an ink outline, four edges up to a frame the shape of the photo, and the photo in that frame. A new photo swings it over.
 */
export function camera(to: Shot, from: Shot | null, started: number, { grow = 420, swing = 600, photo = true } = {}): Effect {
  return ({ ctx, project, squash, scale, now }) => {
    const colours = palette(), t = now - started;
    const g = from ? 1 : easeOut(clamp01(t / grow)), w = from ? easeInOut(clamp01(t / swing)) : 1;
    const turn = from ? ((to.heading - from.heading + 540) % 360) - 180 : 0;
    const at: Point = from ? [from.at[0] + (to.at[0] - from.at[0]) * w, from.at[1] + (to.at[1] - from.at[1]) * w] : to.at;
    const heading = (from ? from.heading + turn * w : to.heading) * Math.PI / 180;
    const forward: Point = [Math.sin(heading), -Math.cos(heading)], side: Point = [Math.cos(heading), Math.sin(heading)];
    const ray = (a: number, r: number): Point => [at[0] + (forward[0] * Math.cos(a) + side[0] * Math.sin(a)) * r, at[1] + (forward[1] * Math.cos(a) + side[1] * Math.sin(a)) * r];
    const reach = REACH * g, apex = project(at), tint = w < 0.5 && from ? from.colours : to.colours;
    const slices = tint?.length ?? 1;
    for (let i = 0; i < slices; i++) {
      const a0 = -HALF + 2 * HALF * i / slices, a1 = -HALF + 2 * HALF * (i + 1) / slices, rgb = tint?.[i] ?? colours.ink;
      const p0 = project(ray(a0, reach)), p1 = project(ray(a1, reach)), mid = project(ray((a0 + a1) / 2, reach));
      const fill = ctx.createLinearGradient(apex[0], apex[1], mid[0], mid[1]);
      fill.addColorStop(0, rgba(rgb, 0)); fill.addColorStop(1, rgba(rgb, tint ? 0.42 * g : 0.12 * g));
      ctx.beginPath(); ctx.moveTo(apex[0], apex[1]); ctx.lineTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    }
    const arc: Seen[] = Array.from({ length: 25 }, (_, i) => project(ray(-HALF + 2 * HALF * i / 24, reach)));
    line(ctx, [apex, arc[0]], rgba(colours.ink, 0.55 * g), 1);
    line(ctx, [apex, arc[arc.length - 1]], rgba(colours.ink, 0.55 * g), 1);
    line(ctx, arc, rgba(colours.surface, 0.9 * g), 3.5);
    line(ctx, arc, rgba(colours.ink, 0.8 * g), 1.25);
    // On a flat map the view on the ground is all there is; leaning, a frame stands at its far edge, as tall as the photo is
    // for its width, the camera at its middle height.
    if (squash > 0.99) return t < (from ? swing : grow);
    const lift = 2 * REACH * Math.tan(HALF) * 0.75 * g * scale;
    const left = ray(-HALF, reach), right = ray(HALF, reach), tl = project(left, lift), tr = project(right, lift), bl = project(left), br = project(right), eye = project(at, lift / 2);
    const image = w < 0.5 && from ? from.image : to.image;
    if (photo && image?.complete && image.naturalWidth) {
      let [a, b, c] = [tl, tr, bl];
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) [a, b, c] = [tr, tl, br];
      const density = ctx.getTransform().a, fade = from ? Math.abs(w - 0.5) * 2 : 1;
      ctx.save();
      ctx.setTransform(density * (b[0] - a[0]) / image.naturalWidth, density * (b[1] - a[1]) / image.naturalWidth, density * (c[0] - a[0]) / image.naturalHeight, density * (c[1] - a[1]) / image.naturalHeight, density * a[0], density * a[1]);
      ctx.globalAlpha = 0.9 * g * fade;
      ctx.drawImage(image, 0, 0);
      ctx.restore();
    }
    for (const corner of [tl, tr, bl, br]) line(ctx, [eye, corner], rgba(colours.ink, 0.32 * g), 0.9);
    line(ctx, [tl, tr, br, bl, tl], rgba(colours.ink, 0.7 * g), 1.1);
    line(ctx, [apex, eye], rgba(colours.ink, 0.45 * g), 1);
    dot(ctx, eye[0], eye[1], 2.2, rgba(colours.ink, g));
    return t < (from ? swing : grow);
  };
}

/**
 * A soft column of light standing on the focused spot, in its own colour, with a brighter band rising through it now and then,
 * like the marker of a game's main mission. Still, without the band, when motion is reduced.
 */
export function beam(at: Point, colour: keyof Palette, started: number, still: boolean, { tall = 96, cycle = 2400 } = {}): Effect {
  return ({ ctx, project, squash, now, width }) => {
    const colours = palette(), rgb = colours[colour], t = now - started, show = still ? 1 : easeOut(clamp01(t / 380));
    // Upright on screen, as a standing thing looks through this lens.
    const height = (width < 640 ? tall * 0.75 : tall) * show, base = project(at), top: Seen = [base[0], base[1] - height, base[2]];
    const [x, y] = base, [tx, ty] = top;
    const sideways = (half: number, p: Seen): [number, number] => { const dx = tx - x, dy = ty - y, n = Math.hypot(dx, dy) || 1; return [p[0] - dy / n * half, p[1] + dx / n * half]; };
    const column = ctx.createLinearGradient(x, y, tx, ty);
    column.addColorStop(0, rgba(rgb, 0.34)); column.addColorStop(0.55, rgba(rgb, 0.11)); column.addColorStop(1, rgba(rgb, 0));
    const [l0x, l0y] = sideways(-7, base), [r0x, r0y] = sideways(7, base), [l1x, l1y] = sideways(-2.5, top), [r1x, r1y] = sideways(2.5, top);
    ctx.beginPath(); ctx.moveTo(l0x, l0y); ctx.lineTo(l1x, l1y); ctx.lineTo(r1x, r1y); ctx.lineTo(r0x, r0y); ctx.closePath(); ctx.fillStyle = column; ctx.fill();
    const core = ctx.createLinearGradient(x, y, tx, ty);
    core.addColorStop(0, rgba(rgb, 0.75)); core.addColorStop(1, rgba(rgb, 0));
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.strokeStyle = core; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.scale(1, Math.max(0.2, squash));
    glow(ctx, 0, 0, 24, rgba(rgb, 0.24 * show), rgba(rgb, 0));
    ctx.restore();
    if (still) return false;
    const phase = (t % cycle) / cycle, rise = easeOut(phase), fade = 1 - phase;
    const bx = x + (tx - x) * rise, by = y + (ty - y) * rise, ex = x + (tx - x) * Math.min(1, rise + 0.16), ey = y + (ty - y) * Math.min(1, rise + 0.16);
    line(ctx, [[bx, by], [ex, ey]], rgba(mix(rgb, colours.surface, 0.55), 0.7 * fade * show), 2.5);
    return true;
  };
}

/** One ring over the ground from a marker the pointer has just reached. */
export function pulse(at: Point, colour: keyof Palette, started: number, { spread = 640 } = {}): Effect {
  return ({ ctx, project, squash, now }) => {
    const u = (now - started) / spread;
    if (u >= 1) return false;
    const [x, y] = project(at), rgb = palette()[colour];
    ring(ctx, x, y, 7 + 24 * easeOut(clamp01(u)), squash, rgba(rgb, 0.55 * (1 - u)), 1.5);
    return true;
  };
}

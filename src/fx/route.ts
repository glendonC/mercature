import type { Effect } from './FxCanvas';
import type { FxScene } from './scene';
import { slice } from './space';
import { clamp01, dot, easeInOut, easeOut, line, mix, palette, rgba, ring, within, type Palette } from './paint';
import type { Destination } from '../destinations/data';
import type { Point } from '../destinations/walk';


/** A marker's colour by what it means: clay a possible barrier, blue the way, grey anything unknown or dismissed. */
export function meaning(state: string): keyof Palette {
  return state === 'open' || state === 'barrier' || state === 'added' ? 'barrier' : state === 'clear' || state === 'fixed' ? 'way' : 'unknown';
}

/** The flow's beads in screen pixels at its reference scale: length, gap and speed per second; and how often it redraws. */
const FLOW = { bead: 7, gap: 29, speed: 11, every: 50 };

/**
 * One quiet flow along the walk, always on: short beads of light inside its line, moving the way a visitor walks it, grey
 * where no photo was taken. The beads keep about one size on screen, stepping to a new spacing only when the zoom doubles or
 * halves, and take their phase from the page clock, so a replay and the route screen behind it show the same beads in the
 * same places. Still under reduced motion; otherwise it redraws a few times a second, which is all its speed needs.
 */
export function flow(scene: FxScene, still: boolean): Effect {
  const unseen = scene.stretches.filter(stretch => stretch.status === 'no-photos');
  return ({ ctx, project, scale, now }) => {
    const colours = palette(), length = scene.route.length;
    // Route units per screen pixel, rounded to a power of two so the spacing holds while the map zooms a little.
    const per = Math.pow(2, Math.round(Math.log2(1 / Math.max(1e-6, scale)))), bead = FLOW.bead * per, every = (FLOW.bead + FLOW.gap) * per;
    const phase = still ? every / 2 : (now / 1000 * FLOW.speed * per) % every;
    const lit = new Path2D(), grey = new Path2D();
    for (let s = phase; s - bead < length; s += every) {
      const from = Math.max(0, s - bead), to = Math.min(length, s), mid = (from + to) / 2;
      if (to <= from) continue;
      const path = unseen.some(stretch => mid >= stretch.from && mid <= stretch.to) ? grey : lit;
      slice(scene.route, from, to).forEach((p, i) => { const [x, y] = project(p); if (i) path.lineTo(x, y); else path.moveTo(x, y); });
    }
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = rgba(mix(colours.way, colours.surface, 0.55), 0.8); ctx.stroke(lit);
    ctx.strokeStyle = rgba(mix(colours.unknown, colours.surface, 0.45), 0.75); ctx.stroke(grey);
    return still ? false : FLOW.every;
  };
}

/** A tapped spot lights the photos that saw it, the nearest first, then they settle back. */
export function ping(scene: FxScene, at: Point, saw: ReadonlySet<string>, started: number, { reach = 70, spread = 1100 } = {}): Effect {
  return ({ ctx, project, now }) => {
    const t = now - started, colours = palette(), radius = reach * scene.unit;
    if (t >= spread * 2.2) return false;
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

/** One ring over the ground from a marker: the pointer has just reached it, or an edit has just settled it. */
export function pulse(at: Point, colour: keyof Palette, started: number, { spread = 640, reach = 24, strength = 0.55 } = {}): Effect {
  return ({ ctx, project, squash, now }) => {
    const u = (now - started) / spread;
    if (u >= 1) return false;
    if (u < 0) return true;
    const [x, y] = project(at), rgb = palette()[colour];
    ring(ctx, x, y, 7 + reach * easeOut(u), squash, rgba(rgb, strength * (1 - u)), 1.5);
    return true;
  };
}

/** The clay glow along a spot's stretch of the walk fading out, as an edit takes the possible barrier off it: the map's own glow goes at once. */
export function unglow(path: readonly Point[], started: number, { fade = 400 } = {}): Effect {
  return ({ ctx, project, now }) => {
    const u = (now - started) / fade;
    if (u >= 1) return false;
    const rgb = palette().barrier, k = 1 - easeInOut(clamp01(u)), drawn = path.map(p => project(p));
    line(ctx, drawn, rgba(rgb, 0.07 * k), 26);
    line(ctx, drawn, rgba(rgb, 0.12 * k), 14);
    return true;
  };
}

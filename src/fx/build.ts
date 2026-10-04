import type { Effect, FxFrame } from './FxCanvas';
import type { FxScene } from './scene';
import { pointAt, slice, type Seen } from './space';
import { arrive, clamp01, dot, easeInOut, easeOut, glow, line, mix, palette, rgba, ring, sway, within } from './paint';

/** A window of time: when it starts, on the performance.now() clock, and how long it lasts, in milliseconds. */
export type Window = readonly [start: number, length: number];
/** The beats of the build replay. Each is optional: a step with nothing to show is left out. */
export type Beats = { photos?: Window; walk?: Window; stretches?: Window; marks?: Window; flags?: Window };

/** Milliseconds a photo takes to land, and the pixels it falls from. */
const FALL = 600, DROP = 170;
/** Milliseconds of the ring where a photo lands, where a mark pops, and of a stretch's tick growing as the light reaches it. */
const RIPPLE = 520, POP = 380, TICK = 240;
/** Photos this many metres from the walk hop onto it as the walk is drawn, starting this far ahead of it, over this distance. */
const NEAR = 22, AHEAD = 12, OVER = 16;
/** Metres of the light that runs along the walk as its stretches are counted. */
const RUN = 16;
/** The drawn walk gives way to the map's own line this long after its beat. */
const HOLD = 250, YIELD = 250;

const ends = (beats: Beats) => Math.max(...Object.values(beats).map(w => w ? w[0] + w[1] : -Infinity));

/** How many photos are on screen by now, each from the moment it starts to fall, so a count can match what is drawn. */
export function photosShown(total: number, beat: Window, now: number): number {
  const fall = Math.min(FALL, beat[1] * 0.5), span = Math.max(1, beat[1] - fall);
  if (now >= beat[0] + span) return total;
  return Math.max(0, Math.min(total, Math.floor((now - beat[0]) / span * (total - 1)) + 1));
}

/** The time on an ease where it reaches a share of its way. */
function inverse(ease: (u: number) => number, share: number) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (ease(mid) < share) lo = mid; else hi = mid; }
  return lo;
}
const disc = (path: Path2D, x: number, y: number, r: number) => { path.moveTo(x + r, y); path.arc(x, y, r, 0, Math.PI * 2); };

function photos(f: FxFrame, scene: FxScene, beats: Beats, now: number) {
  const window = beats.photos;
  if (!window || now < window[0]) return;
  const { ctx, project, squash } = f, colours = palette(), n = scene.photos.length;
  const fall = Math.min(FALL, window[1] * 0.5), span = window[1] - fall;
  const head = beats.walk && now >= beats.walk[0] ? scene.route.length * sway(within(now, beats.walk[0], beats.walk[1])) : null;
  const ghosts = new Path2D(), landed = new Path2D(), opening = new Path2D();
  const hops: Seen[] = [];
  for (let i = 0; i < n; i++) {
    const photo = scene.photos[i], from = window[0] + span * (n > 1 ? i / (n - 1) : 0), u = (now - from) / fall;
    if (u <= 0) continue;
    if (u < 1) {
      // Falling onto where it was taken: from above on a leaning map, from the viewer on a flat one.
      const [x, y, s] = project(photo.at, (1 - easeOut(u)) * DROP);
      dot(ctx, x, y, 1.9 * Math.min(1.4, s), rgba(colours.ink, 0.5 * clamp01(u * 3)));
      continue;
    }
    const [x, y] = project(photo.at), r = (now - from - fall) / RIPPLE;
    if (r < 1) ring(ctx, x, y, 2 + 10 * easeOut(r), squash, rgba(colours.ink, 0.24 * (1 - r)), 1);
    const g = head != null && photo.d < NEAR * scene.unit ? clamp01((head - photo.s + AHEAD * scene.unit) / (OVER * scene.unit)) : 0;
    if (g > 0 && g < 1) {
      // Gathered onto the walk beside it with a small hop; a faint dot stays where the photo was taken.
      const foot = pointAt(scene.route, photo.s), k = easeInOut(g);
      hops.push(project([photo.at[0] + (foot[0] - photo.at[0]) * k, photo.at[1] + (foot[1] - photo.at[1]) * k], Math.sin(Math.PI * k) * 14));
    }
    disc(g > 0 ? ghosts : photo.openable ? opening : landed, x, y, g > 0 ? 1.5 : photo.openable ? 2.3 : 1.7);
  }
  ctx.fillStyle = rgba(colours.ink, 0.2); ctx.fill(ghosts);
  ctx.fillStyle = rgba(colours.ink, 0.45); ctx.fill(landed);
  ctx.fillStyle = rgba(colours.ink, 0.7); ctx.fill(opening);
  for (const [x, y] of hops) dot(ctx, x, y, 2.1, rgba(colours.way, 0.9));
}

function walk(f: FxFrame, scene: FxScene, beats: Beats, now: number) {
  const window = beats.walk;
  if (!window || now < window[0]) return;
  const { ctx, project } = f, colours = palette(), u = within(now, window[0], window[1]), after = now - window[0] - window[1];
  const fade = 1 - clamp01((after - HOLD) / YIELD);
  if (fade <= 0) return;
  const head = scene.route.length * sway(u), drawn = slice(scene.route, 0, head).map(p => project(p));
  ctx.globalAlpha = fade;
  line(ctx, drawn, rgba(colours.surface, 0.92), 9);
  line(ctx, drawn, rgba(colours.way, 1), 4);
  ctx.globalAlpha = 1;
  const light = u < 1 ? 1 : 1 - clamp01(after / 300);
  if (light > 0) {
    const [x, y] = project(pointAt(scene.route, head));
    glow(ctx, x, y, 24, rgba(colours.way, 0.42 * light), rgba(colours.way, 0));
    dot(ctx, x, y, 3, rgba(colours.surface, light));
  }
}

function stretches(f: FxFrame, scene: FxScene, beats: Beats, now: number, finished: boolean) {
  const window = beats.stretches;
  if (!window || (!finished && now < window[0])) return;
  const { ctx, project } = f, colours = palette(), u = finished ? 1 : within(now, window[0], window[1]), length = scene.route.length || 1;
  // A short light runs along the walk from its start to its end; each stretch it reaches takes its tick.
  const head = length * easeInOut(u);
  const reached = scene.stretches.flatMap(stretch => finished || stretch.from <= head
    ? [{ stretch, lit: finished ? 1 : within(now, window[0] + window[1] * inverse(easeInOut, stretch.from / length), TICK) }] : []);
  for (const { stretch } of reached) {
    if (stretch.status !== 'no-photos') continue;
    // No photos here: the walk turns to grey dashes, as the canvas draws it.
    const path = slice(scene.route, stretch.from, stretch.to).map(p => project(p));
    line(ctx, path, rgba(colours.surface, 1), 7, 'butt');
    ctx.setLineDash([3, 5]); line(ctx, path, rgba(colours.unknown, 1), 4, 'butt'); ctx.setLineDash([]);
  }
  // A hairline tick where each 10 m stretch begins, and one at the end of the walk.
  ctx.beginPath();
  for (const { stretch, lit } of reached) {
    const ticks = stretch.index === scene.stretches.length - 1 ? [stretch.from, stretch.to] : [stretch.from];
    for (const s of ticks) {
      const p = project(pointAt(scene.route, s)), q = project(pointAt(scene.route, s + (s >= scene.route.length ? -0.5 : 0.5)));
      const nx = -(q[1] - p[1]), ny = q[0] - p[0], n = (Math.hypot(nx, ny) || 1) / (7 * lit);
      ctx.moveTo(p[0] + nx / n, p[1] + ny / n); ctx.lineTo(p[0] - nx / n, p[1] - ny / n);
    }
  }
  ctx.strokeStyle = rgba(colours.ink, 0.32); ctx.lineWidth = 1; ctx.lineCap = 'butt'; ctx.stroke();
  if (finished || u <= 0 || u >= 1) return;
  // The light itself, inside the walk's line: brightest at its head, fading behind it.
  const from = Math.max(0, head - RUN * scene.unit);
  for (let i = 0; i < 8; i++) {
    const a = from + (head - from) * i / 8, b = from + (head - from) * (i + 1) / 8, j = (i + 1) / 8;
    if (b > a) line(ctx, slice(scene.route, a, b).map(p => project(p)), rgba(mix(colours.way, colours.surface, 0.5 + 0.5 * j), 0.2 + 0.8 * j), 2 + 1.5 * j);
  }
}

function marks(f: FxFrame, scene: FxScene, beats: Beats, now: number, finished: boolean) {
  const window = beats.marks;
  if (!window || (!finished && now < window[0])) return;
  const { ctx, project, squash } = f, colours = palette(), count = scene.marks.length, pop = Math.min(POP, window[1] * 0.5);
  const flag = beats.flags ? (finished ? 1 : within(now, beats.flags[0], 450)) : 0;
  const wave = beats.flags && !finished ? (now - beats.flags[0]) / 700 : 2;
  for (let i = 0; i < count; i++) {
    const mark = scene.marks[i], from = window[0] + (window[1] - pop) * (count > 1 ? i / (count - 1) : 0), v = finished ? 9 : (now - from) / pop;
    if (v <= 0) continue;
    const [x, y] = project(mark.at);
    if (v < 1.6) ring(ctx, x, y, 3 + 11 * easeOut(v / 1.6), squash, rgba(colours.unknown, 0.5 * (1 - v / 1.6)), 1);
    if (mark.barrier && flag > 0) {
      // The flags turn clay together, each with a ring on the ground.
      if (wave > 0 && wave < 1) ring(ctx, x, y, 4 + 20 * easeOut(wave), squash, rgba(colours.barrier, 0.6 * (1 - wave)), 1.6);
      const late = wave - 0.22;
      if (late > 0 && late < 1) ring(ctx, x, y, 4 + 13 * easeOut(late), squash, rgba(colours.barrier, 0.4 * (1 - late)), 1);
      const r = 2.6 + 1.3 * arrive(flag);
      dot(ctx, x, y, r + 1.3, rgba(colours.surface, 0.95));
      dot(ctx, x, y, r, rgba(mix(colours.unknown, colours.barrier, flag), 1));
      continue;
    }
    const r = 2.5 * arrive(clamp01(v)), quieter = 1 - 0.4 * flag;
    dot(ctx, x, y, r + 1.1, rgba(colours.surface, 0.9 * quieter));
    dot(ctx, x, y, r, rgba(colours.unknown, 0.85 * quieter));
  }
}

/**
 * The build replay: photos land in capture order, the walk is drawn through them, a light along it ticks each stretch, the marks pop
 * in walking order and the possible barriers turn clay together. Done draws the end state at once, leaving the photos and the
 * walk to the map, which shows its own.
 */
export function build(scene: FxScene, beats: Beats, done: boolean): Effect {
  const last = ends(beats) + 800;
  return frame => {
    const now = done ? Infinity : frame.now, finished = done;
    if (!finished) { photos(frame, scene, beats, now); walk(frame, scene, beats, now); }
    stretches(frame, scene, beats, now, finished);
    marks(frame, scene, beats, now, finished);
    return !done && frame.now < last;
  };
}

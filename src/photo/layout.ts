/** Where label chips go on a photo, in screen pixels. Pure, so it can be checked without a page. */
export type Point = readonly [number, number];
export type Box = { x: number; y: number; w: number; h: number };
/** A label to place: its outline on screen and its chip's size. force: it is placed even when no spot is free (the selected or focused mark). */
export type LabelIn = { id: string; points: readonly Point[]; w: number; h: number; force?: boolean };
/** A placed chip: its box and the point of its outline the leader line meets, or null when the chip sits inside its outline. */
export type Placed = { id: string; box: Box; anchor: Point | null };

const GAP = 6, MARGIN = 4;
/** A chip's 44 px target reaches 10 px above and below its 24 px pill and 4 px to each side, so neighbours keep that far apart. */
const REACH_X = 4, REACH_Y = 10;
const clear = (a: Box, b: Box) => a.x >= b.x + b.w + REACH_X * 2 || b.x >= a.x + a.w + REACH_X * 2 || a.y >= b.y + b.h + REACH_Y * 2 || b.y >= a.y + a.h + REACH_Y * 2;

export function boundsOf(points: readonly Point[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export const overlaps = (a: Box, b: Box, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
const overlapArea = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const inside = (p: Point, b: Box) => p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h;

/** Whether segment p to q crosses segment a to b. */
function crosses(p: Point, q: Point, a: Point, b: Point) {
  const side = (o: Point, s: Point, t: Point) => Math.sign((s[0] - o[0]) * (t[1] - o[1]) - (s[1] - o[1]) * (t[0] - o[0]));
  return side(p, q, a) !== side(p, q, b) && side(a, b, p) !== side(a, b, q);
}

/** Whether a box covers any part of an outline's line: a vertex inside it, or an edge through it. */
export function coversOutline(box: Box, points: readonly Point[]) {
  const corners: Point[] = [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h]];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    if (inside(p, box)) return true;
    for (let j = 0; j < 4; j++) if (crosses(p, q, corners[j], corners[(j + 1) % 4])) return true;
  }
  return false;
}

/** Whether a point lies inside a polygon (even-odd). */
export function within(point: Point, points: readonly Point[]) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if (yi > point[1] !== yj > point[1] && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** The point of an outline nearest to p, on its vertices or edges. */
export function nearestOn(points: readonly Point[], p: Point): Point {
  let best: Point = points[0], distance = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
    const c: Point = [a[0] + t * dx, a[1] + t * dy], d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2;
    if (d < distance) { distance = d; best = c; }
  }
  return best;
}

/** Spots beside an outline: around its bounds, around points along it, and inside a large one; `reach` sets them further out. */
function candidates(points: readonly Point[], b: Box, w: number, h: number, reach = GAP): Box[] {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, above = b.y - h - reach, below = b.y + b.h + reach, right = b.x + b.w + reach, left = b.x - w - reach;
  const spots: [number, number][] = [[b.x, above], [cx - w / 2, above], [b.x + b.w - w, above], [b.x, below], [cx - w / 2, below], [b.x + b.w - w, below],
    [right, cy - h / 2], [left, cy - h / 2], [right, b.y], [left, b.y], [right, b.y + b.h - h], [left, b.y + b.h - h]];
  const step = Math.max(1, Math.floor(points.length / 8)), keys = points.filter((_, i) => i % step === 0);
  for (const [x, y] of keys) spots.push([x - w / 2, y - h - reach], [x - w / 2, y + reach], [x + reach, y - h / 2], [x - w - reach, y - h / 2]);
  if (b.w > w * 1.6 && b.h > h * 2.6) spots.push([cx - w / 2, cy - h / 2], [b.x + GAP * 2, b.y + GAP * 2], [b.x + b.w - w - GAP * 2, b.y + b.h - h - GAP * 2]);
  return spots.map(([x, y]) => ({ x, y, w, h }));
}

const gapTo = (p: Point, box: Box) => Math.hypot(Math.max(box.x - p[0], 0, p[0] - box.x - box.w), Math.max(box.y - p[1], 0, p[1] - box.y - box.h));

/**
 * Places chips in the order given, at most `budget` of them besides forced ones.
 * A chip stays inside the frame, keeps its 44 px target clear of other chips' and of `avoid` (controls), never covers its own outline's line,
 * and never sits inside a small outline. Among the free spots it takes the one nearest its outline that hides the least of the others' lines.
 * A chip inside a large outline needs no leader (anchor null). Labels with no free spot, or past the budget, come back in `hidden`.
 */
export function placeLabels(items: readonly LabelIn[], frame: { w: number; h: number }, budget: number, avoid: readonly Box[] = [], weighty: ReadonlySet<string> = new Set()): { placed: Placed[]; hidden: string[] } {
  const placed: Placed[] = [], hidden: string[] = [];
  const view: Box = { x: 0, y: 0, w: frame.w, h: frame.h };
  const outlines = items.map(item => ({ id: item.id, points: item.points, box: boundsOf(item.points) }));
  let free = 0;
  for (const item of items) {
    const b = boundsOf(item.points);
    if (!overlaps(b, view) || item.points.length < 3 || (!item.force && free >= budget)) { hidden.push(item.id); continue; }
    const small = b.w * b.h < item.w * item.h * 6;
    let best: { box: Box; inner: boolean } | null = null, bestCost = Infinity;
    // Near spots with clear targets first, then spots further out; a mark that matters may then sit closer to a neighbour.
    const tries: [number, (a: Box, b: Box) => boolean][] = [[GAP, clear], [GAP * 5, clear], ...(weighty.has(item.id) ? [[GAP, (a: Box, c: Box) => !overlaps(a, c, MARGIN)] as [number, (a: Box, b: Box) => boolean]] : [])];
    for (const [reach, apart] of tries) {
      for (const raw of candidates(item.points, b, item.w, item.h, reach)) {
        const box = { ...raw, x: Math.min(frame.w - raw.w - MARGIN, Math.max(MARGIN, raw.x)), y: Math.min(frame.h - raw.h - MARGIN, Math.max(MARGIN, raw.y)) };
        if (box.x < 0 || box.y < 0) continue;
        if (placed.some(p => !apart(p.box, box)) || avoid.some(a => !clear(a, box)) || coversOutline(box, item.points)) continue;
        const centre: Point = [box.x + box.w / 2, box.y + box.h / 2], inner = within(centre, item.points);
        if (inner && small) continue;
        let cost = inner ? 4 : gapTo(nearestOn(item.points, centre), box);
        for (const o of outlines) if (o.id !== item.id && overlaps(o.box, box) && coversOutline(box, o.points)) cost += weighty.has(o.id) ? 40 : 12;
        cost += (Math.abs(box.x - raw.x) + Math.abs(box.y - raw.y)) * 0.02;
        if (cost < bestCost) { bestCost = cost; best = { box, inner }; }
      }
      if (best) break;
    }
    if (!best && item.force) best = { box: { x: Math.min(frame.w - item.w - MARGIN, Math.max(MARGIN, b.x)), y: Math.min(frame.h - item.h - MARGIN, Math.max(MARGIN, b.y - item.h - GAP)), w: item.w, h: item.h }, inner: false };
    if (!best) { hidden.push(item.id); continue; }
    const { box, inner } = best;
    placed.push({ id: item.id, box, anchor: inner ? null : nearestOn(item.points, [box.x + box.w / 2, box.y + box.h / 2]) });
    if (!item.force) free++;
  }
  return { placed, hidden };
}

/** How many labels a frame has room for when nobody chose: fewer on a phone-sized photo. */
export const autoBudget = (w: number, h: number) => Math.max(3, Math.min(12, Math.round((w * h) / 26000)));

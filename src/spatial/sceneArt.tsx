import type { ReactNode } from 'react';
import type { Obstacle, Rect, Scene, UnknownRegion } from './contracts';

export type Point = { x: number; y: number };
export type Project = (point: Point, z?: number) => Point;
type Kind = 'hut' | 'shed' | 'sacks' | 'pots' | 'bench' | 'beds' | 'barrow' | 'tree' | 'tank' | 'sign' | 'wall' | 'box';
type Material = { top: string; light: string; dark: string; detail: string };

/** Presentation only. Known authored ids draw as recognisable objects; any other id draws as a plain box. */
const KINDS: Record<string, Kind> = {
  'tasting-hut': 'hut', 'roasting-shed': 'shed', 'coffee-sacks': 'sacks', 'flower-pots': 'pots', bench: 'bench',
  'drying-beds': 'beds', wheelbarrow: 'barrow', 'shade-tree': 'tree', 'water-tank': 'tank', 'welcome-sign': 'sign',
  'wall-north': 'wall', 'wall-south': 'wall',
};
const MATERIALS: Record<Kind, Material> = {
  hut: { top: '#c9b49d', light: '#e7ddd0', dark: '#cdbca8', detail: '#a48d75' },
  shed: { top: '#b4b9bc', light: '#e1e3e3', dark: '#c6c9ca', detail: '#8e959a' },
  sacks: { top: '#c9ab7f', light: '#dcc39b', dark: '#b4956b', detail: '#9a7c53' },
  pots: { top: '#cf8f6f', light: '#d39a7c', dark: '#b37558', detail: '#7d9e69' },
  bench: { top: '#bf9a72', light: '#b48d64', dark: '#987650', detail: '#8d6c49' },
  beds: { top: '#ebe2d2', light: '#c9ab84', dark: '#ad906b', detail: '#8f5848' },
  barrow: { top: '#a3a8ab', light: '#b2b6b8', dark: '#8e9497', detail: '#4f5559' },
  tree: { top: '#93735a', light: '#9c7c61', dark: '#7d6049', detail: '#7f9f6b' },
  tank: { top: '#d3d6d5', light: '#c7cbca', dark: '#afb4b3', detail: '#959b9a' },
  sign: { top: '#efe5d1', light: '#ddcdae', dark: '#bba786', detail: '#8b6a50' },
  wall: { top: '#dcd8d1', light: '#d4cfc7', dark: '#bdb7ae', detail: '#a39d94' },
  box: { top: '#ddd8cf', light: '#d4cec5', dark: '#bfb8ae', detail: '#a49d93' },
};
const CANOPY = { radius: 1.5, lift: .35 };

export const centre = (b: Rect): Point => ({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
export const corners = (b: Rect): Point[] => [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY }, { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY }];
export const points = (values: Point[]) => values.map(p => `${+p.x.toFixed(2)},${+p.y.toFixed(2)}`).join(' ');
const inset = (b: Rect, d: number): Rect => ({ minX: b.minX + d, minY: b.minY + d, maxX: b.maxX - d, maxY: b.maxY - d });
const ring = (project: Project, c: Point, r: number, z: number, n = 20) =>
  points(Array.from({ length: n }, (_, i) => project({ x: c.x + r * Math.cos(2 * Math.PI * i / n), y: c.y + r * Math.sin(2 * Math.PI * i / n) }, z)));

/** Convex outline of projected points, used for the selection halo. */
export function hull(values: Point[]): Point[] {
  const sorted = [...values].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Point[]) => list.reduce<Point[]>((out, p) => {
    while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
    return [...out, p];
  }, []);
  const lower = half(sorted), upper = half([...sorted].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** The highest drawn point above the floor, including decoration such as a canopy. */
export const drawnHeight = (scene: Scene) => Math.max(0, ...scene.obstacles.map(o => o.top + (KINDS[o.id] === 'tree' ? CANOPY.lift : 0)));

/** Visible faces, top and recognisable detail for one box obstacle. In plan, only the top is drawn at floor level. */
export function obstacleArt(obstacle: Obstacle, project: Project, solid: boolean): ReactNode {
  const kind = KINDS[obstacle.id] ?? 'box', m = MATERIALS[kind], b = obstacle.bounds, z = solid ? obstacle.top : 0;
  const c = corners(b), middle = project(centre(b));
  const faces = solid && c.map((a, i) => {
    const next = c[(i + 1) % 4], edge = project({ x: (a.x + next.x) / 2, y: (a.y + next.y) / 2 });
    if (edge.y <= middle.y) return null;
    return <polygon key={i} points={points([project(a, obstacle.bottom), project(next, obstacle.bottom), project(next, obstacle.top), project(a, obstacle.top)])} fill={edge.x < middle.x ? m.dark : m.light} />;
  });
  return <>
    {faces}
    <polygon className="spatial-top" points={points(c.map(p => project(p, z)))} fill={m.top} />
    {detail(kind, b, z, project, m)}
    {kind === 'tree' && <polygon className="spatial-canopy" points={ring(project, centre(b), CANOPY.radius, z + (solid ? CANOPY.lift : 0), 28)} />}
  </>;
}

function detail(kind: Kind, b: Rect, z: number, project: Project, m: Material): ReactNode {
  const w = b.maxX - b.minX, h = b.maxY - b.minY, long = w >= h;
  const line = (a: Point, c: Point, key?: number) => { const p = project(a, z), q = project(c, z); return <line key={key} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={m.detail} />; };
  // Points along the long axis (t) at a fraction (s) across the short axis.
  const along = (t: number, s: number): Point => long ? { x: b.minX + t * w, y: b.minY + s * h } : { x: b.minX + s * w, y: b.minY + t * h };
  const grid = (cols: number, rows: number, draw: (cell: Rect, key: number) => ReactNode) => Array.from({ length: cols * rows }, (_, i) => {
    const x = i % cols, y = Math.floor(i / cols);
    return draw({ minX: b.minX + x * w / cols, maxX: b.minX + (x + 1) * w / cols, minY: b.minY + y * h / rows, maxY: b.minY + (y + 1) * h / rows }, i);
  });
  const face = (r: Rect, fill: string, key?: number) => <polygon key={key} points={points(corners(r).map(p => project(p, z)))} fill={fill} stroke={m.detail} />;
  switch (kind) {
    case 'hut': case 'shed': return <>{line(along(0, .5), along(1, .5))}{kind === 'shed' && [.25, .75].map((t, i) => line(along(t, 0), along(t, 1), i))}</>;
    case 'sacks': return grid(Math.max(1, Math.round(w / .5)), Math.max(1, Math.round(h / .45)), (cell, i) => face(inset(cell, Math.min(w, h) * .06), m.light, i));
    case 'pots': {
      const n = Math.max(1, Math.round((long ? w : h) / .4)), r = Math.min(w, h) * .45;
      return Array.from({ length: n }, (_, i) => { const c = along((i + .5) / n, .5);
        return <g key={i}><polygon points={ring(project, c, r, z)} fill={m.light} stroke={m.dark} /><polygon points={ring(project, c, r * .62, z)} fill={m.detail} /></g>; });
    }
    case 'bench': return [1 / 3, 2 / 3].map((s, i) => line(along(.04, s), along(.96, s), i));
    case 'beds': return <>{face(inset(b, Math.min(w, h) * .12), m.top)}{grid(Math.max(1, Math.round(w / .5)), Math.max(1, Math.round(h / .45)), (cell, i) => <polygon key={i} points={ring(project, centre(cell), .06, z, 8)} fill={m.detail} />)}</>;
    case 'barrow': return <>{face(long ? { ...b, minX: b.minX + w * .3 } : { ...b, minY: b.minY + h * .3 }, m.light)}<polygon points={ring(project, along(.1, .5), Math.min(w, h) * .2, z, 12)} fill={m.detail} /></>;
    case 'tank': return <>{face(inset(b, Math.min(w, h) * .12), m.light)}<polygon points={ring(project, along(.25, .5), Math.min(w, h) * .14, z, 14)} fill={m.dark} stroke={m.detail} /></>;
    case 'sign': return line(along(0, .5), along(1, .5));
    default: return null;
  }
}

/** Unknown ground stays visibly unresolved: hatched, outlined and marked. Steps also show their treads. */
export function unknownArt(region: UnknownRegion, project: Project, hatch: string, unit: number): ReactNode {
  const b = region.bounds, z = region.elevation + .01, w = b.maxX - b.minX, h = b.maxY - b.minY, c = project(centre(b), z);
  const treads = region.id === 'steps-to-rows' ? Array.from({ length: Math.max(1, Math.floor((w >= h ? h : w) / .25) - 1) }, (_, i) => {
    const s = (i + 1) * .25, a = project(w >= h ? { x: b.minX, y: b.minY + s } : { x: b.minX + s, y: b.minY }, z), e = project(w >= h ? { x: b.maxX, y: b.minY + s } : { x: b.minX + s, y: b.maxY }, z);
    return <line key={i} className="spatial-tread" x1={a.x} y1={a.y} x2={e.x} y2={e.y} />;
  }) : null;
  return <>
    <polygon className="spatial-unknown-area" points={points(corners(b).map(p => project(p, z)))} fill={`url(#${hatch})`} />
    {treads}
    <circle className="spatial-question-mark" cx={c.x} cy={c.y} r={9 * unit} />
    <text className="spatial-question" x={c.x} y={c.y} fontSize={13 * unit}>?</text>
  </>;
}

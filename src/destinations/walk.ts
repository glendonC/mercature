import type { Coordinate, Destination, Finding, MapFeature } from './data';
import { routeFrame } from './GeographicMap';

/** Units of the shared 800 by 500 tour route frame (see routeFrame), so markers and the map share one space. */
export type Point = [number, number];
export type Landmark = { name: string; at: Point; kind: 'start' | 'target' | 'building' | 'street' };
/** A place on the route that needs a person: flagged stretches that share findings, or a run without photos. */
export type Spot = {
  /** Stable key from the first stretch index. Decisions are stored per stretch, never per spot. */
  id: string;
  kind: 'flagged' | 'no-photos';
  stretches: number[];
  from: number;
  to: number;
  at: Point;
  path: Point[];
  /** Flagged findings only: the model's clearest photo outline first, then map tags. The order is never shown as a score. */
  findings: Finding[];
  near: Landmark | null;
};
export type Run = { kind: 'seen' | 'no-photos'; path: Point[] };
export type Walk = {
  project: (point: Coordinate) => Point;
  route: Point[];
  runs: Run[];
  spots: Spot[];
  landmarks: Landmark[];
  cameras: Point[];
  start: Landmark | null;
  target: Landmark;
  extent: { minX: number; minY: number; maxX: number; maxY: number };
  /** Where a named place is: either end of the route, a building's centre, or the part of a street nearest the route. */
  locate: (name: string) => Point | null;
};

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function toSegment(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function toLine(p: Point, line: Point[]) {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) best = Math.min(best, toSegment(p, line[i - 1], line[i]));
  return line.length === 1 ? distance(p, line[0]) : best;
}
function inside(p: Point, ring: Point[]) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
/** The point halfway along a polyline, so a marker sits on the route itself. */
export function midpoint(line: Point[]): Point {
  const total = line.slice(1).reduce((sum, p, i) => sum + distance(line[i], p), 0);
  let left = total / 2;
  for (let i = 1; i < line.length; i++) {
    const step = distance(line[i - 1], line[i]);
    if (step >= left && step > 0) {
      const t = left / step;
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
    }
    left -= step;
  }
  return line[0] ?? [0, 0];
}
function centroid(ring: Point[]): Point {
  const points = ring.length > 1 && distance(ring[0], ring[ring.length - 1]) < 1e-6 ? ring.slice(0, -1) : ring;
  return [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
}
const joined = (lines: Point[][]) => lines.reduce<Point[]>((all, line) => all.length && line.length && distance(all[all.length - 1], line[0]) < 0.01 ? [...all, ...line.slice(1)] : [...all, ...line], []);

export function buildWalk(data: Destination): Walk {
  const frame = routeFrame(data), project = (c: Coordinate): Point => frame.project(c);
  /** Frame units for a distance in metres. */
  const m = (metresAway: number) => metresAway * frame.scale;
  const route = data.line.map(project);
  const lines = data.stretches.map(stretch => stretch.line.map(project));
  const byId = new Map(data.findings.map(finding => [finding.id, finding]));
  const flagged = (index: number) => data.stretches[index].findings.map(id => byId.get(id)!).filter(finding => finding.barrier);

  const runs: Run[] = [];
  for (const stretch of data.stretches) {
    const kind = stretch.status === 'no-photos' ? 'no-photos' : 'seen', last = runs[runs.length - 1];
    if (last?.kind === kind) last.path = joined([last.path, lines[stretch.index]]);
    else runs.push({ kind, path: lines[stretch.index] });
  }
  if (!runs.length) runs.push({ kind: 'seen', path: route });

  const named = (feature: MapFeature) => feature.name.trim();
  const buildingRings = data.buildings.filter(named).map(b => ({ name: b.name, ring: b.points.map(project) }));
  const streetLines = data.ways.filter(named).map(w => ({ name: w.name, line: w.points.map(project) }));
  const start: Landmark | null = data.start ? { name: data.start.name, at: project(data.start.position), kind: 'start' } : null;
  const target: Landmark = { name: data.target.name, at: project(data.target.position), kind: 'target' };
  const end = data.stretches.at(-1)?.to ?? 0;
  function near(at: Point, from: number, to: number): Landmark | null {
    if (start && from === 0) return start;
    if (to >= end && end > 0) return target;
    const building = buildingRings.map(b => ({ ...b, d: inside(at, b.ring) ? 0 : toLine(at, b.ring) })).sort((a, b) => a.d - b.d)[0];
    if (building && building.d <= m(30)) return { name: building.name, at: centroid(building.ring), kind: 'building' };
    const street = streetLines.map(s => ({ ...s, d: toLine(at, s.line) })).sort((a, b) => a.d - b.d)[0];
    return street ? { name: street.name, at, kind: 'street' } : null;
  }

  const spots: Spot[] = [];
  for (const stretch of data.stretches) {
    if (stretch.status === 'clear') continue;
    const kind = stretch.status === 'no-photos' ? 'no-photos' : 'flagged', last = spots[spots.length - 1];
    const findings = kind === 'flagged' ? flagged(stretch.index) : [];
    const continues = last && last.kind === kind && last.stretches[last.stretches.length - 1] === stretch.index - 1 &&
      (kind === 'no-photos' || findings.some(finding => last.findings.includes(finding)));
    if (continues) {
      last.stretches.push(stretch.index); last.to = stretch.to; last.path = joined([last.path, lines[stretch.index]]);
      for (const finding of findings) if (!last.findings.includes(finding)) last.findings.push(finding);
    } else {
      spots.push({ id: `stretch-${stretch.index}`, kind, stretches: [stretch.index], from: stretch.from, to: stretch.to, at: [0, 0], path: lines[stretch.index], findings, near: null });
    }
  }
  for (const spot of spots) {
    spot.at = midpoint(spot.path);
    spot.near = near(spot.at, spot.from, spot.to);
    spot.findings.sort((a, b) => Number(!a.viewId) - Number(!b.viewId) || (b.score ?? 0) - (a.score ?? 0));
  }

  const routeDistance = (p: Point) => toLine(p, route);
  const landmarks: Landmark[] = [];
  for (const building of buildingRings) {
    if (landmarks.some(l => l.name === building.name)) continue;
    if (Math.min(...building.ring.map(routeDistance)) <= m(25)) landmarks.push({ name: building.name, at: centroid(building.ring), kind: 'building' });
  }
  const streets = new Map<string, Point[]>();
  for (const stretch of data.stretches) {
    const mid = midpoint(lines[stretch.index]);
    const street = streetLines.map(s => ({ ...s, d: toLine(mid, s.line) })).sort((a, b) => a.d - b.d)[0];
    if (street && street.d <= m(4)) streets.set(street.name, [...(streets.get(street.name) ?? []), mid]);
  }
  for (const [name, points] of streets) if (points.length >= 6) landmarks.push({ name, at: points[Math.floor(points.length / 2)], kind: 'street' });

  const cameras = data.photos.map(photo => project(photo.position));
  const box = [...route, target.at, ...(start ? [start.at] : [])];
  const extent = { minX: Math.min(...box.map(p => p[0])), minY: Math.min(...box.map(p => p[1])), maxX: Math.max(...box.map(p => p[0])), maxY: Math.max(...box.map(p => p[1])) };
  function locate(name: string): Point | null {
    if (start?.name === name) return start.at;
    if (target.name === name) return target.at;
    const building = buildingRings.find(b => b.name === name);
    if (building) return centroid(building.ring);
    const vertices = streetLines.filter(s => s.name === name).flatMap(s => s.line);
    return vertices.length ? vertices.reduce((best, p) => routeDistance(p) < routeDistance(best) ? p : best) : null;
  }
  return {
    project, route, runs, spots, landmarks, cameras, start, target, extent, locate,
  };
}

/** The stretch whose line passes closest to a map point, for selecting the route anywhere. */
export function nearestStretch(data: Destination, walk: Walk, at: Point): number | null {
  let best: { index: number; d: number } | null = null;
  for (const stretch of data.stretches) {
    const d = toLine(at, stretch.line.map(walk.project));
    if (!best || d < best.d) best = { index: stretch.index, d };
  }
  return best?.index ?? null;
}

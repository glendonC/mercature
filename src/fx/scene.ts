import { captureOrder, routeFrame } from '../destinations/GeographicMap';
import type { Coordinate, Destination } from '../destinations/data';
import type { Point, Walk } from '../destinations/walk';
import { locate, pointAt, track, type Track } from './space';

/** A recorded finding as a mark on the walk. */
export type Mark = { at: Coordinate; barrier: boolean };

/** The recorded walk as effects read it: everything measured along the route, in route-frame units. */
export type FxScene = {
  route: Track;
  /** Route-frame units per metre. */
  unit: number;
  stretches: { index: number; status: 'clear' | 'barrier' | 'no-photos'; from: number; to: number; mid: Point }[];
  /** In walking order. */
  marks: { at: Point; s: number; barrier: boolean }[];
  /** In capture order, oldest first. */
  photos: { id: string; at: Point; s: number; d: number; openable: boolean }[];
  spots: { id: string; kind: 'flagged' | 'no-photos'; at: Point; s: number }[];
};

/** Reads a place once for its effects. Without marks it uses the findings the place data keeps, each in the middle of its stretch. */
export function fxScene(data: Destination, walk: Walk, marks?: readonly Mark[]): FxScene {
  const route = track(walk.route), unit = routeFrame(data).scale;
  const along = (metres: number) => metres / Math.max(1e-6, data.lengthMetres) * route.length;
  const stretches = data.stretches.map(stretch => ({ index: stretch.index, status: stretch.status, from: along(stretch.from), to: along(stretch.to), mid: pointAt(route, along((stretch.from + stretch.to) / 2)) }));
  const placed: { at: Point; barrier: boolean }[] = marks?.length ? marks.map(mark => ({ at: walk.project(mark.at), barrier: mark.barrier }))
    : data.stretches.flatMap(stretch => stretch.findings.flatMap(id => { const finding = data.findings.find(item => item.id === id); return finding ? [{ at: stretches[stretch.index].mid, barrier: finding.barrier }] : []; }));
  const openable = new Set(data.views.map(view => view.photoId));
  return {
    route, unit, stretches,
    marks: placed.map(mark => ({ ...mark, s: locate(route, mark.at).s })).sort((a, b) => a.s - b.s),
    photos: captureOrder(data.photos).map(photo => { const at = walk.project(photo.position), where = locate(route, at); return { id: photo.id, at, s: where.s, d: where.d, openable: openable.has(photo.id) }; }),
    spots: walk.spots.map(spot => ({ id: spot.id, kind: spot.kind, at: spot.at, s: locate(route, spot.at).s })),
  };
}

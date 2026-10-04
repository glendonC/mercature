import type { Destination } from '../destinations/data';
import type { Point, Walk } from '../destinations/walk';
import { easeOut } from './paint';
import { locate, track } from './space';

/**
 * How the blocks rise while the map first leans back: those beside the tour route first, then outward, a little later toward its end.
 * Gives each block a share of its height, 0 to 1, at a time since the lean began; every block is whole by the end.
 * Presentation only: the heights themselves stay the map's.
 */
export function riseWave(data: Destination, walk: Walk, over = 1000): (id: string, elapsed: number) => number {
  const route = track(walk.route);
  const placed = data.buildings.map(building => {
    const ring = building.points.map(walk.project), centre = ring.reduce<Point>((sum, p) => [sum[0] + p[0] / ring.length, sum[1] + p[1] / ring.length], [0, 0]);
    const where = locate(route, centre);
    return { id: building.id, d: where.d, along: route.length ? where.s / route.length : 0 };
  });
  const far = Math.max(1e-6, ...placed.map(item => item.d)), each = over * 0.55, spread = over - each;
  const wait = new Map(placed.map(item => [item.id, spread * (0.75 * Math.sqrt(item.d / far) + 0.25 * item.along)] as const));
  return (id, elapsed) => {
    const delay = wait.get(id);
    return delay == null ? 1 : easeOut(Math.max(0, Math.min(1, (elapsed - delay) / each)));
  };
}

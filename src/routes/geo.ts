/** Small geometry on [lon, lat] points, in metres on a local flat frame. Good to a few centimetres over a tour route of a few kilometres. */
import type { LonLat } from '../osm/access.ts';

const R = 6371008.8 * Math.PI / 180;

/** East and north metres of a point from an origin. */
export const local = (point: LonLat, origin: LonLat): [number, number] => [(point[0] - origin[0]) * Math.cos(origin[1] * Math.PI / 180) * R, (point[1] - origin[1]) * R];
export const distance = (a: LonLat, b: LonLat): number => Math.hypot(...local(b, a));
/** Seven decimals, about a centimetre, as the place packages keep their points. */
export const round = (point: LonLat): LonLat => [Math.round(point[0] * 1e7) / 1e7, Math.round(point[1] * 1e7) / 1e7];
export const tenth = (metres: number): number => Math.round(metres * 10) / 10;

/** Decodes an encoded polyline at 6 decimals, as Valhalla returns its shapes, into [lon, lat] points. */
export function decodePolyline6(text: string): LonLat[] {
  const points: LonLat[] = [];
  let index = 0, lat = 0, lon = 0;
  const next = () => {
    let result = 0, shift = 0, byte = 0;
    do { byte = text.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < text.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < text.length) {
    lat += next(); lon += next();
    points.push([lon / 1e6, lat / 1e6]);
  }
  return points;
}

/** Distance from the start of the line to each of its points. */
export function along(line: readonly LonLat[]): number[] {
  const at = [0];
  for (let i = 1; i < line.length; i++) at.push(at[i - 1] + distance(line[i - 1], line[i]));
  return at;
}

/** The point at a distance along the line. */
export function pointAt(line: readonly LonLat[], at: readonly number[], metres: number): LonLat {
  if (metres <= 0) return line[0];
  for (let i = 1; i < line.length; i++) {
    if (at[i] >= metres) {
      const step = at[i] - at[i - 1], t = step > 0 ? (metres - at[i - 1]) / step : 0;
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
    }
  }
  return line[line.length - 1];
}

/** The part of the line between two distances along it, its ends cut where they fall. */
export function slice(line: readonly LonLat[], at: readonly number[], from: number, to: number): LonLat[] {
  const part: LonLat[] = [pointAt(line, at, from)];
  for (let i = 0; i < line.length; i++) if (at[i] > from && at[i] < to) part.push(line[i]);
  part.push(pointAt(line, at, to));
  return part.map(round);
}

/** Where a point falls along the line: the distance from the start of its nearest point on the line, and how far off it lies. */
export function project(point: LonLat, line: readonly LonLat[], at: readonly number[]): { metres: number; away: number } {
  if (line.length === 1) return { metres: 0, away: distance(point, line[0]) };
  let best = { metres: 0, away: Infinity };
  for (let i = 1; i < line.length; i++) {
    const a = local(line[i - 1], point), b = local(line[i], point), dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / length)) : 0, away = Math.hypot(a[0] + t * dx, a[1] + t * dy);
    if (away < best.away) best = { metres: at[i - 1] + t * (at[i] - at[i - 1]), away };
  }
  return best;
}

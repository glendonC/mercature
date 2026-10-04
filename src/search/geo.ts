/** Small geometry on [lon, lat] points, in metres on a local flat frame. Good to a few centimetres over a tour route of a few kilometres. */
export type LonLat = [number, number];

const R = 6371008.8 * Math.PI / 180;

/** East and north metres of a point from an origin. */
export function local(point: LonLat, origin: LonLat): [number, number] {
  return [(point[0] - origin[0]) * Math.cos(origin[1] * Math.PI / 180) * R, (point[1] - origin[1]) * R];
}

export function distance(a: LonLat, b: LonLat): number {
  return Math.hypot(...local(b, a));
}

/** Decodes an encoded polyline at 6 decimals, as Valhalla returns its shape, into [lon, lat] points. */
export function decodePolyline6(text: string): LonLat[] {
  const points: LonLat[] = [];
  let index = 0, lat = 0, lon = 0;
  const next = () => {
    let result = 0, shift = 0, byte = 0;
    do { byte = text.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < text.length + 1);
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
  return part;
}

/** Shortest distance from a point to a line, in metres. */
export function toLine(point: LonLat, line: readonly LonLat[]): number {
  if (line.length === 1) return distance(point, line[0]);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = local(line[i - 1], point), b = local(line[i], point), dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / length)) : 0;
    best = Math.min(best, Math.hypot(a[0] + t * dx, a[1] + t * dy));
  }
  return best;
}

/** Where a point falls along the line: the distance from the start of its nearest point on the line. */
export function project(point: LonLat, line: readonly LonLat[], at: readonly number[]): { metres: number; away: number } {
  let best = { metres: 0, away: Infinity };
  for (let i = 1; i < line.length; i++) {
    const a = local(line[i - 1], point), b = local(line[i], point), dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / length)) : 0, away = Math.hypot(a[0] + t * dx, a[1] + t * dy);
    if (away < best.away) best = { metres: at[i - 1] + t * (at[i] - at[i - 1]), away };
  }
  return best;
}

/** Fewer points for the same line, none further than the tolerance from it (Douglas and Peucker). */
export function simplify(line: readonly LonLat[], tolerance: number): LonLat[] {
  if (line.length < 3) return [...line];
  const keep = new Uint8Array(line.length); keep[0] = keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let worst = -1, index = -1;
    for (let i = first + 1; i < last; i++) { const d = toLine(line[i], [line[first], line[last]]); if (d > worst) { worst = d; index = i; } }
    if (worst > tolerance) { keep[index] = 1; stack.push([first, index], [index, last]); }
  }
  return line.filter((_, i) => keep[i]);
}

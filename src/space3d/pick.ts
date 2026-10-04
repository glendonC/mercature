/** Where a tap on the 3D lands: the point she tapped, or the ground under it, as a place on the map. */
import type { Coordinate } from '../destinations/data';
import type { Vec3 } from './render';
import type { Area } from './space';

/** The tapped point: of the points within reach of the tap, those on the surface nearest the camera, and of those the one nearest
 * the tap. Points behind that surface (2 m or more further) are not what she tapped. */
export function pickPoint(areas: readonly Area[], m: Float32Array, width: number, height: number, x: number, y: number, reach = 24): Vec3 | null {
  const near: number[] = [];
  let front = Infinity;
  for (const area of areas) {
    const p = area.positions;
    for (let i = 0; i < area.n; i++) {
      const px = p[i * 3], py = p[i * 3 + 1], pz = p[i * 3 + 2], w = m[3] * px + m[7] * py + m[11] * pz + m[15];
      if (w <= 0.05) continue;
      const sx = ((m[0] * px + m[4] * py + m[8] * pz + m[12]) / w * 0.5 + 0.5) * width;
      if (Math.abs(sx - x) > reach) continue;
      const sy = (0.5 - (m[1] * px + m[5] * py + m[9] * pz + m[13]) / w * 0.5) * height, d = Math.hypot(sx - x, sy - y);
      if (d > reach) continue;
      near.push(px, py, pz, w, d);
      front = Math.min(front, w);
    }
  }
  let best: Vec3 | null = null, closest = Infinity;
  for (let j = 0; j < near.length; j += 5) if (near[j + 3] <= front + 2 && near[j + 4] < closest) { closest = near[j + 4]; best = [near[j], near[j + 1], near[j + 2]]; }
  return best;
}

function invert(m: Float32Array): Float32Array | null {
  const a = Array.from(m), inv = new Float32Array(16);
  inv[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
  inv[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
  inv[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
  inv[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
  inv[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
  inv[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
  inv[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
  inv[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
  inv[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
  inv[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
  inv[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
  inv[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
  inv[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
  inv[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
  inv[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
  inv[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
  const det = a[0] * inv[0] + a[1] * inv[4] + a[2] * inv[8] + a[3] * inv[12];
  if (!det) return null;
  for (let i = 0; i < 16; i++) inv[i] /= det;
  return inv;
}

/** Where the tap's ray meets the ground, with the ground's height where it lands (a few rounds, as it varies along the tour route). */
export function pickGround(m: Float32Array, width: number, height: number, x: number, y: number, groundAt: (east: number, north: number) => number): Vec3 | null {
  const inv = invert(m);
  if (!inv) return null;
  const nx = x / width * 2 - 1, ny = 1 - y / height * 2;
  const at = (z: number): Vec3 => { const w = inv[3] * nx + inv[7] * ny + inv[11] * z + inv[15]; return [(inv[0] * nx + inv[4] * ny + inv[8] * z + inv[12]) / w, (inv[1] * nx + inv[5] * ny + inv[9] * z + inv[13]) / w, (inv[2] * nx + inv[6] * ny + inv[10] * z + inv[14]) / w]; };
  const a = at(-1), b = at(1), dz = b[2] - a[2];
  if (Math.abs(dz) < 1e-6) return null;
  let level = groundAt(a[0], a[1]), hit: Vec3 | null = null;
  for (let round = 0; round < 3; round++) {
    const t = (level - a[2]) / dz;
    if (t < 0 || t > 1) return null;
    hit = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, level];
    level = groundAt(hit[0], hit[1]);
  }
  return hit;
}

/** A place in the route's frame (east and north metres from the record's origin) on the map, inverting data.ts's metres(). */
export function lonLatOf(east: number, north: number, origin: Coordinate): Coordinate {
  const r = 6371008.8 * Math.PI / 180;
  return [origin[0] + east / (Math.cos(origin[1] * Math.PI / 180) * r), origin[1] + north / r];
}

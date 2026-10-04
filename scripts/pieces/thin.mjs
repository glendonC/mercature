#!/usr/bin/env node
// Thins the 3D areas VGGT built from a walk's street photos (.local/routes/<id>/pieces/*.bin, MRP1) to a phone budget
// and writes them to public/places/<folder>/pieces/: one MRQ1 file per placed area and space.json, which lists them.
// Usage: node scripts/pieces/thin.mjs <id> [folder]. No network; the same input gives the same bytes.
//
// Each area drops everything outside its 1st to 99th percentile box, sky (blue points more than SKY_M above the area's
// low ground), and every point in a sparse NOISE_M voxel (fewer than MIN_POINTS points) as noise, then keeps one point per occupied voxel (the mean position and colour of the points
// in it), with the voxel size chosen so the area lands near TARGET points. Points are shuffled with a seed, so any
// prefix is an even sample.
//
// MRQ1, little-endian: 'MRQ1', uint32 n, float32 x0 y0 z0 (east, north, up metres in the walk's frame), float32 step,
// then n uint16 x y z (position = corner + q * step), then n uint8 r g b from the photos.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGET = Number(process.env.THIN_TARGET ?? 40000), NOISE_M = 0.25, MIN_POINTS = Number(process.env.THIN_MIN_POINTS ?? 3), CROP = [0.01, 0.99], SKY_M = 2;
/** Areas placed on the map with more error than this are left out. */
const MAX_RESIDUAL_M = 0.5;
/** Areas left out after looking at them at full size and thinned, with the plain reason. */
const SQUARE = 'Its shape cannot be read: the open square comes out as streaks from where the photos were taken, at full size too.';
const SCATTER = 'Its shape cannot be read: scattered points with no clear wall or ground.';
const LEFT_OUT = {
  'cusco-qorikancha': { s01: 'Its shape cannot be read: a few photos give fans of streaks.', s02: SQUARE, s03: SQUARE, s04: SQUARE, s05: SQUARE, s07: SQUARE, s08: SQUARE, s09: SQUARE, s10: SQUARE, s11: SCATTER, s17: SCATTER },
  'tbilisi-narikala': {},
};
const FOLDERS = { 'cusco-qorikancha': 'qorikancha', 'tbilisi-narikala': 'narikala' };

const id = process.argv[2];
if (!id || !Object.hasOwn(FOLDERS, id) && !process.argv[3]) {
  console.error(`Usage: node scripts/pieces/thin.mjs <id> [folder], where <id> is one of: ${Object.keys(FOLDERS).join(', ')}.`);
  process.exit(1);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = join(root, '.local/routes', id);
const target = process.env.THIN_OUT ? resolve(process.env.THIN_OUT) : join(root, 'public/places', process.argv[3] ?? FOLDERS[id], 'pieces');
if (!existsSync(join(source, 'route.json'))) throw new Error(`Missing ${join(source, 'route.json')}; link .local/routes first.`);
const record = JSON.parse(readFileSync(join(source, 'route.json'), 'utf8'));
if (record.schema !== 'mercature-route/1' || record.id !== id || record.synthetic !== false) throw new Error('Unexpected route record.');
if (record.route.frame.axes !== 'east-north-up') throw new Error('Unexpected frame.');
const origin = record.route.frame.origin;
const R = 6371008.8 * Math.PI / 180;
const enu = ([lon, lat]) => [(lon - origin[0]) * Math.cos(origin[1] * Math.PI / 180) * R, (lat - origin[1]) * R];
const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;

function readPiece(spot) {
  const bytes = readFileSync(join(source, spot.piece.file));
  if (bytes.subarray(0, 4).toString() !== 'MRP1') throw new Error(`${spot.id}: not MRP1.`);
  const size = bytes.readUInt32LE(4), header = JSON.parse(bytes.subarray(8, 8 + size).toString('utf8')), n = header.points, at = 8 + size;
  if (header.spot !== spot.id || bytes.length !== at + 21 * n) throw new Error(`${spot.id}: size does not match.`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const positions = new Float32Array(n * 3), colours = new Uint8Array(n * 3);
  for (let i = 0; i < n * 3; i++) positions[i] = view.getFloat32(at + i * 4, true);
  colours.set(bytes.subarray(at + n * 18, at + n * 21));
  return { n, positions, colours };
}

function quantile(values, q) { const sorted = Float64Array.from(values).sort(); return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]; }

const K = 1 << 14;
const cell = (x, y, z, box, v) => Math.floor((x - box[0]) / v) + Math.floor((y - box[1]) / v) * K + Math.floor((z - box[2]) / v) * K * K;

/** Blue and bright: the colour of the sky VGGT gives a depth to. */
const sky = (r, g, b) => b > 105 && b - r > 22 && b >= g;

/** The points inside the box, not sky, whose NOISE_M voxel holds at least MIN_POINTS points. */
function dense(cloud, box) {
  const inside = [], keys = [], counts = new Map(), low = box[2];
  for (let i = 0; i < cloud.n; i++) {
    const x = cloud.positions[i * 3], y = cloud.positions[i * 3 + 1], z = cloud.positions[i * 3 + 2];
    if (x < box[0] || y < box[1] || z < box[2] || x > box[3] || y > box[4] || z > box[5]) continue;
    if (z > low + SKY_M && sky(cloud.colours[i * 3], cloud.colours[i * 3 + 1], cloud.colours[i * 3 + 2])) continue;
    const key = cell(x, y, z, box, NOISE_M);
    inside.push(i); keys.push(key); counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return inside.filter((_, j) => counts.get(keys[j]) >= MIN_POINTS);
}

/** One point per occupied voxel of size v: the mean position and colour of its points. */
function voxels(cloud, box, kept, v) {
  const cells = new Map(), sums = [];
  for (const i of kept) {
    const x = cloud.positions[i * 3], y = cloud.positions[i * 3 + 1], z = cloud.positions[i * 3 + 2], key = cell(x, y, z, box, v);
    let at = cells.get(key);
    if (at === undefined) { at = sums.length; cells.set(key, at); sums.push([0, 0, 0, 0, 0, 0, 0]); }
    const s = sums[at]; s[0] += x; s[1] += y; s[2] += z; s[3] += cloud.colours[i * 3]; s[4] += cloud.colours[i * 3 + 1]; s[5] += cloud.colours[i * 3 + 2]; s[6]++;
  }
  return sums.map(s => s.slice(0, 6).map(value => value / s[6]));
}

function thin(cloud) {
  const axis = k => Array.from({ length: cloud.n }, (_, i) => cloud.positions[i * 3 + k]);
  const box = [0, 1, 2].map(k => quantile(axis(k), CROP[0])).concat([0, 1, 2].map(k => quantile(axis(k), CROP[1])));
  const kept = dense(cloud, box);
  if (kept.length <= TARGET) return { points: voxels(cloud, box, kept, 1e-4), voxel: 0, dense: kept.length };
  let lo = 0.005, hi = 2, best = voxels(cloud, box, kept, hi), voxel = hi;
  for (let step = 0; step < 30; step++) {
    const v = Math.sqrt(lo * hi), points = voxels(cloud, box, kept, v);
    if (points.length > TARGET) lo = v; else { hi = v; best = points; voxel = v; }
    if (Math.abs(points.length - TARGET) < TARGET * 0.02) { best = points; voxel = v; break; }
  }
  return { points: best, voxel, dense: kept.length };
}

function seeded(text) {
  let a = [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => { a = a + 0x6d2b79f5 >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function encode(points, seed) {
  const random = seeded(seed);
  for (let i = points.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [points[i], points[j]] = [points[j], points[i]]; }
  const min = [0, 1, 2].map(k => Math.min(...points.map(p => p[k]))), max = [0, 1, 2].map(k => Math.max(...points.map(p => p[k])));
  const step = Math.max(...max.map((value, k) => value - min[k])) / 65535 || 1e-3, n = points.length;
  const bytes = Buffer.alloc(24 + 9 * n);
  bytes.write('MRQ1', 0, 'latin1'); bytes.writeUInt32LE(n, 4);
  min.forEach((value, k) => bytes.writeFloatLE(Math.fround(value), 8 + k * 4)); bytes.writeFloatLE(step, 20);
  const corner = min.map((_, k) => bytes.readFloatLE(8 + k * 4)), unit = bytes.readFloatLE(20);
  points.forEach((p, i) => {
    for (let k = 0; k < 3; k++) bytes.writeUInt16LE(Math.max(0, Math.min(65535, Math.round((p[k] - corner[k]) / unit))), 24 + i * 6 + k * 2);
    for (let k = 0; k < 3; k++) bytes[24 + n * 6 + i * 3 + k] = Math.round(p[3 + k]);
  });
  return bytes;
}

/** Where the ground lies along the walk, for drawing the line and the marks on the areas: every 2 m of the walk,
 * a low quantile of the heights within 1.5 m, then filled in along the walk where no area reaches. Display only. */
function groundProfile(clouds) {
  const CELL = 1.5, grid = new Map(), key = (x, y) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  for (const cloud of clouds) for (let i = 0; i < cloud.n; i++) {
    const x = cloud.positions[i * 3], y = cloud.positions[i * 3 + 1], k = key(x, y);
    (grid.get(k) ?? grid.set(k, []).get(k)).push(x, y, cloud.positions[i * 3 + 2]);
  }
  const line = record.route.line.map(enu), samples = [];
  let along = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1], length = Math.hypot(bx - ax, by - ay);
    for (let d = 0; d < length; d += 2) samples.push([along + d, ax + (bx - ax) * d / length, ay + (by - ay) * d / length]);
    along += length;
  }
  samples.push([along, ...line.at(-1)]);
  const heights = samples.map(([, x, y]) => {
    const near = [];
    for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) {
      const cell = grid.get(key(x + gx * CELL, y + gy * CELL)) ?? [];
      for (let j = 0; j < cell.length; j += 3) if (Math.hypot(cell[j] - x, cell[j + 1] - y) <= CELL) near.push(cell[j + 2]);
    }
    return near.length >= 40 ? quantile(near, 0.2) : null;
  });
  const known = heights.flatMap((z, i) => z == null ? [] : [[samples[i][0], z]]);
  if (!known.length) return samples.filter((_, i) => i % 5 === 0 || i === samples.length - 1).map(([d]) => [round(d, 1), 0]);
  const at = d => {
    const next = known.findIndex(([k]) => k >= d);
    if (next === 0) return known[0][1];
    if (next === -1) return known.at(-1)[1];
    const [d0, z0] = known[next - 1], [d1, z1] = known[next];
    return z0 + (z1 - z0) * (d - d0) / (d1 - d0 || 1);
  };
  // Smooth over 10 m so a stray quantile does not kink the line.
  return samples.map(([d], i) => [d, heights[i] ?? at(d)]).map(([d], i, all) => {
    const near = all.filter(([e]) => Math.abs(e - d) <= 5);
    return [round(d, 1), round(near.reduce((sum, [, z]) => sum + z, 0) / near.length, 2)];
  }).filter((_, i, all) => i % 2 === 0 || i === all.length - 1);
}

const leftOut = { ...LEFT_OUT[id] };
for (const spot of record.spots) if (spot.state === 'joined' && spot.piece.residual_rms_m > MAX_RESIDUAL_M && !leftOut[spot.id]) leftOut[spot.id] = `It sits about ${spot.piece.residual_rms_m.toFixed(1)} m off on the map, more than ${MAX_RESIDUAL_M} m.`;
const joined = record.spots.filter(spot => spot.state === 'joined');
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
const clouds = [], pieces = [];
for (const spot of joined) {
  const cloud = readPiece(spot);
  // The ground along the walk comes from every area placed closely enough, shown or not.
  if (spot.piece.residual_rms_m <= MAX_RESIDUAL_M) clouds.push(cloud);
  if (leftOut[spot.id]) continue;
  const { points, voxel, dense: kept } = thin(cloud);
  const bytes = encode(points, `${id}/${spot.id}`);
  writeFileSync(join(target, `${spot.id}.bin`), bytes);
  pieces.push({ id: spot.id, file: `pieces/${spot.id}.bin`, points: points.length, bytes: bytes.length, voxel_m: round(voxel, 3), center: spot.center, stretches: spot.stretches, photos: spot.photos, residual_rms_m: spot.piece.residual_rms_m, from_points: cloud.n });
  console.log(`${spot.id}: ${cloud.n} -> ${kept} dense -> ${points.length} points, voxel ${voxel.toFixed(3)} m, ${(bytes.length / 1024).toFixed(0)} KB`);
}
const space = {
  schema: 'mercature-space/1',
  id,
  frame: record.route.frame,
  model: { name: 'VGGT-1B-Commercial', by: 'Meta AI', revision: joined[0]?.piece.model_revision ?? null, link: 'https://github.com/facebookresearch/vggt' },
  licence: 'CC BY-SA 4.0',
  credit: '3D built by VGGT from Mapillary street photos (CC BY-SA 4.0), credited by contributor',
  thinning: { target: TARGET, noise_m: NOISE_M, min_points: MIN_POINTS, crop: CROP, sky_m: SKY_M, max_residual_m: MAX_RESIDUAL_M },
  ground: groundProfile(clouds),
  pieces,
  left_out: [
    ...joined.filter(spot => leftOut[spot.id]).map(spot => ({ id: spot.id, reason: leftOut[spot.id] })),
    ...record.spots.filter(spot => spot.state !== 'joined').map(spot => ({ id: spot.id, reason: spot.reason })),
  ],
};
writeFileSync(join(target, 'space.json'), `${JSON.stringify(space)}\n`);
const total = pieces.reduce((sum, piece) => sum + piece.bytes, 0);
console.log(`${pieces.length} areas, ${pieces.reduce((sum, piece) => sum + piece.points, 0)} points, ${(total / 1e6).toFixed(2)} MB plus space.json`);

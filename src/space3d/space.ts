/** The published 3D areas of a walk: what scripts/pieces/thin.mjs writes to public/places/<folder>/pieces. */
import { PACKAGES, metres, type Coordinate, type Destination } from '../destinations/data';

export type SpacePiece = { id: string; file: string; points: number; bytes: number; center: Coordinate; stretches: number[]; photos: string[]; residual: number };
export type Space = { base: string; pieces: SpacePiece[]; ground: [number, number][]; model: { name: string; by: string; link: string | null }; licence: string };
/** One area's points in the walk's frame: east, north, up metres from the record's origin, and colours from the photos. */
export type Area = { id: string; n: number; positions: Float32Array; colours: Uint8Array; low: number; high: number };

const fail = (text: string): never => { throw new Error(text); };
const BASE = import.meta.env?.BASE_URL ?? '/';

/** Where a place's 3D areas are published, or null when it has none. */
export function spaceBase(data: Destination): string | null {
  const folder = PACKAGES[data.id];
  return folder ? `${BASE}places/${folder}/pieces/` : null;
}

export async function loadSpace(data: Destination, signal?: AbortSignal, from?: string): Promise<Space> {
  const base = from ?? spaceBase(data) ?? fail('This place has no 3D.');
  const response = await fetch(`${base}space.json`, { signal, redirect: 'error', credentials: 'same-origin' });
  if (!response.ok || !/json/i.test(response.headers.get('content-type') ?? '')) fail('This place has no 3D.');
  const root = await response.json() as Record<string, unknown>;
  if (root.schema !== 'mercature-space/1' || root.id !== data.id || !Array.isArray(root.pieces) || !Array.isArray(root.ground)) fail('The 3D record is malformed.');
  const model = root.model as Record<string, unknown>;
  const pieces = (root.pieces as Record<string, unknown>[]).slice(0, 200).map(p => {
    const id = String(p.id), file = String(p.file);
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(id) || file !== `pieces/${id}.bin`) fail('The 3D record is malformed.');
    return { id, file, points: Number(p.points), bytes: Number(p.bytes), center: p.center as Coordinate, stretches: (p.stretches as number[]) ?? [], photos: (p.photos as string[]) ?? [], residual: Number(p.residual_rms_m) };
  });
  return { base, pieces, ground: (root.ground as [number, number][]).filter(g => Array.isArray(g) && g.length === 2), model: { name: String(model?.name ?? 'VGGT'), by: String(model?.by ?? ''), link: typeof model?.link === 'string' ? model.link : null }, licence: String(root.licence ?? 'CC BY-SA 4.0') };
}

/** MRQ1: 'MRQ1', uint32 n, float32 corner x y z, float32 step, n uint16 x y z, n uint8 r g b. */
export function decodeArea(id: string, buffer: ArrayBuffer, expected: number): Area {
  const view = new DataView(buffer), bytes = new Uint8Array(buffer);
  if (buffer.byteLength < 24 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'MRQ1') fail('Unrecognized 3D format.');
  const n = view.getUint32(4, true);
  if (n !== expected || n > 200000 || buffer.byteLength !== 24 + 9 * n) fail('The 3D does not match its record.');
  const corner = [view.getFloat32(8, true), view.getFloat32(12, true), view.getFloat32(16, true)], step = view.getFloat32(20, true);
  const positions = new Float32Array(n * 3);
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < n * 3; i++) {
    const value = corner[i % 3] + view.getUint16(24 + i * 2, true) * step;
    positions[i] = value;
    if (i % 3 === 2) { low = Math.min(low, value); high = Math.max(high, value); }
  }
  return { id, n, positions, colours: bytes.slice(24 + n * 6, 24 + n * 9), low, high };
}

const areas = new Map<string, Promise<Area>>();
/** One area, decoded once per page; a view that mounts again reuses it. */
export function loadArea(space: Space, piece: SpacePiece): Promise<Area> {
  const url = space.base + piece.file.slice('pieces/'.length);
  if (!areas.has(url)) areas.set(url, fetchArea(url, piece).catch(error => { areas.delete(url); throw error; }));
  return areas.get(url)!;
}
async function fetchArea(url: string, piece: SpacePiece): Promise<Area> {
  const response = await fetch(url, { redirect: 'error', credentials: 'same-origin' });
  if (!response.ok || /text\/html/i.test(response.headers.get('content-type') ?? '')) fail('The 3D is not available.');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 2_000_000) fail('The 3D exceeds the size limit.');
  return decodeArea(piece.id, buffer, piece.points);
}

/** The walk in the frame of the 3D, with the distance along it at each vertex. */
export type Track = { points: [number, number][]; along: number[]; length: number };
export function track(data: Destination): Track {
  const origin: Coordinate = [data.origin[0], data.origin[1]];
  const points = data.line.map(p => metres(p, origin) as [number, number]), along = [0];
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return { points, along, length: along.at(-1) ?? 0 };
}

/** The distance along the walk of the nearest point on it, and how far away that point is. */
export function nearest(walk: Track, east: number, north: number): { along: number; off: number } {
  let best = { along: 0, off: Infinity };
  for (let i = 1; i < walk.points.length; i++) {
    const [ax, ay] = walk.points[i - 1], [bx, by] = walk.points[i], dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((east - ax) * dx + (north - ay) * dy) / length)) : 0;
    const off = Math.hypot(east - ax - t * dx, north - ay - t * dy);
    if (off < best.off) best = { along: walk.along[i - 1] + t * Math.sqrt(length), off };
  }
  return best;
}

/** The point at a distance along the walk. */
export function pointAt(walk: Track, distance: number): [number, number] {
  const d = Math.max(0, Math.min(walk.length, distance));
  for (let i = 1; i < walk.points.length; i++) {
    if (walk.along[i] >= d) {
      const [ax, ay] = walk.points[i - 1], [bx, by] = walk.points[i], span = walk.along[i] - walk.along[i - 1] || 1, t = (d - walk.along[i - 1]) / span;
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    }
  }
  return walk.points.at(-1) ?? [0, 0];
}

/** The ground height the build measured along the walk, at a distance along it. Display only. */
export function groundAt(space: Space, distance: number): number {
  const g = space.ground;
  if (!g.length) return 0;
  if (distance <= g[0][0]) return g[0][1];
  for (let i = 1; i < g.length; i++) if (g[i][0] >= distance) { const [d0, z0] = g[i - 1], [d1, z1] = g[i]; return z0 + (z1 - z0) * (distance - d0) / (d1 - d0 || 1); }
  return g.at(-1)![1];
}

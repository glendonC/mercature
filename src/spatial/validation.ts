import { SCHEMA_VERSION, type Profile, type Rect, type Scene, type Scenario } from './contracts';

export const SOLVER_VERSION = 'rect-envelope-v1.0.1';
// Version/configuration binding. Increment the version whenever solver semantics change.
export const SOLVER_HASH = contentHash({ version: SOLVER_VERSION, envelope: 'fixed-axis-square', transitions: 'coplanar-cardinal-continuous-sweep', cellMargin: 'half-cell', uncertainty: 'conservative-bounds', maximumCells: 60000, maximumCellFeatureProduct: 3000000, numericalToleranceMetres: 1e-9 });
const fail = (message: string): never => { throw new Error(message); };
function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Expected an object');
  return value as Record<string, unknown>;
}
function finite(value: unknown, name: string, min = -10000, max = 10000): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`Invalid ${name}`);
}
function str(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) fail(`Invalid ${name}`);
}
function list(value: unknown, name: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length > 200) fail(`Invalid ${name}`);
}
function strings(value: unknown, name: string) { list(value, name); for (const s of value) str(s, name); }
export function validateRect(value: unknown): asserts value is Rect {
  const b = obj(value); for (const key of ['minX', 'minY', 'maxX', 'maxY']) finite(b[key], key);
  if ((b.minX as number) >= (b.maxX as number) || (b.minY as number) >= (b.maxY as number)) fail('Rectangle must have positive dimensions');
}
export function contains(outer: Rect, inner: Rect) {
  return inner.minX >= outer.minX - 1e-9 && inner.maxX <= outer.maxX + 1e-9 && inner.minY >= outer.minY - 1e-9 && inner.maxY <= outer.maxY + 1e-9;
}
export function overlaps(a: Rect, b: Rect) {
  return a.minX < b.maxX - 1e-9 && a.maxX > b.minX + 1e-9 && a.minY < b.maxY - 1e-9 && a.maxY > b.minY + 1e-9;
}
export function expand(r: Rect, amount: number): Rect {
  return { minX: r.minX - amount, minY: r.minY - amount, maxX: r.maxX + amount, maxY: r.maxY + amount };
}
export function validRect(r: Rect) { return r.minX < r.maxX && r.minY < r.maxY; }
/** Exact rectangle-union coverage, including seams. No sampling can erase a thin gap. */
export function covered(rect: Rect, supports: Rect[]): boolean {
  const clipped = supports.filter(validRect).filter(s => overlaps(rect, s));
  const xs = [...new Set([rect.minX, rect.maxX, ...clipped.flatMap(s => [Math.max(rect.minX, s.minX), Math.min(rect.maxX, s.maxX)])])].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const x = (xs[i] + xs[i + 1]) / 2;
    const ys = clipped.filter(s => s.minX <= x && s.maxX >= x).map(s => [s.minY, s.maxY]).sort((a, b) => a[0] - b[0]);
    let end = rect.minY;
    for (const [lo, hi] of ys) { if (lo > end + 1e-9) break; end = Math.max(end, hi); }
    if (end < rect.maxY - 1e-9) return false;
  }
  return clipped.length > 0;
}
export function validateScene(value: unknown): asserts value is Scene {
  const s = obj(value);
  if (s.schemaVersion !== SCHEMA_VERSION || s.provenance !== 'synthetic' || s.units !== 'm') fail('Only spatial-v1 synthetic metric scenes are supported');
  str(s.id, 'scene id'); str(s.title, 'scene title'); finite(s.revision, 'revision', 1); if (!Number.isInteger(s.revision)) fail('Revision must be an integer');
  validateRect(s.bounds); strings(s.assumptions, 'assumptions');
  const ids = new Set<string>();
  for (const group of ['supports', 'obstacles', 'unknown'] as const) {
    list(s[group], group);
    for (const raw of s[group] as unknown[]) {
      const item = obj(raw); str(item.id, 'feature id'); str(item.label, 'feature label');
      if (ids.has(item.id)) fail('Feature IDs must be unique'); ids.add(item.id);
      validateRect(item.bounds); if (!contains(s.bounds, item.bounds)) fail('Geometry lies outside the scene');
      if (group !== 'unknown') { finite(item.uncertainty, 'uncertainty', 0, 2); strings(item.evidence, 'evidence'); }
      if (group !== 'obstacles') finite(item.elevation, 'elevation');
      if (group === 'unknown') str(item.reason, 'unknown reason');
      if (group === 'obstacles') {
        finite(item.bottom, 'obstacle bottom'); finite(item.top, 'obstacle top');
        if ((item.top as number) <= (item.bottom as number)) fail('Obstacle must have positive height');
        if (typeof item.reviewed !== 'boolean' || typeof item.movable !== 'boolean') fail('Obstacle review and mobility must be explicit');
      }
    }
  }
  const scene = value as Scene;
  if (!scene.supports.length) fail('At least one support is required');
  const destinationIds = new Set<string>(); list(s.destinations, 'destinations');
  for (const raw of [s.start, ...s.destinations]) {
    const p = obj(raw); finite(p.x, 'location x'); finite(p.y, 'location y'); str(p.supportId, 'location support');
    const support = scene.supports.find(f => f.id === p.supportId);
    if (!support || (p.x as number) < support.bounds.minX || (p.x as number) > support.bounds.maxX || (p.y as number) < support.bounds.minY || (p.y as number) > support.bounds.maxY) fail('Location must reference support at its position');
    if (raw !== s.start) { str(p.id, 'destination id'); str(p.label, 'destination label'); if (destinationIds.has(p.id)) fail('Duplicate destination'); destinationIds.add(p.id); }
  }
}
export function validateProfile(value: unknown): asserts value is Profile {
  const p = obj(value); str(p.id, 'profile id'); str(p.label, 'profile label'); str(p.source, 'profile source');
  finite(p.width, 'width', .05, 5); finite(p.height, 'height', .1, 5); finite(p.maxStep, 'maxStep', 0, 2); finite(p.cellSize, 'cell size', .025, .5);
  const r = obj(p.requirements);
  for (const key of ['longitudinalSlope', 'crossSlope', 'turning', 'multilevel']) if (typeof r[key] !== 'boolean') fail(`Requirement ${key} must be explicit`);
}
export function validateScenario(value: unknown): asserts value is Scenario {
  const s = obj(value);
  if (s.schemaVersion !== SCHEMA_VERSION || s.hypothetical !== true) fail('Scenario must remain explicitly hypothetical');
  for (const key of ['baseSceneHash', 'profileHash', 'solverHash']) str(s[key], key);
  list(s.operations, 'operations');
  for (const raw of s.operations) {
    const op = obj(raw); str(op.objectId, 'object id');
    if (op.kind !== 'remove' && op.kind !== 'move') fail('Unsupported scenario operation');
    if (op.kind === 'move') { const p = obj(op.to); finite(p.x, 'placement x'); finite(p.y, 'placement y'); }
  }
}
/** Canonical SHA-256 for dependency binding; keys are sorted, arrays retain authored order. */
export function contentHash(value: unknown): string {
  function canonical(v: unknown): string {
    if (v === null || typeof v !== 'object') {
      const result = JSON.stringify(v); if (result === undefined) fail('Cannot hash undefined'); return result;
    }
    if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
    return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  const input = new TextEncoder().encode(canonical(value));
  const length = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(length); bytes.set(input); bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer); view.setUint32(length - 4, input.length * 8);
  const primes: number[] = []; for (let n = 2; primes.length < 64; n++) if (!primes.some(p => p * p <= n && n % p === 0)) primes.push(n);
  const k = primes.map(p => Math.floor((Math.cbrt(p) % 1) * 2 ** 32) >>> 0);
  const h = primes.slice(0, 8).map(p => Math.floor((Math.sqrt(p) % 1) * 2 ** 32) >>> 0);
  const rot = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  const w = new Uint32Array(64);
  for (let off = 0; off < length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = w[i - 16] + (rot(a, 7) ^ rot(a, 18) ^ (a >>> 3)) + w[i - 7] + (rot(b, 17) ^ rot(b, 19) ^ (b >>> 10)); }
    let [a,b,c,d,e,f,g,j] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (j + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + k[i] + w[i]) | 0;
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      j=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
    }
    [a,b,c,d,e,f,g,j].forEach((v, i) => { h[i] = (h[i] + v) >>> 0; });
  }
  return `sha256:${h.map(v => v.toString(16).padStart(8, '0')).join('')}`;
}

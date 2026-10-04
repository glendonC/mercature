// SAM 3 scan rows to marks, as the route build turned them into findings: a detection counts
// when its score is above its prompt's threshold, overlapping detections of one concept in one view
// are one mark with the highest score, and a mark's outline is its largest part traced along pixel
// edges and simplified. Pure Node: masks are 8-bit greyscale PNGs at the view's size.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';

export const RULES = { overlap: 0.5, tolerance: 2, points: 64 };

/** An 8-bit greyscale, non-interlaced PNG as 0 or 1 per pixel (value above 127). */
export function readMask(path, width, height) {
  const bytes = readFileSync(path);
  if (bytes.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path} is not a PNG.`);
  let at = 8, w = 0, h = 0;
  const data = [];
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at), type = bytes.toString('ascii', at + 4, at + 8);
    if (type === 'IHDR') {
      w = bytes.readUInt32BE(at + 8); h = bytes.readUInt32BE(at + 12);
      if (bytes[at + 16] !== 8 || bytes[at + 17] !== 0 || bytes[at + 20] !== 0) throw new Error(`${path} is not 8-bit greyscale.`);
    } else if (type === 'IDAT') data.push(bytes.subarray(at + 8, at + 8 + length));
    else if (type === 'IEND') break;
    at += 12 + length;
  }
  if (w !== width || h !== height) throw new Error(`${path} is not the size of its view.`);
  const raw = inflateSync(Buffer.concat(data)), mask = new Uint8Array(w * h);
  let previous = new Uint8Array(w), row = new Uint8Array(w);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (w + 1)], line = raw.subarray(y * (w + 1) + 1, (y + 1) * (w + 1));
    for (let x = 0; x < w; x++) {
      const a = x ? row[x - 1] : 0, b = previous[x], c = x ? previous[x - 1] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[x] = value & 255;
      mask[y * w + x] = row[x] > 127 ? 1 : 0;
    }
    [previous, row] = [row, previous];
  }
  return mask;
}

/** The scan's prompts by prompt: concept, label, barrier, threshold and whether it only describes the scene. */
export function promptTable(entries) {
  return Object.fromEntries(entries.map(entry => [entry.prompt, { prompt: entry.prompt, concept: entry.concept, label: entry.label, barrier: entry.barrier === true, threshold: entry.threshold ?? 0.5, context: entry.context === true }]));
}

/**
 * Every mark in the scan rows for the views in sizes (view id to [width, height]): detections above
 * their prompt's threshold, overlapping ones of one concept in one view taken together. Prompts in
 * leave (a set) are skipped. Marks keep the scan's row order, as the build made them.
 */
export function marksFromRows(rows, scanDir, prompts, sizes, leave = new Set(), rules = RULES) {
  const found = new Map();
  for (const row of rows) {
    const prompt = prompts[row.prompt];
    if (!prompt) throw new Error(`${row.view_id}: prompt ${row.prompt} is not in the prompts file.`);
    if (leave.has(row.prompt) || !sizes.has(row.view_id)) continue;
    const [width, height] = sizes.get(row.view_id);
    for (const detection of row.detections ?? []) {
      if (!(detection.score > prompt.threshold)) continue;
      const key = `${row.view_id}\u0000${prompt.concept}`;
      if (!found.has(key)) found.set(key, []);
      found.get(key).push({ score: detection.score, prompt: row.prompt, photo: row.photo_id, view: row.view_id, mask: readMask(join(scanDir, detection.mask_path), width, height) });
    }
  }
  const marks = [];
  for (const detections of found.values()) {
    detections.sort((a, b) => b.score - a.score);
    const groups = [];
    for (const detection of detections) {
      const area = sum(detection.mask);
      const group = groups.find(group => area && shared(group.mask, detection.mask) >= rules.overlap * Math.min(area, group.smallest));
      if (group) { for (let i = 0; i < group.mask.length; i++) group.mask[i] |= detection.mask[i]; group.count++; group.smallest = Math.min(group.smallest, area); }
      else groups.push({ ...detection, mask: detection.mask.slice(), count: 1, smallest: area });
    }
    for (const group of groups) {
      const [width, height] = sizes.get(group.view);
      const traced = outlineOf(group.mask, width, height, rules);
      if (!traced) continue;
      const prompt = prompts[group.prompt];
      marks.push({ view_id: group.view, photo_id: group.photo, prompt: group.prompt, concept: prompt.concept, label: prompt.label, score: group.score, detections: group.count, mask: group.mask, width, height, ...traced });
    }
  }
  return marks;
}

const sum = mask => { let n = 0; for (let i = 0; i < mask.length; i++) n += mask[i]; return n; };
const shared = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) n += a[i] & b[i]; return n; };

/**
 * The largest part of a mask (pixels sharing an edge) as a ring of pixel corners along its outer
 * edge, simplified to at most rules.points corners, its box [x0, y0, x1, y1] (x1, y1 exclusive),
 * the share of the mask it holds and its pixel count. Null for an empty mask.
 */
export function outlineOf(mask, width, height, rules = RULES) {
  const label = new Int32Array(width * height).fill(-1), queue = new Int32Array(width * height);
  let best = -1, bestSize = 0, bestStart = -1, total = 0, parts = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start] !== -1) continue;
    let head = 0, tail = 0, size = 0;
    queue[tail++] = start; label[start] = parts;
    while (head < tail) {
      const at = queue[head++], x = at % width, y = (at - x) / width; size++;
      if (x > 0 && mask[at - 1] && label[at - 1] === -1) { label[at - 1] = parts; queue[tail++] = at - 1; }
      if (x < width - 1 && mask[at + 1] && label[at + 1] === -1) { label[at + 1] = parts; queue[tail++] = at + 1; }
      if (y > 0 && mask[at - width] && label[at - width] === -1) { label[at - width] = parts; queue[tail++] = at - width; }
      if (y < height - 1 && mask[at + width] && label[at + width] === -1) { label[at + width] = parts; queue[tail++] = at + width; }
    }
    total += size;
    if (size > bestSize) { best = parts; bestSize = size; bestStart = start; }
    parts++;
  }
  if (best < 0) return null;
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height && label[y * width + x] === best;
  // Walk the outer edge with the part on the right, from the top edge of its first pixel in raster
  // order, which no hole can own. Directions: 0 east, 1 south, 2 west, 3 north (y grows down).
  const dx = [1, 0, -1, 0], dy = [0, 1, 0, -1];
  // The pixel on the right of a step from corner (x, y) in direction d, and the one on its left.
  const right = (x, y, d) => d === 0 ? [x, y] : d === 1 ? [x - 1, y] : d === 2 ? [x - 1, y - 1] : [x, y - 1];
  const left = (x, y, d) => d === 0 ? [x, y - 1] : d === 1 ? [x, y] : d === 2 ? [x - 1, y] : [x - 1, y - 1];
  const edge = (x, y, d) => inside(...right(x, y, d)) && !inside(...left(x, y, d));
  const sx = bestStart % width, sy = (bestStart - sx) / width;
  const ring = [];
  let x = sx, y = sy, d = 0;
  do {
    ring.push([x, y]);
    x += dx[d]; y += dy[d];
    // Turn left first, so the ring keeps to the outermost edge and a gap that meets it at one
    // corner stays inside, as the build's exterior ring has it.
    for (const turn of [3, 0, 1, 2]) { const next = (d + turn) % 4; if (edge(x, y, next)) { d = next; break; } }
  } while (x !== sx || y !== sy || d !== 0);
  const corners = ring.filter((point, i) => {
    const before = ring[(i - 1 + ring.length) % ring.length], after = ring[(i + 1) % ring.length];
    return (point[0] - before[0]) * (after[1] - point[1]) !== (point[1] - before[1]) * (after[0] - point[0]);
  });
  const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  let tolerance = rules.tolerance, simple;
  for (;;) {
    simple = simplifyRing(corners, tolerance);
    if (simple.length <= rules.points || tolerance > 1000) break;
    tolerance *= 1.5;
  }
  if (simple.length < 3) simple = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]];
  return { outline: simple, box, share: bestSize / total, pixels: bestSize };
}

/** Douglas-Peucker on a closed ring, keeping its first corner and the corner furthest from it. */
export function simplifyRing(ring, tolerance) {
  if (ring.length <= 3) return ring.slice();
  let far = 0, farDistance = -1;
  for (let i = 1; i < ring.length; i++) { const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]); if (d > farDistance) { far = i; farDistance = d; } }
  const keep = new Uint8Array(ring.length + 1);
  keep[0] = keep[far] = keep[ring.length] = 1;
  const closed = [...ring, ring[0]];
  const stack = [[0, far], [far, ring.length]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let index = -1, distance = tolerance;
    for (let i = a + 1; i < b; i++) { const d = segmentDistance(closed[i], closed[a], closed[b]); if (d > distance) { index = i; distance = d; } }
    if (index > 0) { keep[index] = 1; stack.push([a, index], [index, b]); }
  }
  return ring.filter((_, i) => keep[i]);
}

function segmentDistance(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1], length2 = vx * vx + vy * vy;
  const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / length2)) : 0;
  return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy);
}

// Placement, as the build placed its findings: a mark's ground is the view's 3D points inside its
// outline where a placed piece holds enough of them, else its pixels cast onto level ground below
// the camera. Its position is the median of that ground (for a kerb, of the tenth nearest the
// route line); it is near the route within the record's near_m of the route line.
export const PLACE = { minPoints: 20, maxRangeM: 30, hfovDeg: 65, castPixels: 4000, groundRadiusM: 4, cameraHeightM: { true: 2, false: 1.5 }, findingM: 100, edges: new Set(['kerb', 'kerb ramp']) };

/** A piece file (MRP1): its spot, views, and per point the position, source view and pixel. */
export function readPiece(path) {
  const bytes = readFileSync(path);
  if (bytes.toString('ascii', 0, 4) !== 'MRP1') throw new Error(`${path} is not a piece.`);
  const size = bytes.readUInt32LE(4), header = JSON.parse(bytes.toString('utf8', 8, 8 + size)), n = header.points, at = 8 + size;
  if (bytes.length !== at + 21 * n) throw new Error(`${path} does not match its header.`);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
  const positions = new Float32Array(buffer, at, n * 3), view = new Uint16Array(buffer, at + n * 12, n), pixel = new Uint16Array(buffer, at + n * 14, n * 2);
  const byView = header.views.map(() => []);
  for (let i = 0; i < n; i++) byView[view[i]].push(i);
  return { spot: header.spot, views: header.views, positions, pixel, byView };
}

const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F), RAD = Math.PI / 180;
function ecef([lon, lat, h]) {
  const l = lon * RAD, p = lat * RAD, n = A / Math.sqrt(1 - E2 * Math.sin(p) ** 2);
  return [(n + h) * Math.cos(p) * Math.cos(l), (n + h) * Math.cos(p) * Math.sin(l), (n * (1 - E2) + h) * Math.sin(p)];
}
function geodetic([x, y, z]) {
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - E2)), h = 0;
  for (let i = 0; i < 8; i++) { const n = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2); h = p / Math.cos(lat) - n; lat = Math.atan2(z, p * (1 - E2 * n / (n + h))); }
  return [Math.atan2(y, x) / RAD, lat / RAD, h];
}
/** East, north, up metres from an origin [lon, lat, height] on the WGS 84 ellipsoid, and back. */
export function enuFrame(origin) {
  const zero = ecef(origin), l = origin[0] * RAD, p = origin[1] * RAD;
  const r = [[-Math.sin(l), Math.cos(l), 0], [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)], [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)]];
  return {
    toEnu: point => { const e = ecef(point).map((v, i) => v - zero[i]); return r.map(row => row[0] * e[0] + row[1] * e[1] + row[2] * e[2]); },
    toGps: ([e, n, u]) => geodetic([0, 1, 2].map(i => r[0][i] * e + r[1][i] * n + r[2][i] * u + zero[i])),
  };
}
/** East and north metres from an origin, scaled by the ellipsoid's radii of curvature there. */
export function localPlane([lon0, lat0]) {
  const x = Math.abs(lat0) * RAD, w = Math.sqrt(1 - E2 * Math.sin(x) ** 2);
  const east = A / w * Math.cos(x) * RAD, north = A * (1 - E2) / w ** 3 * RAD;
  return ([lon, lat]) => [(lon - lon0) * east, (lat - lat0) * north];
}
const metres = (a, b) => { const lat = (a[1] + b[1]) / 2 * RAD; return Math.hypot((b[0] - a[0]) * RAD * Math.cos(lat) * 6371008.8, (b[1] - a[1]) * RAD * 6371008.8); };
const median = values => { const s = Float64Array.from(values).sort(), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const percentile = (sorted, q) => { const i = q / 100 * (sorted.length - 1), lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); };
const heading = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 360 ? value : null;

/** The photo position and heading every stage uses: Mapillary's computed ones unless they sit more than maxCorrectionM from GPS, or on it. */
export function photoPose(photo, maxCorrectionM) {
  const gps = photo.position, computed = photo.computed_position;
  if (!computed) return { position: gps, heading: heading(photo.heading) };
  const [x, y] = localPlane(gps)(computed);
  if ((computed[0] === gps[0] && computed[1] === gps[1]) || Math.hypot(x, y) > maxCorrectionM) return { position: gps, heading: heading(photo.heading) };
  return { position: computed, heading: heading(photo.computed_heading) ?? heading(photo.heading) };
}

/** Point indices of the piece from this view whose pixel centre the outline covers (even-odd, on doubled coordinates). */
export function pinnedPoints(piece, viewId, outline) {
  const index = piece.views.indexOf(viewId);
  if (index < 0) return [];
  const xs = outline.map(p => p[0]), ys = outline.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const ring = outline.map(([a, b]) => [2 * a, 2 * b]), taken = [];
  for (const i of piece.byView[index]) {
    const px = piece.pixel[2 * i], py = piece.pixel[2 * i + 1];
    if (px + 0.5 < x0 || px + 0.5 > x1 || py + 0.5 < y0 || py + 0.5 > y1) continue;
    const x = 2 * px + 1, y = 2 * py + 1;
    let inside = false;
    for (let k = 0; k < ring.length; k++) {
      const [ax, ay] = ring[(k - 1 + ring.length) % ring.length], [bx, by] = ring[k];
      if (ay === by || (ay > y) === (by > y)) continue;
      const left = (x - ax) * (by - ay), right = (y - ay) * (bx - ax);
      if (by > ay ? left < right : left > right) inside = !inside;
    }
    if (inside) taken.push(i);
  }
  return taken;
}

function cameraOf(view, photo, frame, origin, piecesOf, rules, maxCorrectionM) {
  const is360 = photo.is_360 === true;
  if (view.camera) {
    const c = view.camera, m = c.world_to_camera, rotation = [m.slice(0, 3), m.slice(4, 7), m.slice(8, 11)], t = [m[3], m[7], m[11]];
    const centre = [0, 1, 2].map(j => -(rotation[0][j] * t[0] + rotation[1][j] * t[1] + rotation[2][j] * t[2]));
    let groundZ = null;
    for (const piece of piecesOf(view.id)) {
      const near = [];
      for (let i = 0; i < piece.positions.length / 3; i++) {
        const px = piece.positions[3 * i], py = piece.positions[3 * i + 1], pz = piece.positions[3 * i + 2], below = centre[2] - pz;
        if (Math.hypot(px - centre[0], py - centre[1]) <= rules.groundRadiusM && below >= 0.3 && below <= 6) near.push(pz);
      }
      if (near.length >= 50) { groundZ = median(near); break; }
    }
    return { fx: c.fx, fy: c.fy, cx: c.cx, cy: c.cy, rotation, centre, groundZ: groundZ ?? centre[2] - rules.cameraHeightM[is360] };
  }
  const pose = photoPose(photo, maxCorrectionM);
  let yaw, pitch;
  if (view.cut) [yaw, pitch] = [view.cut.yaw_deg, view.cut.pitch_deg];
  else if (pose.heading != null) [yaw, pitch] = [pose.heading, 0];
  else return null;
  const centre = frame.toEnu([pose.position[0], pose.position[1], origin[2]]);
  centre[2] = rules.cameraHeightM[is360];
  const width = view.cut ? view.cut.width_px : view.width, height = view.cut ? view.cut.height_px : view.height;
  const focal = width / 2 / Math.tan((view.cut ? view.cut.hfov_deg : rules.hfovDeg) * RAD / 2);
  const y = yaw * RAD, p = pitch * RAD, forward = [Math.cos(p) * Math.sin(y), Math.cos(p) * Math.cos(y), Math.sin(p)], right = [Math.cos(y), -Math.sin(y), 0];
  const down = [forward[1] * right[2] - forward[2] * right[1], forward[2] * right[0] - forward[0] * right[2], forward[0] * right[1] - forward[1] * right[0]];
  return { fx: focal, fy: focal, cx: (width - 1) / 2, cy: (height - 1) / 2, rotation: [right, down, forward], centre, groundZ: 0 };
}

/** The mark's pixels inside its box, an even sample of at most castPixels, cast onto level ground within maxRangeM of the camera. */
function cast(mark, camera, rules) {
  const [x0, y0, x1, y1] = mark.box, pixels = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (mark.mask[y * mark.width + x]) pixels.push(x, y);
  let count = pixels.length / 2, pick = null;
  if (count > rules.castPixels) { const step = (count - 1) / (rules.castPixels - 1); pick = Array.from({ length: rules.castPixels }, (_, i) => i === rules.castPixels - 1 ? count - 1 : Math.trunc(i * step)); count = rules.castPixels; }
  const { fx, fy, cx, cy, rotation: r, centre, groundZ } = camera, drop = groundZ - centre[2], ground = [];
  for (let k = 0; k < count; k++) {
    const i = pick ? pick[k] : k, u = (pixels[2 * i] - cx) / fx, v = (pixels[2 * i + 1] - cy) / fy;
    const ray = [0, 1, 2].map(j => r[0][j] * u + r[1][j] * v + r[2][j]);
    const t = drop / ray[2];
    if (!(ray[2] < -1e-6 && t > 0)) continue;
    const point = [centre[0] + t * ray[0], centre[1] + t * ray[1], centre[2] + t * ray[2]];
    if (Math.hypot(point[0] - centre[0], point[1] - centre[1]) <= rules.maxRangeM) ground.push(point);
  }
  return ground;
}

/**
 * Where each mark lies against the route: its method, ground position, distance along and from the
 * route line, and, when it is near the route, the stretches it spans (the build's rule: its ground
 * within reach, 5th to 95th percentile along the route, always the stretch under it, and only
 * stretches within findingM of its photo). pieces: placed pieces in the record's spot order.
 */
export function placeMarks(marks, record, pieces, rules = PLACE) {
  const origin = record.route.frame.origin, frame = enuFrame(origin), near = record.rules.near_m, maxCorrection = record.rules.max_correction_m;
  const plane = localPlane(record.route.line[0]), line = record.route.line.map(plane);
  const views = new Map(record.views.map(v => [v.id, v])), photos = new Map(record.photos.map(p => [p.id, p]));
  const piecesOf = id => pieces.filter(piece => piece.views.includes(id));
  const against = points => {
    const along = [], offset = [];
    for (const point of points) {
      const [px, py] = plane(frame.toGps(point));
      let bestAlong = 0, bestOffset = Math.hypot(px - line[0][0], py - line[0][1]), walked = 0;
      for (let k = 1; k < line.length; k++) {
        const [ax, ay] = line[k - 1], dx = line[k][0] - ax, dy = line[k][1] - ay, length2 = dx * dx + dy * dy, span = Math.sqrt(length2);
        const t = length2 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / length2)) : 0;
        const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
        if (d < bestOffset) { bestOffset = d; bestAlong = walked + t * span; }
        walked += span;
      }
      along.push(bestAlong); offset.push(bestOffset);
    }
    return { along, offset };
  };
  const spanOf = (lo, hi) => record.stretches.filter((s, i) => s.from_m <= hi && (lo < s.to_m || (i === record.stretches.length - 1 && lo <= s.to_m))).map(s => s.index);
  return marks.map(mark => {
    const view = views.get(mark.view_id), photo = view && photos.get(view.photo_id);
    if (!photo) return { decision: 'left out: its photo is not in the route record' };
    let ground = null, method = null;
    for (const piece of pieces) {
      const taken = pinnedPoints(piece, mark.view_id, mark.outline);
      if (taken.length >= rules.minPoints) { ground = taken.map(i => [piece.positions[3 * i], piece.positions[3 * i + 1], piece.positions[3 * i + 2]]); method = 'points'; break; }
    }
    if (!ground) {
      const camera = cameraOf(view, photo, frame, origin, piecesOf, rules, maxCorrection);
      ground = camera ? cast(mark, camera, rules) : [];
      method = camera ? 'level ground' : null;
    }
    if (!ground.length) return { method, decision: method ? `left out: it lies above the horizon or more than ${rules.maxRangeM} m from its camera` : 'left out: its direction is unknown' };
    const { along, offset } = against(ground);
    let chosen = ground;
    if (rules.edges.has(mark.concept)) chosen = offset.map((d, i) => [d, i]).sort((a, b) => a[0] - b[0]).slice(0, Math.max(5, Math.floor(offset.length / 10))).map(([, i]) => ground[i]);
    const centre = [0, 1, 2].map(j => median(chosen.map(p => p[j])));
    const [lon, lat] = frame.toGps(centre), place = against([centre]), alongM = place.along[0], offsetM = place.offset[0];
    const result = { method, ground: ground.length, along_m: alongM, offset_m: offsetM, position: [lon, lat] };
    if (offsetM > near) return { ...result, decision: `off the route: ${offsetM.toFixed(1)} m from it` };
    const within = along.filter((_, i) => offset[i] <= near).sort((a, b) => a - b);
    let [lo, hi] = within.length ? [percentile(within, 5), percentile(within, 95)] : [alongM, alongM];
    lo = Math.min(lo, alongM); hi = Math.max(hi, alongM);
    const camera = photoPose(photo, maxCorrection).position;
    const stretches = spanOf(lo, hi).filter(i => Math.min(...record.stretches[i].line.map(p => metres(camera, p))) <= rules.findingM);
    const under = spanOf(alongM, alongM);
    if (!stretches.length || !under.some(i => stretches.includes(i))) return { ...result, decision: `left out: more than ${rules.findingM} m from its photo` };
    return { ...result, span_m: [lo, hi], stretches, decision: 'near the route' };
  });
}

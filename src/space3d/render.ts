/** A small WebGL2 renderer for the 3D areas: round points with the photos' colours, the walk as a lit line, and marks as rings. */
import type { Area } from './space';
import type { Look } from './pins';

export type Vec3 = [number, number, number];
export type Camera = { target: Vec3; yaw: number; pitch: number; distance: number };
/** Something drawn at a place on the walk, as the route map draws it: a marker in its state's look, a scan mark (a small dot that
 * leaves far away), or the ring where she picked. */
export type Pin = { id: string; at: Vec3; look: Look; kind: 'marker' | 'mark' | 'pick' };

const FOV = 40 * Math.PI / 180;

function perspective(aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(FOV / 2), m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = 2 * far * near / (near - far);
  return m;
}
function lookAt(eye: Vec3, target: Vec3): Float32Array {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  const zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
  // Up is +z (north-east-up); fall back to +y when looking straight down.
  let ux = 0, uy = 0, uz = 1;
  if (Math.abs(zz) > 0.999) { ux = 0; uy = 1; uz = 0; }
  let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
  const xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
}
function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) out[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
  return out;
}
export function eyeOf(camera: Camera): Vec3 {
  const { target, yaw, pitch, distance } = camera, c = Math.cos(pitch);
  return [target[0] + distance * c * Math.sin(yaw), target[1] - distance * c * Math.cos(yaw), target[2] + distance * Math.sin(pitch)];
}
export function viewProjection(camera: Camera, aspect: number): Float32Array {
  const near = Math.max(0.05, camera.distance * 0.01), far = camera.distance * 6 + 400;
  return multiply(perspective(aspect, near, far), lookAt(eyeOf(camera), camera.target));
}
/** Screen pixels of a point, or null behind the camera. */
export function project(matrix: Float32Array, p: Vec3, width: number, height: number): [number, number] | null {
  const x = matrix[0] * p[0] + matrix[4] * p[1] + matrix[8] * p[2] + matrix[12], y = matrix[1] * p[0] + matrix[5] * p[1] + matrix[9] * p[2] + matrix[13], w = matrix[3] * p[0] + matrix[7] * p[1] + matrix[11] * p[2] + matrix[15];
  if (w <= 0.01) return null;
  return [(x / w * 0.5 + 0.5) * width, (1 - (y / w * 0.5 + 0.5)) * height];
}
/** Pixels per metre at a distance, for the canvas height. */
export const pixelsPerMetre = (height: number, distance: number) => height / (2 * Math.tan(FOV / 2) * distance);

const POINTS_VS = `#version 300 es
in vec3 a_pos; in vec3 a_col;
uniform mat4 u_matrix; uniform float u_scale; uniform float u_size; uniform float u_dpr;
uniform float u_time; uniform float u_start; uniform vec2 u_band; uniform vec3 u_eye; uniform float u_fog; uniform float u_light;
out vec4 v_col;
float hash(float n) { return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }
void main() {
  vec3 p = a_pos;
  float h = hash(float(gl_VertexID));
  float rise = clamp((p.z - u_band.x) / max(u_band.y - u_band.x, 0.001), 0.0, 1.0);
  float t = clamp((u_time - u_start - rise * 0.35 - h * 0.45) / 0.7, 0.0, 1.0);
  t = 1.0 - pow(1.0 - t, 3.0);
  p.z -= (1.0 - t) * (3.0 + h * 5.0);
  vec4 clip = u_matrix * vec4(p, 1.0);
  gl_Position = clip;
  gl_PointSize = clamp(u_size * u_scale / clip.w, 1.5 * u_dpr, 5.0 * u_dpr) * mix(0.4, 1.0, t);
  vec3 c = a_col / 255.0;
  float grey = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(grey), c, 0.82);
  c = pow(c, vec3(0.82)) * 1.06 + vec3(0.015, 0.025, 0.04);
  float fog = clamp((distance(p, u_eye) - u_fog) / (u_fog * 2.2), 0.0, 0.72);
  // On dark glass the distance fades to the glass; on a light map it fades out, and the points sit a little darker.
  c = mix(mix(c, vec3(0.085, 0.1, 0.115), fog), c * 0.86, u_light);
  c = mix(mix(vec3(0.62, 0.8, 1.0), vec3(0.2, 0.42, 0.7), u_light), c, t);
  v_col = vec4(c, t * (1.0 - u_light * fog * 0.85));
}`;
const POINTS_FS = `#version 300 es
precision mediump float;
in vec4 v_col; out vec4 o;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r = dot(d, d);
  if (r > 1.0 || v_col.a < 0.02) discard;
  float a = v_col.a * smoothstep(1.0, 0.55, r);
  o = vec4(v_col.rgb * (1.0 - 0.18 * r) * a, a);
}`;
/** The walk as a screen-space ribbon: each vertex carries its point, the neighbour it faces, a side and the distance along. */
const LINE_VS = `#version 300 es
in vec3 a_pos; in vec3 a_next; in float a_side; in float a_along;
uniform mat4 u_matrix; uniform vec2 u_viewport; uniform float u_width; uniform float u_time; uniform float u_length;
out float v_side; out float v_along;
void main() {
  vec4 a = u_matrix * vec4(a_pos, 1.0), b = u_matrix * vec4(a_next, 1.0);
  vec2 sa = a.xy / max(a.w, 0.001) * u_viewport, sb = b.xy / max(b.w, 0.001) * u_viewport;
  vec2 dir = normalize(sb - sa + vec2(1e-5, 0.0));
  vec2 normal = vec2(-dir.y, dir.x) * sign(a_side);
  a.xy += normal * u_width / u_viewport * a.w;
  gl_Position = a;
  v_side = sign(a_side); v_along = a_along;
}`;
const LINE_FS = `#version 300 es
precision mediump float;
in float v_side; in float v_along; uniform vec4 u_colour; uniform float u_reveal; uniform float u_alpha; out vec4 o;
void main() {
  if (v_along > u_reveal) discard;
  float a = u_alpha * u_colour.a;
  o = vec4(u_colour.rgb * a, a);
}`;
const PIN_VS = `#version 300 es
in vec3 a_pos; in vec4 a_fill; in vec4 a_ring; in vec4 a_glyph; in vec4 a_shape; in vec4 a_state; in vec2 a_edit;
uniform mat4 u_matrix; uniform highp float u_dpr; uniform float u_drop; uniform vec2 u_viewport;
out vec4 v_fill; out vec4 v_ring; out vec4 v_glyph; out vec4 v_shape; out vec4 v_state; out vec2 v_edit; out float v_ext;
void main() {
  vec3 p = a_pos; p.z += u_drop;
  vec4 clip = u_matrix * vec4(p, 1.0);
  // Gone from this view: it lifts 24 px and shrinks as it fades, as the map's marker does.
  clip.y += a_edit.y * 24.0 * u_dpr / u_viewport.y * 2.0 * clip.w;
  gl_Position = clip;
  // A scan mark (state z 1) shrinks with distance and is left out from far away, where the walk's markers speak for it.
  float near = abs(a_state.z - 1.0) < 0.5 ? clamp(110.0 / clip.w, 0.0, 1.25) : 1.0;
  float size = near < 0.5 || a_edit.y > 0.995 ? 0.0 : a_shape.x * near * (1.0 - 0.3 * a_edit.y);
  float r0 = size * 0.5 * (1.0 + 0.2 * a_state.x);
  float ext = max(max(r0 + a_state.w + a_state.x * 2.0, a_shape.z * 12.5), a_edit.x * 20.0) + 1.5;
  gl_PointSize = size > 0.0 ? 2.0 * ext * u_dpr : 0.0;
  v_fill = a_fill; v_ring = a_ring; v_glyph = a_glyph; v_shape = vec4(r0, a_shape.yzw); v_state = a_state; v_edit = a_edit; v_ext = ext;
}`;
/** In CSS pixels from the pin's centre, y down: the map's dot (circle or rounded square), its inner ring, glyph, white halo, the corner
 * badge of a possible barrier, and for the selected one an ink ring outside the halo. State z: 0 marker, 1 scan mark, 2 her pick. */
const PIN_FS = `#version 300 es
precision mediump float;
in vec4 v_fill; in vec4 v_ring; in vec4 v_glyph; in vec4 v_shape; in vec4 v_state; in vec2 v_edit; in float v_ext;
uniform float u_alpha; uniform highp float u_dpr; uniform vec3 u_badge; out vec4 o;
float box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float segment(vec2 p, vec2 a, vec2 b, float w) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - w * 0.5; }
vec4 over(vec4 below, vec4 above) { return above + below * (1.0 - above.a); }
float cover(float d, float aa) { return 1.0 - smoothstep(-aa, aa, d); }
void main() {
  vec2 p = (gl_PointCoord * 2.0 - 1.0) * v_ext;
  float aa = 0.75 / u_dpr, r0 = v_shape.x, gs = v_shape.w, sel = v_state.x, halo = v_state.w;
  float d = mix(length(p) - r0, box(p, vec2(r0), min(3.0, r0)), v_shape.y);
  vec4 c = vec4(0.0);
  if (v_state.z > 1.5) {
    // Her pick: a white ring with a thin ink edge.
    c = over(c, vec4(0.114, 0.129, 0.145, 1.0) * cover(abs(d) - 2.2, aa));
    c = over(c, vec4(1.0) * cover(abs(d) - 1.2, aa));
  } else {
    // Changed by her edits: a dashed ink ring with a white halo, 34 px across, a step outside the selection ring.
    if (v_edit.x > 0.01) {
      float rr = length(p) - 17.0, dash = step(0.5, fract(atan(p.y, p.x) / 6.2831853 * 14.0));
      c = over(c, vec4(1.0) * v_edit.x * cover(abs(rr) - 2.25, aa));
      c = over(c, vec4(0.114, 0.129, 0.145, 1.0) * v_edit.x * dash * cover(abs(rr) - 0.75, aa));
    }
    c = over(c, vec4(0.114, 0.129, 0.145, 1.0) * sel * cover(abs(d - halo - 0.5) - 0.5, aa));
    c = over(c, vec4(1.0) * 0.92 * cover(d - halo, aa));
    float inside = cover(d, aa);
    c = over(c, vec4(v_fill.rgb, 1.0) * v_fill.a * inside);
    c = over(c, vec4(v_ring.rgb, 1.0) * inside * (1.0 - cover(d + v_ring.w, aa)));
    float g = v_glyph.w, k = gs * 0.5 * 0.7071, gd = 1e3;
    if (g > 0.5 && g < 1.5) gd = length(p) - gs * 0.5;
    else if (g > 1.5 && g < 2.5) gd = box(p, vec2(gs * 0.5), 1.0);
    else if (g > 2.5 && g < 3.5) gd = segment(p, vec2(-k, k), vec2(k, -k), 1.5);
    else if (g > 3.5 && g < 4.5) gd = min(segment(p, vec2(-2.6, -0.2), vec2(-0.7, 1.7), 1.5), segment(p, vec2(-0.7, 1.7), vec2(3.0, -2.0), 1.5));
    else if (g > 4.5) gd = min(box(p, vec2(gs * 0.5, 0.75), 0.0), box(p, vec2(0.75, gs * 0.5), 0.0));
    c = over(c, vec4(v_glyph.rgb, 1.0) * cover(gd, aa) * inside);
    if (v_shape.z > 0.01) {
      float b = length(p - vec2(r0 + 0.5, -(r0 + 0.5))) - 3.5;
      c = over(c, vec4(1.0) * v_shape.z * cover(b - 1.5, aa));
      c = over(c, vec4(u_badge, 1.0) * v_shape.z * cover(b, aa));
    }
  }
  c *= u_alpha * (1.0 - 0.55 * v_state.y) * (1.0 - v_edit.y);
  if (c.a < 0.003) discard;
  o = c;
}`;

function shader(gl: WebGL2RenderingContext, type: number, source: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, source); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'Shader failed.');
  return s;
}
function program(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const p = gl.createProgram()!;
  gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'Program failed.');
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  return { p, u: (name: string) => uniforms.get(name) ?? uniforms.set(name, gl.getUniformLocation(p, name)).get(name)!, a: (name: string) => gl.getAttribLocation(p, name) };
}

type AreaBuffers = { id: string; vao: WebGLVertexArrayObject; n: number; low: number; high: number; start: number; buffers: WebGLBuffer[] };
export type Frame = { camera: Camera; time: number; reveal: number; pinsDrop: number; pinsAlpha: number; limit: number };

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  private points; private line; private pins;
  private areas: AreaBuffers[] = [];
  private lineVao: WebGLVertexArrayObject | null = null; private lineCount = 0; private lineBuffers: WebGLBuffer[] = [];
  private pinVao: WebGLVertexArrayObject | null = null; private pinCount = 0; private pinBuffers: WebGLBuffer[] = [];
  private lineColour: [number, number, number, number] = [0.42, 0.66, 0.98, 1];
  width = 1; height = 1; dpr = 1;
  /** Drawn over a light map rather than on dark glass. */
  light = false;
  private badge: Vec3 = [0.878, 0.565, 0.373];

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, depth: true, powerPreference: 'default' });
    if (!gl) throw new Error('WebGL2 is not available.');
    this.gl = gl;
    this.points = program(gl, POINTS_VS, POINTS_FS);
    this.line = program(gl, LINE_VS, LINE_FS);
    this.pins = program(gl, PIN_VS, PIN_FS);
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width; this.height = height; this.dpr = dpr;
    const w = Math.max(1, Math.round(width * dpr)), h = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  private buffer(data: ArrayBufferView, attribute: number, size: number, type: number, normalized = false) {
    const gl = this.gl, b = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    if (attribute >= 0) { gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, size, type, normalized, 0, 0); }
    return b;
  }

  /** start: when this area starts rising, in seconds of the assembly. */
  addArea(area: Area, start: number) {
    const gl = this.gl, vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buffers = [this.buffer(area.positions, this.points.a('a_pos'), 3, gl.FLOAT), this.buffer(area.colours, this.points.a('a_col'), 3, gl.UNSIGNED_BYTE)];
    gl.bindVertexArray(null);
    this.areas.push({ id: area.id, vao, n: area.n, low: area.low, high: area.high, start, buffers });
  }

  setLine(points: Vec3[], along: number[], rgb: Vec3) {
    const gl = this.gl;
    this.lineColour = [...rgb, 1];
    for (const b of this.lineBuffers) gl.deleteBuffer(b);
    const pos: number[] = [], next: number[] = [], side: number[] = [], dist: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      // Two triangles per segment; each vertex faces the other end of its segment.
      const quad: [Vec3, Vec3, number, number][] = [[a, b, 1, along[i]], [a, b, -1, along[i]], [b, a, -1, along[i + 1]], [a, b, 1, along[i]], [b, a, -1, along[i + 1]], [b, a, 1, along[i + 1]]];
      for (const [p, q, s, d] of quad) { pos.push(...p); next.push(...q); side.push(s); dist.push(d); }
    }
    // A vertex facing backwards flips its normal, so flip its side to keep the band whole.
    for (let i = 0; i < side.length; i++) if (i % 6 >= 2 && i % 6 !== 3) side[i] = -side[i];
    this.lineVao = gl.createVertexArray(); gl.bindVertexArray(this.lineVao);
    this.lineBuffers = [this.buffer(new Float32Array(pos), this.line.a('a_pos'), 3, gl.FLOAT), this.buffer(new Float32Array(next), this.line.a('a_next'), 3, gl.FLOAT), this.buffer(new Float32Array(side), this.line.a('a_side'), 1, gl.FLOAT), this.buffer(new Float32Array(dist), this.line.a('a_along'), 1, gl.FLOAT)];
    gl.bindVertexArray(null);
    this.lineCount = side.length;
  }

  setPins(pins: Pin[], badge: Vec3 = [0.878, 0.565, 0.373]) {
    const gl = this.gl;
    this.badge = badge;
    for (const b of this.pinBuffers) gl.deleteBuffer(b);
    if (this.pinVao) gl.deleteVertexArray(this.pinVao);
    // Marks under markers, markers under her pick, the selected marker over the others.
    const rank = (p: Pin) => p.kind === 'mark' ? 0 : p.kind === 'pick' ? 3 : p.look.selected > 0.5 ? 2 : 1;
    const ordered = [...pins].sort((a, b) => rank(a) - rank(b));
    const at = (f: (p: Pin) => number[]) => new Float32Array(ordered.flatMap(f));
    this.pinVao = gl.createVertexArray(); gl.bindVertexArray(this.pinVao);
    this.pinBuffers = [
      this.buffer(at(p => p.at), this.pins.a('a_pos'), 3, gl.FLOAT),
      this.buffer(at(p => [...p.look.fill, p.look.fillAlpha]), this.pins.a('a_fill'), 4, gl.FLOAT),
      this.buffer(at(p => [...p.look.ring, p.look.ringWidth]), this.pins.a('a_ring'), 4, gl.FLOAT),
      this.buffer(at(p => [...p.look.glyphRgb, p.look.glyph]), this.pins.a('a_glyph'), 4, gl.FLOAT),
      this.buffer(at(p => [p.look.size, p.look.square, p.look.badge, p.look.glyphSize]), this.pins.a('a_shape'), 4, gl.FLOAT),
      this.buffer(at(p => [p.look.selected, p.look.dim, p.kind === 'mark' ? 1 : p.kind === 'pick' ? 2 : 0, p.look.halo]), this.pins.a('a_state'), 4, gl.FLOAT),
      this.buffer(at(p => [p.look.changed, p.look.gone]), this.pins.a('a_edit'), 2, gl.FLOAT),
    ];
    gl.bindVertexArray(null);
    this.pinCount = ordered.length;
  }

  draw(frame: Frame) {
    const gl = this.gl, w = this.canvas.width, h = this.canvas.height, matrix = viewProjection(frame.camera, w / h), eye = eyeOf(frame.camera);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    // Points: soft edges by coverage, so they still write depth.
    gl.useProgram(this.points.p);
    gl.uniformMatrix4fv(this.points.u('u_matrix'), false, matrix);
    gl.uniform1f(this.points.u('u_scale'), pixelsPerMetre(h, 1));
    gl.uniform1f(this.points.u('u_size'), 0.17);
    gl.uniform1f(this.points.u('u_dpr'), this.dpr);
    gl.uniform1f(this.points.u('u_time'), frame.time);
    gl.uniform3fv(this.points.u('u_eye'), eye);
    gl.uniform1f(this.points.u('u_fog'), Math.max(30, frame.camera.distance * 0.9));
    gl.uniform1f(this.points.u('u_light'), this.light ? 1 : 0);
    gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    for (const area of this.areas) {
      if (frame.time < area.start - 0.05) continue;
      gl.uniform1f(this.points.u('u_start'), area.start);
      gl.uniform2f(this.points.u('u_band'), area.low, area.high);
      gl.bindVertexArray(area.vao);
      gl.drawArrays(gl.POINTS, 0, Math.min(area.n, Math.ceil(area.n * frame.limit)));
    }
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    // The walk: lit where it can be seen, and faintly through what stands in front of it.
    if (this.lineVao && frame.reveal > 0) {
      gl.useProgram(this.line.p);
      gl.uniformMatrix4fv(this.line.u('u_matrix'), false, matrix);
      gl.uniform2f(this.line.u('u_viewport'), w / 2, h / 2);
      gl.uniform4fv(this.line.u('u_colour'), this.lineColour);
      gl.uniform1f(this.line.u('u_reveal'), frame.reveal);
      gl.bindVertexArray(this.lineVao);
      gl.depthMask(false);
      gl.disable(gl.DEPTH_TEST);
      gl.uniform1f(this.line.u('u_width'), 2.2 * this.dpr); gl.uniform1f(this.line.u('u_alpha'), 0.32);
      gl.drawArrays(gl.TRIANGLES, 0, this.lineCount);
      gl.enable(gl.DEPTH_TEST);
      gl.uniform1f(this.line.u('u_width'), 2.2 * this.dpr); gl.uniform1f(this.line.u('u_alpha'), 1);
      gl.drawArrays(gl.TRIANGLES, 0, this.lineCount);
      gl.depthMask(true);
    }
    // Pins stay readable over everything, like a map's markers.
    if (this.pinVao && this.pinCount && frame.pinsAlpha > 0) {
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(this.pins.p);
      gl.uniformMatrix4fv(this.pins.u('u_matrix'), false, matrix);
      gl.uniform1f(this.pins.u('u_dpr'), this.dpr);
      gl.uniform1f(this.pins.u('u_drop'), frame.pinsDrop);
      gl.uniform1f(this.pins.u('u_alpha'), frame.pinsAlpha);
      gl.uniform3fv(this.pins.u('u_badge'), this.badge);
      gl.uniform2f(this.pins.u('u_viewport'), w, h);
      gl.bindVertexArray(this.pinVao);
      gl.drawArrays(gl.POINTS, 0, this.pinCount);
      gl.enable(gl.DEPTH_TEST);
    }
    gl.bindVertexArray(null);
    return matrix;
  }

  dispose() {
    const gl = this.gl;
    for (const area of this.areas) { area.buffers.forEach(b => gl.deleteBuffer(b)); gl.deleteVertexArray(area.vao); }
    [...this.lineBuffers, ...this.pinBuffers].forEach(b => gl.deleteBuffer(b));
    this.areas = [];
    for (const p of [this.points, this.line, this.pins]) gl.deleteProgram(p.p);
  }
}

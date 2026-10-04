import type { Seen } from './space';

type Rgb = [number, number, number];
/** The app's colour tokens, read once from the page so the canvas keeps the same meanings: blue the way, clay a possible barrier, grey unknown. */
export type Palette = { way: Rgb; barrier: Rgb; unknown: Rgb; ink: Rgb; surface: Rgb };

const FALLBACK: Palette = { way: [31, 95, 168], barrier: [166, 80, 28], unknown: [95, 99, 104], ink: [29, 33, 37], surface: [255, 255, 255] };
let cached: Palette | null = null;
function parse(value: string): Rgb | null {
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
  return hex ? [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)) as Rgb : null;
}
export function palette(): Palette {
  if (cached) return cached;
  if (typeof document === 'undefined') return FALLBACK;
  const style = getComputedStyle(document.documentElement), read = (name: string, fallback: Rgb) => parse(style.getPropertyValue(name)) ?? fallback;
  cached = { way: read('--reachable', FALLBACK.way), barrier: read('--blocked', FALLBACK.barrier), unknown: read('--unknown', FALLBACK.unknown), ink: read('--ink', FALLBACK.ink), surface: read('--surface', FALLBACK.surface) };
  return cached;
}

export const rgba = ([r, g, b]: Rgb, alpha: number) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
export const mix = (a: Rgb, b: Rgb, u: number): Rgb => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * u)) as Rgb;

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Progress through a window of time, 0 before it and 1 after it. */
export const within = (now: number, from: number, span: number) => clamp01((now - from) / span);
export const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
export const easeInOut = (u: number) => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
export const sway = (u: number) => (1 - Math.cos(Math.PI * u)) / 2;
/** Overshoots a little and settles, for something arriving. */
export const arrive = (u: number) => { const c = 1.4; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };

export function line(ctx: CanvasRenderingContext2D, points: readonly (Seen | number[])[], colour: string, width: number, cap: CanvasLineCap = 'round') {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.lineCap = cap; ctx.lineJoin = 'round';
  ctx.stroke();
}
export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, colour: string) {
  if (radius <= 0.05) return;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = colour; ctx.fill();
}
/** A ring lying on the ground: a circle flattened by the lean. */
export function ring(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, squash: number, colour: string, width: number) {
  if (radius <= 0.05) return;
  ctx.beginPath(); ctx.ellipse(x, y, radius, Math.max(0.05, radius * squash), 0, 0, Math.PI * 2);
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke();
}
/** A soft round light. */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, core: string, edge: string) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, core); gradient.addColorStop(1, edge);
  ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

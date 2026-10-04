/** How a marker looks in 3D: the route map's marker (map.css) state for state, drawn by the pin shader, and eased between states as the map eases them. */
import type { Marker } from '../destinations/RouteMap';

export type Rgb = [number, number, number];
/** glyph: 0 none, 1 dot, 2 square, 3 slash, 4 check, 5 plus. Sizes in CSS pixels. */
export type Look = {
  size: number; fill: Rgb; fillAlpha: number; ring: Rgb; ringWidth: number; halo: number;
  glyph: number; glyphRgb: Rgb; glyphSize: number; square: number; badge: number; selected: number; dim: number; rank: number;
};

const css = (name: string, fallback: string) => (typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;
export function rgbOf(colour: string): Rgb {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour.trim());
  if (hex) { const h = hex[1].length === 3 ? [...hex[1]].map(c => c + c).join('') : hex[1], n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  const rgb = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(colour);
  return rgb ? [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255] : [0.6, 0.6, 0.6];
}
const token = (name: string, fallback: string) => rgbOf(css(name, fallback));
const WHITE: Rgb = [1, 1, 1], CHARCOAL: Rgb = [0.114, 0.129, 0.145];

/** The map's marker for a state, as map.css draws it: a dot with a ring and a glyph; a possible barrier is dark with its kind's ring and a corner badge. */
export function lookOf(marker: Pick<Marker, 'state' | 'selected' | 'rank' | 'kind'>, others: boolean): Look {
  const kind = marker.kind ? css(`--mark-${marker.kind}`, '') : '';
  const base: Look = { size: 14, fill: WHITE, fillAlpha: 0.78, ring: token('--blocked', '#a6501c'), ringWidth: 1.5, halo: 1, glyph: 1, glyphRgb: token('--blocked', '#a6501c'), glyphSize: 5, square: 0, badge: 0, selected: 0, dim: 0, rank: 0 };
  let look: Look;
  switch (marker.state) {
    case 'open': case 'barrier': case 'added': {
      const ring = kind ? rgbOf(kind) : rgbOf('#f2f3f4');
      look = { ...base, fill: CHARCOAL, fillAlpha: 1, ring, glyphRgb: ring, halo: 1.5, badge: 1, square: marker.state === 'open' ? 0 : 1, glyph: marker.state === 'barrier' ? 2 : marker.state === 'added' ? 5 : 1, glyphSize: marker.state === 'barrier' ? 6 : marker.state === 'added' ? 7 : 5 };
      break;
    }
    case 'not-barrier': look = { ...base, size: 12, ring: token('--unknown', '#5f6368'), glyph: 0 }; break;
    case 'no-photos': look = { ...base, size: 13, ring: token('--unknown', '#5f6368'), glyphRgb: token('--unknown', '#5f6368'), glyph: 3, glyphSize: 9 }; break;
    case 'fixed': look = { ...base, ring: token('--reachable', '#1f5fa8'), glyphRgb: token('--reachable', '#1f5fa8'), glyph: 4, glyphSize: 7, square: 1 }; break;
    case 'clear': look = { ...base, ring: token('--reachable', '#1f5fa8'), glyphRgb: token('--reachable', '#1f5fa8') }; break;
    case 'osm': { const glyphRgb = kind ? rgbOf(kind) : rgbOf('#e8eaec'); look = { ...base, size: 18, fill: CHARCOAL, fillAlpha: 0.6, ringWidth: 0, ring: glyphRgb, glyphRgb, halo: 1 }; break; }
    case 'landmark': look = { ...base, size: 11, ring: token('--ink', '#1d2125'), glyphRgb: token('--ink', '#1d2125'), ringWidth: 1, glyphSize: 4 }; break;
    default: look = base;
  }
  // A suggested spot is a white disc with an ink ring; the one she opened is larger, with an ink ring outside a white halo.
  if (marker.rank) look = { ...look, size: 22, fill: WHITE, fillAlpha: 0.88, ring: token('--ink', '#1d2125'), ringWidth: 1.5, glyph: 0, badge: 0, square: 0, rank: 1, halo: 4 };
  if (marker.selected) look = { ...look, selected: 1, ringWidth: Math.max(look.ringWidth, 2), halo: 3 };
  else if (others) look = { ...look, dim: 1 };
  return look;
}

const NUMBERS = ['size', 'fillAlpha', 'ringWidth', 'halo', 'glyphSize', 'square', 'badge', 'selected', 'dim', 'rank'] as const;
const COLOURS = ['fill', 'ring', 'glyphRgb'] as const;
const mix = (a: Look, b: Look, k: number): Look => {
  const out = { ...b } as Look;
  for (const key of NUMBERS) out[key] = a[key] + (b[key] - a[key]) * k;
  for (const key of COLOURS) out[key] = a[key].map((v, i) => v + (b[key][i] - v) * k) as Rgb;
  // A glyph cannot blend: it changes halfway, as the dot dips and returns.
  out.glyph = k < 0.5 ? a.glyph : b.glyph;
  if (a.glyph !== b.glyph) out.size *= 1 - 0.18 * Math.sin(Math.PI * k);
  return out;
};

/** Eases each pin from the look it had to the look it has, over the map's marker transition (160 ms, ease out). */
export class Tweens {
  private from = new Map<string, { look: Look; at: number }>();
  private shown = new Map<string, Look>();
  constructor(private length = 160) {}
  /** Sets each pin's look; a pin whose look changed eases there from what it showed. */
  set(looks: Map<string, Look>, now: number, instant: boolean) {
    for (const [id, look] of looks) {
      const was = this.now(id, now);
      if (!instant && was && JSON.stringify(was) !== JSON.stringify(look)) this.from.set(id, { look: was, at: now });
      else this.from.delete(id);
      this.shown.set(id, look);
    }
    for (const id of [...this.shown.keys()]) if (!looks.has(id)) { this.shown.delete(id); this.from.delete(id); }
  }
  /** The look a pin shows at this moment. */
  now(id: string, now: number): Look | undefined {
    const to = this.shown.get(id), from = this.from.get(id);
    if (!to) return undefined;
    if (!from) return to;
    const t = Math.min(1, (now - from.at) / this.length);
    if (t >= 1) { this.from.delete(id); return to; }
    return mix(from.look, to, 1 - Math.pow(1 - t, 3));
  }
  get moving() { return this.from.size > 0; }
}

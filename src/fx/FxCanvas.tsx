import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Project } from './space';
import './fx.css';

/** Where the map is on this canvas right now, how much a circle on its ground flattens, and its pixels per route-frame unit. */
export type Space = { project: Project; squash: number; scale: number };
export type FxFrame = Space & { ctx: CanvasRenderingContext2D; width: number; height: number; now: number };
/** Draws one frame of an effect: true while it needs every frame, a number of milliseconds when its next frame can wait that long, false once it holds still. */
export type Effect = (frame: FxFrame) => boolean | number;

/** Pixel density cap: effects are soft light and thin lines, and three times the pixels costs a phone more than it shows. */
const DENSITY = 2;

export const quiet = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * One canvas over a map, the size of its container, for every effect. It repaints whenever its host renders and runs frames
 * only while an effect is moving, at the slowest rate the moving effects allow, so a still map costs nothing.
 */
export default function FxCanvas({ space, effects, className = '' }: { space: (canvas: HTMLCanvasElement) => Space | null; effects: readonly Effect[]; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ space, effects });
  latest.current = { space, effects };
  const frame = useRef(0), timer = useRef(0);
  const stop = () => { cancelAnimationFrame(frame.current); clearTimeout(timer.current); };
  const paint = useRef(() => {});
  paint.current = () => {
    frame.current = 0;
    const element = canvas.current, context = element?.getContext('2d');
    if (!element || !context) return;
    const width = element.clientWidth, height = element.clientHeight, density = Math.min(DENSITY, devicePixelRatio || 1);
    const w = Math.round(width * density), h = Math.round(height * density);
    if (element.width !== w || element.height !== h) { element.width = w; element.height = h; }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, w, h);
    const where = width && height ? latest.current.space(element) : null;
    if (!where) return;
    context.setTransform(density, 0, 0, density, 0, 0);
    const now = performance.now();
    let wait = Infinity;
    for (const effect of latest.current.effects) { const next = effect({ ...where, ctx: context, width, height, now }); if (next === true) wait = 0; else if (typeof next === 'number') wait = Math.min(wait, next); }
    if (wait === 0) frame.current = requestAnimationFrame(() => paint.current());
    else if (wait < Infinity) timer.current = window.setTimeout(() => { frame.current = requestAnimationFrame(() => paint.current()); }, wait);
  };
  useLayoutEffect(() => { stop(); paint.current(); });
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const observer = new ResizeObserver(() => { stop(); paint.current(); });
    observer.observe(element);
    return () => { observer.disconnect(); stop(); };
  }, []);
  return <canvas ref={canvas} className={`fx-canvas ${className}`} aria-hidden="true"/>;
}

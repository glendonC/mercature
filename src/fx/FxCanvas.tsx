import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Project } from './space';
import './fx.css';

/** Where the map is on this canvas right now, how much a circle on its ground flattens, and its pixels per route-frame unit. */
export type Space = { project: Project; squash: number; scale: number };
export type FxFrame = Space & { ctx: CanvasRenderingContext2D; width: number; height: number; now: number };
/** Draws one frame of an effect; returns true while it still needs frames. */
export type Effect = (frame: FxFrame) => boolean;

/** Pixel density cap: effects are soft light and thin lines, and three times the pixels costs a phone more than it shows. */
const DENSITY = 2;

export const quiet = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * One canvas over a map, the size of its container, for every effect. It repaints whenever its host renders and runs frames
 * only while an effect is moving, so a still map costs nothing.
 */
export default function FxCanvas({ space, effects, className = '' }: { space: (canvas: HTMLCanvasElement) => Space | null; effects: readonly Effect[]; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ space, effects });
  latest.current = { space, effects };
  const frame = useRef(0);
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
    let more = false;
    for (const effect of latest.current.effects) more = effect({ ...where, ctx: context, width, height, now }) || more;
    if (more) frame.current = requestAnimationFrame(() => paint.current());
  };
  useLayoutEffect(() => { cancelAnimationFrame(frame.current); paint.current(); });
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame.current); paint.current(); });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame.current); };
  }, []);
  return <canvas ref={canvas} className={`fx-canvas ${className}`} aria-hidden="true"/>;
}

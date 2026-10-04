import { useMemo, type RefObject } from 'react';
import type { Destination } from '../destinations/data';
import type { Lens } from '../destinations/lens';
import type { Walk } from '../destinations/walk';
import FxCanvas, { type Space } from './FxCanvas';
import { build, type Beats } from './build';
import { fxScene, type Mark } from './scene';
import { spaceOf } from './space';

/** Distance of the eye from a flat map, in pixels: a point lifted off a flat map comes toward the viewer. */
const EYE = 900;

/** A flat map's frame on this canvas, read from its view box as laid out now. */
export function flatSpace(svg: SVGSVGElement, canvas: HTMLElement): Space | null {
  const m = svg.getScreenCTM();
  if (!m) return null;
  const box = canvas.getBoundingClientRect(), cx = box.width / 2, cy = box.height / 2;
  return {
    squash: 1,
    scale: Math.hypot(m.a, m.b),
    project: (p, lift = 0) => {
      const x = m.a * p[0] + m.c * p[1] + m.e - box.left, y = m.b * p[0] + m.d * p[1] + m.f - box.top, s = EYE / (EYE - Math.min(lift, EYE * 0.9));
      return [cx + (x - cx) * s, cy + (y - cy) * s, s];
    },
  };
}

type Props = {
  data: Destination;
  walk: Walk;
  /** Every recorded mark; without them, the findings the place data keeps. */
  marks?: readonly Mark[];
  beats: Beats;
  /** The end state at once: after a skip, with reduced motion, or once the replay hands off. */
  done: boolean;
  /** The leaning map's projection, as the route map reports it; the layer sits in the same box. */
  lens?: Lens | null;
  /** Or a flat map's svg. */
  svg?: RefObject<SVGSVGElement | null>;
  className?: string;
};

/** The build replay over a map, drawn from the record: mount it right after the map, in the same box, and give it the beats. */
export default function RevealFx({ data, walk, marks, beats, done, lens, svg, className }: Props) {
  const scene = useMemo(() => fxScene(data, walk, marks), [data, walk, marks]);
  const effects = useMemo(() => [build(scene, beats, done)], [scene, beats, done]);
  const space = useMemo(() => lens ? spaceOf(lens) : null, [lens]);
  return <FxCanvas className={className} effects={effects} space={canvas => space ?? (svg?.current ? flatSpace(svg.current, canvas) : null)}/>;
}

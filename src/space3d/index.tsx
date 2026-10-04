/** The 3D built from a walk's street photos, for the screens that show it: loaded on first use, with a Photo or 3D switch. */
import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import type { Destination } from '../destinations/data';
import type { Marker } from '../destinations/RouteMap';
import type { ScanMark } from '../destinations/data';
import { useLanguage } from '../i18n';
import { Segmented } from '../ui';
import { loadSpace, spaceBase, type Space } from './space';
import './space3d.css';
import type { Space3DProps } from './Space3D';

export type { Space3DProps } from './Space3D';
/** The 3D view, fetched with its renderer only when a screen first shows it. */
export const Space3D = lazy(() => import('./Space3D'));

let gl: boolean | null = null;
/** Whether this browser can draw the 3D at all. */
export function canDraw3D(): boolean {
  if (gl === null) { try { gl = !!document.createElement('canvas').getContext('webgl2'); } catch { gl = false; } }
  return gl;
}

const spaces = new Map<string, Promise<Space | null>>(), known = new Map<string, Space | null>();
/** What is known of a place's 3D right now: null when it has none or this browser cannot draw it, undefined while it loads. */
function knownSpace(data: Destination | null): Space | null | undefined {
  if (!data) return undefined;
  if (!spaceBase(data) || !canDraw3D()) return null;
  return known.has(data.id) ? known.get(data.id) : undefined;
}
/**
 * The place's published 3D; null when it has none or this browser cannot draw it, undefined while that is not known yet.
 * Once known it is there on a component's first render, so a remounted screen draws the same at once.
 */
export function useSpace(data: Destination | null): Space | null | undefined {
  const [space, setSpace] = useState(() => knownSpace(data));
  useEffect(() => {
    const now = knownSpace(data);
    setSpace(now);
    if (now !== undefined || !data) return;
    let live = true;
    if (!spaces.has(data.id)) spaces.set(data.id, loadSpace(data).catch(() => null).then(found => { known.set(data.id, found); return found; }));
    void spaces.get(data.id)!.then(found => { if (live) setSpace(found); });
    return () => { live = false; };
  }, [data]);
  return space;
}

/** Whether the 3D shows any of these stretches of the walk. */
export const covers = (space: Space | null | undefined, stretches: readonly number[]) => !!space && space.pieces.some(piece => piece.stretches.some(index => stretches.includes(index)));

const WORDS = { en: { photo: 'Photo', space: '3D', choose: 'Show the photo or the 3D' }, es: { photo: 'Foto', space: '3D', choose: 'Mostrar la foto o el 3D' } } as const;
const choices = new Map<string, 'photo' | 'space'>();

/**
 * The photo of a spot, with a switch to the 3D of the same stretches when the 3D covers them.
 * Without 3D there, or without WebGL2, it is the photo alone, unchanged.
 */
export function PhotoOr3D({ data, stretches, children, markers, onMarker, onMark, onPick, height, className, orbit = true }: {
  data: Destination; stretches: readonly number[]; children: ReactNode;
  markers?: Marker[]; onMarker?: (id: string) => void; onMark?: (mark: ScanMark) => void;
  /** A tap in the 3D, or Enter on a marker there: the place on the map, and the spot whose marker is within reach. */
  onPick?: Space3DProps['onPick'];
  /** The 3D's height in pixels, to match the photo's; 4:3 when left out. */
  height?: number; className?: string;
  /** Let the 3D circle its area while she leaves it alone. */
  orbit?: boolean;
}) {
  const { lang } = useLanguage(), words = WORDS[lang === 'es' ? 'es' : 'en'];
  const space = useSpace(data), here = covers(space, stretches);
  // The choice is kept per spot outside the component, so a screen that remounts it keeps what she chose.
  const key = `${data.id}:${stretches.join(',')}`, shown = choices.get(key) ?? 'photo';
  const [, redraw] = useState(0);
  const setShown = (value: 'photo' | 'space') => { choices.set(key, value); redraw(n => n + 1); };
  const [broken, setBroken] = useState(false);
  if (!here || broken) return <>{children}</>;
  const props: Space3DProps = { data, markers, onMarker, onMark, onPick, orbit, focus: [...stretches], onUnavailable: () => { setBroken(true); setShown('photo'); } };
  return <div className={['space3d-switch', className].filter(Boolean).join(' ')}>
    <Segmented label={words.choose} value={shown} onChange={setShown} options={[{ value: 'photo', label: words.photo }, { value: 'space', label: words.space }]} />
    {shown === 'photo' ? children : <div className="space3d-frame" style={height ? { height } : undefined}><Suspense fallback={<div className="space3d space3d-pane" />}><Space3D {...props} className="space3d-pane" /></Suspense></div>}
  </div>;
}

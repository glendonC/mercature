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

const spaces = new Map<string, Promise<Space | null>>();
/** The place's published 3D, or null while it loads, when it has none, or when this browser cannot draw it. */
export function useSpace(data: Destination | null): Space | null {
  const [space, setSpace] = useState<Space | null>(null);
  useEffect(() => {
    setSpace(null);
    if (!data || !spaceBase(data) || !canDraw3D()) return;
    let live = true;
    if (!spaces.has(data.id)) spaces.set(data.id, loadSpace(data).catch(() => null));
    void spaces.get(data.id)!.then(found => { if (live) setSpace(found); });
    return () => { live = false; };
  }, [data]);
  return space;
}

/** Whether the 3D shows any of these stretches of the walk. */
export const covers = (space: Space | null, stretches: readonly number[]) => !!space && space.pieces.some(piece => piece.stretches.some(index => stretches.includes(index)));

const WORDS = { en: { photo: 'Photo', space: '3D', choose: 'Show the photo or the 3D' }, es: { photo: 'Foto', space: '3D', choose: 'Mostrar la foto o el 3D' } } as const;

/**
 * The photo of a spot, with a switch to the 3D of the same stretches when the 3D covers them.
 * Without 3D there, or without WebGL2, it is the photo alone, unchanged.
 */
export function PhotoOr3D({ data, stretches, children, markers, onMarker, onMark, className }: {
  data: Destination; stretches: readonly number[]; children: ReactNode;
  markers?: Marker[]; onMarker?: (id: string) => void; onMark?: (mark: ScanMark) => void; className?: string;
}) {
  const { lang } = useLanguage(), words = WORDS[lang === 'es' ? 'es' : 'en'];
  const space = useSpace(data), here = covers(space, stretches);
  const [shown, setShown] = useState<'photo' | 'space'>('photo');
  const [broken, setBroken] = useState(false);
  const key = stretches.join(',');
  useEffect(() => setShown('photo'), [key]);
  if (!here || broken) return <>{children}</>;
  const props: Space3DProps = { data, markers, onMarker, onMark, focus: [...stretches], onUnavailable: () => { setBroken(true); setShown('photo'); } };
  return <div className={['space3d-switch', className].filter(Boolean).join(' ')}>
    <Segmented label={words.choose} value={shown} onChange={setShown} options={[{ value: 'photo', label: words.photo }, { value: 'space', label: words.space }]} />
    {shown === 'photo' ? children : <Suspense fallback={<div className="space3d space3d-pane" />}><Space3D {...props} className="space3d-pane" /></Suspense>}
  </div>;
}

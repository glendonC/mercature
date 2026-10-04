import { useEffect, useMemo, useRef, useState } from 'react';
import { assetUrl, type Destination } from '../destinations/data';
import type { Lens, Tilt } from '../destinations/lens';
import type { Point, Walk } from '../destinations/walk';
import type { Changed } from './changes';
import FxCanvas, { quiet, type Effect } from './FxCanvas';
import { camera, columns, flow, meaning, ping, pulse, sawStretches, unglow, type Shot } from './route';
import { fxScene } from './scene';
import { spaceOf } from './space';

/** The ring where she fixed or added a spot: wider and stronger than a hover's, as long. An added spot's starts as its marker comes down. */
const EDIT_RING = { spread: 640, reach: 30, strength: 0.7 }, LANDS = 160;

type FxMarker = { id: string; at: Point; state: string; selected: boolean };
type Props = {
  data: Destination;
  walk: Walk;
  /** The map's live projection, and the tilt it is drawn with when known. */
  lens: Lens | null;
  tilt?: Tilt;
  markers: readonly FxMarker[];
  /** The marker under the pointer: one ring as it is reached. */
  hover?: string | null;
  /** The open photo's view, drawn as a camera where it was taken. */
  photoView?: string;
  /** Markers an edit has just changed, from useChanges: a ring where she fixes or adds a spot, and the clay glow fading where a spot stops being a possible barrier. */
  changes?: ReadonlyMap<string, Changed>;
};

/** The route canvas's motion, over its map: mount it inside the map's box, after the map, before its words and markers. */
export default function RouteFx({ data, walk, lens, tilt, markers, hover = null, photoView = '', changes }: Props) {
  const scene = useMemo(() => fxScene(data, walk), [data, walk]);
  const still = useMemo(quiet, []);
  const at = (id: string | null) => markers.find(marker => marker.id === id) ?? null;

  const flowing = useMemo(() => flow(scene, still), [scene, still]);

  const selected = markers.find(marker => marker.selected) ?? null;
  const pinged = useMemo(() => {
    const spot = selected && walk.spots.find(item => item.id === selected.id);
    return spot && selected && !still ? ping(scene, selected.at, sawStretches(scene, data, spot.stretches), performance.now()) : null;
  // A new selection pings once; markers moving on screen do not.
  }, [selected?.id, scene, data, walk, still]);

  const hovered = at(hover);
  const pulsed = useMemo(() => hovered && !still ? pulse(hovered.at, meaning(hovered.state), performance.now()) : null, [hover, still]);

  // The open photo: where it was taken, which way it faced, and its light across its width once the image is read.
  const shots = useRef(new Map<string, Shot>());
  const [, setRead] = useState(0);
  const shot = useMemo(() => {
    if (!photoView) return null;
    const known = shots.current.get(photoView);
    if (known) return known;
    const view = data.views.find(item => item.id === photoView), photo = view && data.photos.find(item => item.id === view.photoId);
    const heading = view?.heading ?? photo?.heading;
    if (!view || !photo || heading == null) return null;
    const made: Shot = { id: photoView, at: walk.project(photo.position), heading, colours: null };
    const image = new Image();
    image.onload = () => { made.colours = columns(image); setRead(n => n + 1); };
    image.src = assetUrl(data, view.file);
    shots.current.set(photoView, made);
    return made;
  }, [photoView, data, walk]);
  const last = useRef<Shot | null>(null);
  const filmed = useMemo(() => {
    if (!shot) { last.current = null; return null; }
    const from = last.current && last.current !== shot && !still ? last.current : null;
    last.current = shot;
    return camera(shot, from, still ? -Infinity : performance.now());
  }, [shot, still]);
  useEffect(() => { if (!photoView) last.current = null; }, [photoView]);

  // Her edits: each change draws once, from the moment it was made.
  const edited = useMemo(() => !changes || still ? [] : [...changes].flatMap(([id, { change, at: made }]) => {
    const marker = at(id), spot = walk.spots.find(item => item.id === id);
    if (!marker) return [];
    const fading = spot && (change === 'fixed' || change === 'removed') ? [unglow(spot.path, made)] : [];
    if (change === 'fixed') return [...fading, pulse(marker.at, 'way', made, EDIT_RING)];
    if (change === 'added') return [pulse(marker.at, 'barrier', made + LANDS, EDIT_RING)];
    return fading;
  // A marker's place on the map is fixed; only a new change draws anew.
  }), [changes, still, walk]); // eslint-disable-line react-hooks/exhaustive-deps

  const effects = useMemo(() => [flowing, filmed, ...edited, pinged, pulsed].filter((effect): effect is Effect => !!effect), [flowing, filmed, edited, pinged, pulsed]);
  const space = useMemo(() => lens ? spaceOf(lens, tilt) : null, [lens, tilt]);
  return <FxCanvas effects={effects} space={() => space}/>;
}

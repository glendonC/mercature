import { useEffect, useMemo, useRef, useState } from 'react';
import { assetUrl, type Destination } from '../destinations/data';
import type { Lens, Tilt } from '../destinations/lens';
import type { Point, Walk } from '../destinations/walk';
import type { Changed } from './changes';
import FxCanvas, { quiet, type Effect } from './FxCanvas';
import { beam, camera, columns, flow, meaning, ping, pulse, sawStretches, unglow, type Shot } from './route';
import { fxScene } from './scene';
import { spaceOf } from './space';

/** After landing, the light waits for the lean and the spots to arrive; after Whole route, for the camera to settle. */
const FLOW_AFTER_LANDING = 1500, FLOW_AFTER_FIT = 520;
/** The ring where she fixed or added a spot: wider and stronger than a hover's, as long. An added spot's starts as its marker comes down. */
const EDIT_RING = { spread: 640, reach: 30, strength: 0.7 }, LANDS = 160;

type FxMarker = { id: string; at: Point; state: string; selected: boolean };
type Props = {
  data: Destination;
  walk: Walk;
  /** The map's live projection, and the tilt it is drawn with when known. */
  lens: Lens | null;
  tilt?: Tilt;
  /** The map has landed and leans: the light runs along the walk once. */
  landed: boolean;
  /** Raised each time the whole route is shown again: the light runs once more. */
  replay?: number;
  markers: readonly FxMarker[];
  /** The spot to draw the eye to: the one the open message is about, or the one under the pointer. */
  focus?: string | null;
  /** The marker under the pointer: one ring as it is reached. */
  hover?: string | null;
  /** The open photo's view, drawn as a camera where it was taken. */
  photoView?: string;
  /** Markers an edit has just changed, from useChanges: a ring where she fixes or adds a spot, and the clay glow fading where a spot stops being a possible barrier. */
  changes?: ReadonlyMap<string, Changed>;
};

/** The route canvas's motion, over its map: mount it inside the map's box, after the map, before its words and markers. */
export default function RouteFx({ data, walk, lens, tilt, landed, replay = 0, markers, focus = null, hover = null, photoView = '', changes }: Props) {
  const scene = useMemo(() => fxScene(data, walk), [data, walk]);
  const still = useMemo(quiet, []);
  const at = (id: string | null) => markers.find(marker => marker.id === id) ?? null;

  const ran = useMemo(() => landed && !still ? flow(scene, performance.now() + (replay ? FLOW_AFTER_FIT : FLOW_AFTER_LANDING)) : null, [scene, landed, replay, still]);

  const selected = markers.find(marker => marker.selected) ?? null;
  const pinged = useMemo(() => {
    const spot = selected && walk.spots.find(item => item.id === selected.id);
    return spot && selected && !still ? ping(scene, selected.at, sawStretches(scene, data, spot.stretches), performance.now()) : null;
  // A new selection pings once; markers moving on screen do not.
  }, [selected?.id, scene, data, walk, still]);

  const focused = at(focus), focusState = focused?.state ?? '';
  const beamed = useMemo(() => focused ? beam(focused.at, meaning(focusState), performance.now(), still) : null, [focus, focusState, still, focused?.at[0], focused?.at[1]]);
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
    const made: Shot = { id: photoView, at: walk.project(photo.position), heading, colours: null, image: null };
    const image = new Image();
    image.onload = () => { made.image = image; made.colours = columns(image); setRead(n => n + 1); };
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

  const effects = useMemo(() => [filmed, ran, ...edited, pinged, beamed, pulsed].filter((effect): effect is Effect => !!effect), [filmed, ran, edited, pinged, beamed, pulsed]);
  const space = useMemo(() => lens ? spaceOf(lens, tilt) : null, [lens, tilt]);
  return <FxCanvas effects={effects} space={() => space}/>;
}

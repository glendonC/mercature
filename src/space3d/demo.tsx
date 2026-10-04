// A page for looking at the 3D view on its own in the dev server: /src/space3d/demo.html?intro=1&settle=1&focus=34&still&place=tbilisi-narikala
// The walk's spots show as the map's markers; State turns every marker to the next state, so the 3D's easing can be seen.
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../style.css';
import { isDestinationId, loadDestination, type Destination } from '../destinations/data';
import { spotMarkers } from '../destinations/markers';
import type { Marker, MarkerState } from '../destinations/RouteMap';
import { buildWalk } from '../destinations/walk';
import Space3D from './Space3D';

const query = new URLSearchParams(location.search);
const STATES: MarkerState[] = ['open', 'barrier', 'fixed', 'not-barrier', 'added', 'osm'];
function Demo() {
  const [data, setData] = useState<Destination | null>(null);
  const [said, setSaid] = useState('');
  const [replay, setReplay] = useState(0);
  const [turn, setTurn] = useState(0);
  const [selected, setSelected] = useState<string | null>(query.get('select'));
  const [before, setBefore] = useState(false);
  useEffect(() => { const place = query.get('place') ?? ''; loadDestination(isDestinationId(place) ? place : 'cusco-qorikancha').then(setData, error => setSaid(String(error))); }, []);
  const focus = query.get('focus')?.split(',').map(Number) ?? null, areas = query.get('areas')?.split(',') ?? null;
  const walk = useMemo(() => data ? buildWalk(data) : null, [data]);
  // Before shows the walk as recorded; Now adds a spot of her own beside the steps at 340 m and rings the steps as changed.
  const markers = useMemo<Marker[]>(() => {
    if (!walk) return [];
    const list: Marker[] = spotMarkers(walk, null).map(m => ({ ...m, kind: m.state === 'open' ? 'steps' : undefined, state: turn ? STATES[(Math.max(0, STATES.indexOf(m.state)) + turn) % STATES.length] : m.state, selected: m.id === selected, changed: !before && m.id === 'stretch-34' }));
    const steps = list.find(m => m.id === 'stretch-34');
    if (steps) list.push({ id: 'added-1', at: [steps.at[0] + 3, steps.at[1] + 2], state: 'added', kind: 'kerb', label: 'Her added spot', selected: selected === 'added-1', gone: before });
    return list;
  }, [walk, turn, selected, before]);
  return <main style={{ position: 'fixed', inset: 0, display: 'grid', gridTemplateRows: '1fr auto', background: 'var(--paper)' }}>
    {data && <Space3D key={replay} data={data} markers={markers} focus={focus} areas={areas} from={query.get('from') ?? undefined} intro={query.has('intro')} orbit={!query.has('still')} settle={query.has('settle')}
      onMarker={id => { setSelected(id); setSaid(`marker ${id}`); }} onMark={mark => setSaid(`mark ${mark.id} ${mark.label}`)} onIntroEnd={() => setSaid('intro ended')} onUnavailable={reason => setSaid(`unavailable: ${reason}`)}
      onPick={pick => setSaid(`pick ${pick.lonLat.map(v => v.toFixed(7)).join(', ')}${pick.spotId ? ` spot ${pick.spotId}` : ''}`)} />}
    <p style={{ margin: 0, padding: 8, font: '13px Outfit, system-ui' }}><span id="said">{said || 'ready'}</span> <button onClick={() => setReplay(n => n + 1)}>Replay</button> <button onClick={() => setTurn(n => n + 1)}>State</button> <button onClick={() => setBefore(b => !b)}>{before ? 'Now' : 'Before'}</button></p>
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Demo /></StrictMode>);

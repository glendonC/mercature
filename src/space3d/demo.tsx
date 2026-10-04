// A page for looking at the 3D view on its own in the dev server: /src/space3d/demo.html?intro=1&settle=1&focus=8,9&piece=s01
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../style.css';
import { loadDestination, type Destination } from '../destinations/data';
import Space3D from './Space3D';

const query = new URLSearchParams(location.search);
function Demo() {
  const [data, setData] = useState<Destination | null>(null);
  const [said, setSaid] = useState('');
  const [replay, setReplay] = useState(0);
  useEffect(() => { loadDestination('cusco-qorikancha').then(setData, error => setSaid(String(error))); }, []);
  const focus = query.get('focus')?.split(',').map(Number) ?? null, areas = query.get('areas')?.split(',') ?? null;
  return <main style={{ position: 'fixed', inset: 0, display: 'grid', gridTemplateRows: '1fr auto', background: 'var(--paper)' }}>
    {data && <Space3D key={replay} data={data} focus={focus} areas={areas} from={query.get('from') ?? undefined} intro={query.has('intro')} orbit={!query.has('still')} settle={query.has('settle')}
      onMarker={id => setSaid(`marker ${id}`)} onMark={mark => setSaid(`mark ${mark.id} ${mark.label}`)} onIntroEnd={() => setSaid('intro ended')} onUnavailable={reason => setSaid(`unavailable: ${reason}`)} />}
    <p style={{ margin: 0, padding: 8, font: '13px Outfit, system-ui' }} id="said">{said || 'ready'} <button onClick={() => setReplay(n => n + 1)}>Replay</button></p>
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Demo /></StrictMode>);

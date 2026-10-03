import { covers } from '../home/Home';
import { BackIcon } from '../icons';
import { DESTINATIONS, type DestinationId } from '../destinations/data';

const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];

/** Shown where a recorded place cannot be read: its cover, its credit and where it can be explored. */
export default function RecordedPreview({ id, onHome, onOpen, onRetry }: { id: DestinationId; onHome: () => void; onOpen: (id: DestinationId) => void; onRetry: () => void }) {
  const cover = covers.find(item => item.id === id);
  const local = LOOPBACK.includes(location.hostname);
  return <main className="recorded-preview" aria-label={`${DESTINATIONS[id].name}, recorded example`}>
    <button className="recorded-preview-back" onClick={onHome} aria-label="Home"><BackIcon/></button>
    <section className="recorded-preview-card">
      {cover && <figure><span className="recorded-preview-frame"><img src={cover.image} alt={`${cover.name}, ${cover.area}`}/></span>
        <figcaption>Cover: <a href={cover.source} target="_blank" rel="noreferrer">{cover.author}, {cover.year}</a>, <a href={cover.licenseUrl} target="_blank" rel="noreferrer">{cover.license}</a></figcaption></figure>}
      <div className="recorded-preview-text">
        <span className="badge">Recorded</span>
        <h1>{DESTINATIONS[id].name}</h1>
        <p className="recorded-preview-place">{DESTINATIONS[id].place}</p>
        <p>Recorded example, available in a local install.</p>
        <div className="recorded-preview-actions">
          {id !== 'cusco-qorikancha' && <button className="primary" onClick={() => onOpen('cusco-qorikancha')}>See Qorikancha</button>}
          <button onClick={onHome}>Back</button>
          {local && <button className="quiet" onClick={onRetry}>Try again</button>}
        </div>
      </div>
    </section>
  </main>;
}

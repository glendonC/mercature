import { useEffect, useRef, useState } from 'react';
import Companion from '../components/Companion';
import { putEvidence, readEvidence, savePlace, validateBoundary, type Place, type Evidence } from './store';
import './places.css';

function PhotoOutline({ small = false }: { small?: boolean }) {
  return <svg className={small ? 'photo-outline small' : 'photo-outline'} viewBox="0 0 120 100" fill="none" aria-hidden="true"><rect x="11" y="14" width="91" height="69" rx="8" stroke="currentColor" strokeWidth="1.5"/><path d="m12 68 25-25 21 20 16-15 28 26" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="79" cy="34" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M23 89h79a7 7 0 0 0 7-7V27" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function useEvidenceURL(evidence: Evidence) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let objectURL = '';
    setUrl(''); setError('');
    readEvidence(evidence.id).then(blob => {
      if (!blob) throw new Error('This file is missing from this browser. Add it again.');
      objectURL = URL.createObjectURL(blob);
      if (active) setUrl(objectURL); else URL.revokeObjectURL(objectURL);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not open this local file.'); });
    return () => { active = false; if (objectURL) URL.revokeObjectURL(objectURL); };
  }, [evidence.id]);
  return { url, error, setError };
}
function EvidencePreview({ evidence }: { evidence: Evidence }) {
  const { url, error, setError } = useEvidenceURL(evidence);
  const previewFailed = () => setError('This file is saved, but this browser cannot preview it. Try another photo or video.');
  return <figure className="place-photo">
    <div className="place-photo-frame">{error ? <p role="alert">{error}</p> : url ? evidence.type.startsWith('video/')
      ? <video src={url} controls playsInline preload="metadata" onError={previewFailed} />
      : <img src={url} alt={evidence.name} onError={previewFailed} />
      : <p role="status">Opening your file…</p>}</div>
    <figcaption>{evidence.name}</figcaption>
  </figure>;
}
function Thumbnail({ evidence, selected, onSelect }: { evidence: Evidence; selected: boolean; onSelect: () => void }) {
  const { url, error, setError } = useEvidenceURL(evidence);
  return <button className="place-thumbnail" aria-label={`View ${evidence.name}`} aria-pressed={selected} onClick={onSelect}>
    {url && !error && evidence.type.startsWith('image/') ? <img src={url} alt="" loading="lazy" onError={() => setError('Preview unavailable')} /> : evidence.type.startsWith('video/') ? <span aria-hidden="true">▷</span> : <PhotoOutline small />}
  </button>;
}
const boundaryFields = ['west', 'south', 'east', 'north'] as const;
const boundaryDraft = (place: Place) => ({ west: place.boundary?.west.toString() ?? '', south: place.boundary?.south.toString() ?? '', east: place.boundary?.east.toString() ?? '', north: place.boundary?.north.toString() ?? '' });

export default function PlaceWorkspace({ initial, onHome, onSaved }: { initial: Place; onHome: () => void; onSaved: (place: Place) => void }) {
  const [place, setPlace] = useState(initial);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState(initial.notes);
  const [boundary, setBoundary] = useState(boundaryDraft(initial));
  const [detailError, setDetailError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const details = useRef<HTMLDialogElement>(null);
  const current = place.evidence.find(item => item.id === selected) ?? place.evidence[0];

  function openDetails() {
    setNotes(place.notes); setBoundary(boundaryDraft(place)); setDetailError('');
    details.current?.showModal();
  }
  function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    try {
      let bounds = null;
      if (Object.values(boundary).some(value => value.trim())) {
        if (Object.values(boundary).some(value => !value.trim())) throw new Error('Enter all four coordinates, or leave them all blank.');
        bounds = { west: Number(boundary.west), south: Number(boundary.south), east: Number(boundary.east), north: Number(boundary.north) };
        validateBoundary(bounds);
      }
      const next = { ...place, notes, boundary: bounds };
      savePlace(next); setPlace(next); onSaved(next);
      setError(''); setStatus('Details saved on this device.'); details.current?.close();
    } catch (e) { setDetailError(e instanceof Error ? e.message : 'Could not save these details.'); }
  }
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setError(''); setStatus('Saving on this device…');
    let saved = 0;
    try {
      let next = place;
      for (const file of Array.from(files)) {
        if (next.evidence.length >= 100) throw new Error('This place has reached its 100-file limit.');
        const item = await putEvidence(file);
        next = { ...next, evidence: [...next.evidence, item] };
        savePlace(next); setPlace(next); onSaved(next); setSelected(item.id); saved++;
      }
      setStatus(`${saved} file${saved === 1 ? '' : 's'} saved on this device.`);
    } catch (e) {
      setStatus(saved ? `${saved} file${saved === 1 ? '' : 's'} saved on this device.` : '');
      setError(e instanceof Error ? e.message : 'Could not add this file.');
    } finally { setBusy(false); if (picker.current) picker.current.value = ''; }
  }
  const addButton = <button className="place-add" disabled={busy} onClick={() => picker.current?.click()}>{busy ? 'Saving files…' : 'Add photos or video'}</button>;

  return <main className={`place-workspace${current ? ' has-evidence' : ''}`}>
    <header className="place-header">
      <button className="place-quiet-button" onClick={onHome} disabled={busy}>← Home</button>
      <h1>{place.name}</h1>
      <button className="place-quiet-button" onClick={openDetails} disabled={busy}>Details</button>
    </header>
    <input hidden type="file" ref={picker} multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" aria-label="Photos or video" onChange={event => void addFiles(event.target.files)} />
    {current ? <section className="place-viewer" aria-label="Your place photos">
      <EvidencePreview key={current.id} evidence={current} />
      <div className="place-photo-tools">
        <div className="place-thumbnails" aria-label="Saved views">{place.evidence.map(item => <Thumbnail key={item.id} evidence={item} selected={current.id === item.id} onSelect={() => setSelected(item.id)} />)}</div>
        {addButton}
      </div>
      <p className="place-local-caption">Files stay on this device · Add only files you may keep</p>
    </section> : <section className="place-invitation">
      <PhotoOutline />
      <h2>Show your place</h2>
      <p>Add a few views of the entrance.</p>
      {addButton}
      <span className="place-local-caption">Files stay on this device · Add only files you may keep</span>
    </section>}
    <footer className="place-guide"><Companion>{current ? 'Add another angle of the entrance.' : 'Start with a clear view from outside.'}</Companion>
      <div className="place-notices" aria-live="polite">{status && <p role="status">{status}</p>}{error && <p role="alert" className="place-error">{error}</p>}</div>
    </footer>
    <dialog className="place-details" ref={details} aria-labelledby="place-details-title">
      <form onSubmit={saveDetails}>
        <div className="place-details-header"><h2 id="place-details-title">Place details</h2><button type="button" className="place-quiet-button" aria-label="Close details" onClick={() => details.current?.close()}>×</button></div>
        <label className="place-notes-label">Area and measurement notes<textarea value={notes} maxLength={20000} onChange={event => setNotes(event.target.value)} placeholder="Anything to remember about this entrance?" rows={4} /></label>
        <details className="place-boundary"><summary>Geographic boundary <span>Optional</span></summary><p>Coordinates describe the area; they do not measure it.</p><div className="place-coordinate-fields">{boundaryFields.map(field => <label key={field}>{field[0].toUpperCase() + field.slice(1)}<input type="number" step="any" value={boundary[field]} onChange={event => setBoundary({ ...boundary, [field]: event.target.value })} /></label>)}</div></details>
        <p className="place-detail-note">{place.evidence.length} saved view{place.evidence.length === 1 ? '' : 's'} · Up to 20 MB per file<br />Photos are for review. Measured-site analysis is not available yet.</p>
        {detailError && <p role="alert" className="place-error">{detailError}</p>}
        <div className="place-details-actions"><button type="button" className="place-quiet-button" onClick={() => details.current?.close()}>Cancel</button><button className="place-add" type="submit">Save details</button></div>
      </form>
    </dialog>
  </main>;
}

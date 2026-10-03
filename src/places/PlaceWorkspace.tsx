import { useEffect, useRef, useState } from 'react';
import Companion from '../components/Companion';
import { putEvidence, readEvidence, savePlace, validateBoundary, type Place, type Evidence } from './store';
import { useLanguage } from '../i18n';
import './places.css';

function PhotoOutline({ small = false }: { small?: boolean }) {
  return <svg className={small ? 'photo-outline small' : 'photo-outline'} viewBox="0 0 120 100" fill="none" aria-hidden="true"><rect x="11" y="14" width="91" height="69" rx="8" stroke="currentColor" strokeWidth="1.5"/><path d="m12 68 25-25 21 20 16-15 28 26" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="79" cy="34" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M23 89h79a7 7 0 0 0 7-7V27" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function useEvidenceURL(evidence: Evidence) {
  const { t } = useLanguage();
  const missing = useRef(''), unreadable = useRef('');
  missing.current = t('error.fileMissing'); unreadable.current = t('error.fileUnreadable');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let objectURL = '';
    setUrl(''); setError('');
    readEvidence(evidence.id).then(blob => {
      if (!blob) throw new Error(missing.current);
      objectURL = URL.createObjectURL(blob);
      if (active) setUrl(objectURL); else URL.revokeObjectURL(objectURL);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : unreadable.current); });
    return () => { active = false; if (objectURL) URL.revokeObjectURL(objectURL); };
  }, [evidence.id]);
  return { url, error, setError };
}
function EvidencePreview({ evidence }: { evidence: Evidence }) {
  const { url, error, setError } = useEvidenceURL(evidence);
  const { t } = useLanguage();
  const previewFailed = () => setError(t('error.preview'));
  return <figure className="place-photo">
    <div className="place-photo-frame">{error ? <p role="alert">{error}</p> : url ? evidence.type.startsWith('video/')
      ? <video src={url} controls playsInline preload="metadata" onError={previewFailed} />
      : <img src={url} alt={evidence.name} onError={previewFailed} />
      : <p role="status">{t('place.opening')}</p>}</div>
    <figcaption>{evidence.name}</figcaption>
  </figure>;
}
function Thumbnail({ evidence, selected, onSelect }: { evidence: Evidence; selected: boolean; onSelect: () => void }) {
  const { url, error, setError } = useEvidenceURL(evidence);
  const { t } = useLanguage();
  return <button className="place-thumbnail" aria-label={t('place.view', { name: evidence.name })} aria-pressed={selected} onClick={onSelect}>
    {url && !error && evidence.type.startsWith('image/') ? <img src={url} alt="" loading="lazy" onError={() => setError(t('error.previewShort'))} /> : evidence.type.startsWith('video/') ? <span aria-hidden="true">▷</span> : <PhotoOutline small />}
  </button>;
}
const boundaryFields = ['west', 'south', 'east', 'north'] as const;
const boundaryDraft = (place: Place) => ({ west: place.boundary?.west.toString() ?? '', south: place.boundary?.south.toString() ?? '', east: place.boundary?.east.toString() ?? '', north: place.boundary?.north.toString() ?? '' });

export default function PlaceWorkspace({ initial, onHome, onSaved }: { initial: Place; onHome: () => void; onSaved: (place: Place) => void }) {
  const { t } = useLanguage();
  const [place, setPlace] = useState(initial);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState(initial.name);
  const [notes, setNotes] = useState(initial.notes);
  const [boundary, setBoundary] = useState(boundaryDraft(initial));
  const [detailError, setDetailError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const details = useRef<HTMLDialogElement>(null);
  const current = place.evidence.find(item => item.id === selected) ?? place.evidence[0];

  function openDetails() {
    setName(place.name); setNotes(place.notes); setBoundary(boundaryDraft(place)); setDetailError('');
    details.current?.showModal();
  }
  function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    try {
      let bounds = null;
      if (Object.values(boundary).some(value => value.trim())) {
        if (Object.values(boundary).some(value => !value.trim())) throw new Error(t('error.allCoordinates'));
        bounds = { west: Number(boundary.west), south: Number(boundary.south), east: Number(boundary.east), north: Number(boundary.north) };
        validateBoundary(bounds);
      }
      if (!name.trim()) throw new Error(t('error.placeName'));
      const next = { ...place, name: name.trim(), notes, boundary: bounds };
      savePlace(next); setPlace(next); onSaved(next);
      setError(''); setStatus(t('place.saved')); details.current?.close();
    } catch (e) { setDetailError(e instanceof Error ? e.message : t('error.saveDetails')); }
  }
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setError(''); setStatus(t('place.saving'));
    let saved = 0;
    try {
      let next = place;
      for (const file of Array.from(files)) {
        if (next.evidence.length >= 100) throw new Error(t('error.fileLimit'));
        const item = await putEvidence(file);
        next = { ...next, evidence: [...next.evidence, item] };
        savePlace(next); setPlace(next); onSaved(next); setSelected(item.id); saved++;
      }
      setStatus(t(saved === 1 ? 'place.filesSaved' : 'place.filesSavedMany', { count: saved }));
    } catch (e) {
      setStatus(saved ? t(saved === 1 ? 'place.filesSaved' : 'place.filesSavedMany', { count: saved }) : '');
      setError(e instanceof Error ? e.message : t('error.addFile'));
    } finally { setBusy(false); if (picker.current) picker.current.value = ''; }
  }
  const addButton = <button className="place-add" disabled={busy} onClick={() => picker.current?.click()}>{t(busy ? 'place.savingFiles' : 'place.add')}</button>;

  return <main className={`place-workspace${current ? ' has-evidence' : ''}`}>
    <header className="place-header">
      <button className="place-quiet-button" onClick={onHome} disabled={busy}>{t('place.homeButton')}</button>
      <h1>{place.name}</h1>
      <button className="place-quiet-button" onClick={openDetails} disabled={busy}>{t('common.details')}</button>
    </header>
    <input hidden type="file" ref={picker} multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" aria-label={t('place.input')} onChange={event => void addFiles(event.target.files)} />
    {current ? <section className="place-viewer" aria-label={t('place.photos')}>
      <EvidencePreview key={current.id} evidence={current} />
      <div className="place-photo-tools">
        <div className="place-thumbnails" aria-label={t('place.savedViews')}>{place.evidence.map(item => <Thumbnail key={item.id} evidence={item} selected={current.id === item.id} onSelect={() => setSelected(item.id)} />)}</div>
        {addButton}
      </div>
      <p className="place-local-caption">{t('place.local')}</p>
    </section> : <section className="place-invitation">
      <PhotoOutline />
      <h2>{t('place.show')}</h2>
      <p>{t('place.entrance')}</p>
      {addButton}
      <span className="place-local-caption">{t('place.local')}</span>
    </section>}
    <footer className="place-guide"><Companion working={busy} tone={place.evidence.length?'evidence':'guide'}>{t(current ? 'place.guide.another' : 'place.guide.start')}</Companion>
      <div className="place-notices" aria-live="polite">{status && <p role="status">{status}</p>}{error && <p role="alert" className="place-error">{error}</p>}</div>
    </footer>
    <dialog className="place-details" ref={details} aria-labelledby="place-details-title">
      <form onSubmit={saveDetails}>
        <div className="place-details-header"><h2 id="place-details-title">{t('place.details')}</h2><button type="button" className="place-quiet-button" aria-label={t('place.closeDetails')} onClick={() => details.current?.close()}>×</button></div>
        <label className="place-notes-label">{t('place.name')}<input value={name} maxLength={120} onChange={event => setName(event.target.value)} /></label>
        <label className="place-notes-label">{t('place.notes')}<textarea value={notes} maxLength={20000} onChange={event => setNotes(event.target.value)} placeholder={t('place.notesPlaceholder')} rows={4} /></label>
        <details className="place-boundary"><summary>{t('place.boundary')} <span>{t('place.optional')}</span></summary><p>{t('place.boundaryNote')}</p><div className="place-coordinate-fields">{boundaryFields.map(field => <label key={field}>{t(`place.${field}`)}<input type="number" step="any" value={boundary[field]} onChange={event => setBoundary({ ...boundary, [field]: event.target.value })} /></label>)}</div></details>
        <p className="place-detail-note">{t(place.evidence.length === 1 ? 'place.savedView' : 'place.savedViewsCount', { count: place.evidence.length })}{t('place.perFile')}<br />{t('place.review')}</p>
        {detailError && <p role="alert" className="place-error">{detailError}</p>}
        <div className="place-details-actions"><button type="button" className="place-quiet-button" onClick={() => details.current?.close()}>{t('common.cancel')}</button><button className="place-add" type="submit">{t('place.saveDetails')}</button></div>
      </form>
    </dialog>
  </main>;
}

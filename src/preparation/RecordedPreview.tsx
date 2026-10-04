import { covers } from '../home/Home';
import { BackIcon } from '../icons';
import { DESTINATIONS, type DestinationId } from '../destinations/data';
import { useLanguage } from '../i18n';
import { fromRecord } from '../i18n/records';

/** Shown only if a place that was offered fails to open: its cover, its credit and somewhere to go next. */
export default function RecordedPreview({ id, onHome, onOpen, onRetry }: { id: DestinationId; onHome: () => void; onOpen: (id: DestinationId) => void; onRetry: () => void }) {
  const { t, rich, lang } = useLanguage();
  const cover = covers.find(item => item.id === id);
  return <main className="recorded-preview" aria-label={DESTINATIONS[id].name}>
    <button className="recorded-preview-back" onClick={onHome} aria-label={t('common.home')}><BackIcon/></button>
    <section className="recorded-preview-card">
      {cover && <figure><span className="recorded-preview-frame"><img src={cover.image} alt={`${cover.name}, ${cover.area}`}/></span>
        <figcaption>{rich('recorded.cover', { credit: <a href={cover.source} target="_blank" rel="noreferrer">{cover.author}, {cover.year}</a>, license: <a href={cover.licenseUrl} target="_blank" rel="noreferrer">{cover.license}</a> })}</figcaption></figure>}
      <div className="recorded-preview-text">
        <h1>{DESTINATIONS[id].name}</h1>
        <p className="recorded-preview-place">{fromRecord(DESTINATIONS[id].place, lang)}</p>
        <div className="recorded-preview-actions">
          {id !== 'cusco-qorikancha' && <button className="primary" onClick={() => onOpen('cusco-qorikancha')}>{t('recorded.explore', { name: DESTINATIONS['cusco-qorikancha'].name })}</button>}
          <button onClick={onRetry}>{t('common.tryAgain')}</button>
          <button className="quiet" onClick={onHome}>{t('common.back')}</button>
        </div>
      </div>
    </section>
  </main>;
}

import { useEffect, useMemo, useState } from 'react';
import { isDestinationId, loadDestination, type Destination, type DestinationId } from '../destinations/data';
import { useLanguage, type Lang } from '../i18n';
import { fromRecord } from '../i18n/records';
import { IconButton, Panel, PanelHead, Segmented, TextButton } from '../ui';
import { BackIcon, ChevronIcon, iconFor, PhotoIcon, RotateIcon } from '../ui/icons';
import { LabelledPhoto } from './LabelledPhoto';
import { photoOf, type MarkAnswer } from './marks';
import './demo.css';

const HERO: DestinationId = 'cusco-qorikancha';
const placeOf = (): DestinationId => { const wanted = new URLSearchParams(location.search).get('place') ?? ''; return isDestinationId(wanted) ? wanted : HERO; };
const StepIcon = ({ kind }: { kind: string }) => { const Icon = iconFor(kind) ?? PhotoIcon; return <Icon />; };

/** ?ui=photo: the labelled photo at the sizes the guide gives it, over a tour route's shipped views (the hero, or ?place=). ?view= opens one view, ?select=none clears the selection. */
export default function PhotoDemo() {
  const { lang, setLang } = useLanguage();
  const [data, setData] = useState<Destination | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { const controller = new AbortController(); loadDestination(placeOf(), controller.signal).then(setData, (e: Error) => { if (!controller.signal.aborted) setError(e.message); }); return () => controller.abort(); }, []);
  // Views with a possible barrier first, then by how much the model marked on them.
  const views = useMemo(() => {
    if (!data) return [];
    const marked = (id: string) => photoOf(data, id)?.marks ?? [];
    return [...data.views].sort((a, b) => Number(marked(b.id).some(m => m.flagged)) - Number(marked(a.id).some(m => m.flagged)) || marked(b.id).length - marked(a.id).length);
  }, [data]);
  const [at, setAt] = useState(() => 0);
  useEffect(() => { const wanted = new URLSearchParams(location.search).get('view'); const index = views.findIndex(v => v.id === wanted); if (index >= 0) setAt(index); }, [views]);
  const shown = useMemo(() => data && views[at] ? photoOf(data, views[at].id) : null, [data, views, at]);
  const findings = useMemo(() => shown?.marks.filter(m => m.finding) ?? [], [shown]);
  const [selected, setSelected] = useState<string | null>(null);
  // ?select=none opens with nothing selected.
  useEffect(() => setSelected(new URLSearchParams(location.search).get('select') === 'none' ? null : findings.find(m => m.flagged)?.id ?? findings[0]?.id ?? null), [findings]);
  const [replay, setReplay] = useState(0);
  // Before and Now: Now gives the findings on this photo her answers in turn, as the guide's toggle would.
  const [now, setNow] = useState(() => new URLSearchParams(location.search).get('answers') === 'now');
  const answers = useMemo(() => {
    const cycle: MarkAnswer[] = ['fixed', 'not-barrier', 'still-there'];
    return Object.fromEntries(findings.map((m, i) => [m.id, cycle[i % cycle.length]]));
  }, [findings]);
  const [traced, setTraced] = useState(false);
  if (error) return <main className="pd"><p role="alert">{error}</p></main>;
  if (!data || !shown) return <main className="pd" aria-busy="true" />;
  const picked = shown.marks.find(m => m.id === selected);
  const step = (by: number) => { setAt((at + by + views.length) % views.length); setTraced(false); };

  return <main className="pd">
    <header className="pd-bar">
      <span className="pd-brand">mercature</span>
      <div className="pd-pager">
        <IconButton label="Previous view" onClick={() => step(-1)}><BackIcon size={16} /></IconButton>
        <span>{at + 1} / {views.length}</span>
        <IconButton label="Next view" onClick={() => step(1)}><ChevronIcon size={16} /></IconButton>
      </div>
      <Segmented label="Language" value={lang} onChange={(next: Lang) => setLang(next)} options={[{ value: 'en', label: 'EN' }, { value: 'es', label: 'ES', lang: 'es' }]} />
    </header>
    <div className="pd-grid">
      <Panel className="pd-phone" aria-label="Phone sheet">
        <PanelHead as="h2" title="Phone sheet" meta="358 × 240, cover" />
        <LabelledPhoto {...shown} height={240} fit="cover" selected={selected} onSelect={setSelected} />
      </Panel>
      <Panel className="pd-guide" aria-label="Guide panel">
        <PanelHead as="h2" title="Guide panel" meta={picked ? fromRecord(picked.label, lang) : '352 px'}
          actions={<Segmented label="Answers" value={now ? 'now' : 'before'} onChange={(next: string) => setNow(next === 'now')} options={[{ value: 'before', label: 'Before' }, { value: 'now', label: 'Now' }]} />} />
        <LabelledPhoto {...shown} selected={selected} onSelect={setSelected} answers={now ? answers : undefined} review={now ? { state: 'checked', at: '2026-10-04' } : undefined} />
        <div className="pd-steps">{findings.map(m => <TextButton key={m.id} icon={<StepIcon kind={m.concept} />} muted={m.id !== selected} onClick={() => setSelected(m.id)}>{fromRecord(m.label, lang)}</TextButton>)}</div>
      </Panel>
      <Panel className="pd-trace" aria-label="Trace">
        <PanelHead as="h2" title="Trace" meta={traced ? 'Traced' : 'Tracing'} actions={<TextButton icon={<RotateIcon />} onClick={() => { setTraced(false); setReplay(n => n + 1); }}>Replay</TextButton>} />
        <LabelledPhoto key={`${shown.view.id}-${replay}`} {...shown} mode="trace" zoomable={false} fit="cover" height={264} credit="overlay" onTraced={() => setTraced(true)} />
      </Panel>
      <Panel className="pd-bare" aria-label="Not read">
        <PanelHead as="h2" title="Not read" meta="A street photo with no marks" />
        <LabelledPhoto {...shown} marks={[]} />
      </Panel>
      <Panel className="pd-wide" aria-label="Whole view">
        <PanelHead as="h2" title="Whole view" meta={`${shown.marks.length} marks · ${shown.view.id}`} />
        <LabelledPhoto {...shown} selected={selected} onSelect={setSelected} frameSelected={false} />
      </Panel>
    </div>
  </main>;
}

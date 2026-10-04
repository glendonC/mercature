import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLanguage } from '../i18n';
import { IconButton, List, Panel, PanelHead, Row, TextButton } from '../ui';
import { BackIcon, ChevronIcon, CloseIcon, PhotoIcon, PinIcon, RotateIcon } from '../ui/icons';
import type { Built } from '../search/build';
import { matchPrepared, type Prepared } from '../search/prepared';
import { buildWalk, type Step } from '../search/run';
import { findPlaces, SearchTrouble, type Found, type Trouble } from '../search/services';
import { saveWalk } from '../search/store';
import './search.css';

const STEPS: readonly Step[] = ['walk', 'map', 'stretches'];
const fold = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const troubleOf = (error: unknown): Trouble => error instanceof SearchTrouble ? error.kind : 'failed';

function SearchIcon() {
  return <svg className="ui-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></svg>;
}

/** What one search asked and what came back: nothing yet, an answer, or a plain reason there is none. */
type Asked = { words: string; found: Found[] | null; trouble: Trouble | null };
type Stage = { kind: 'find' } | { kind: 'start'; target: Found } | { kind: 'build'; target: Found; start: Found; step: Step | null; trouble: Trouble | null };

/**
 * Home's search. Typing filters the places prepared here at once, offline. Enter or the button asks OpenStreetMap once.
 * A place with no prepared walk takes a start, then builds a map-only walk on this device and opens it.
 */
export default function Search({ prepared, onPrepared, onWalk }: { prepared: readonly Prepared[]; onPrepared: (id: string) => void; onWalk: (built: Built, kept: boolean) => void }) {
  const { t, lang } = useLanguage();
  const [words, setWords] = useState('');
  const [asked, setAsked] = useState<Asked | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'find' });
  const [startWords, setStartWords] = useState('');
  const [startAsked, setStartAsked] = useState<Asked | null>(null);
  const [asking, setAsking] = useState(false);
  const field = useRef<HTMLInputElement>(null), startField = useRef<HTMLInputElement>(null);
  const work = useRef<AbortController | null>(null);
  useEffect(() => () => work.current?.abort(), []);
  useEffect(() => { if (stage.kind === 'start') startField.current?.focus(); }, [stage.kind]);

  const matches = useMemo(() => matchPrepared(words, prepared), [words, prepared]);
  const names = useMemo(() => prepared.map(place => fold(place.name)), [prepared]);
  /** OpenStreetMap's answers, without the places already prepared here, which lead the list. */
  const others = (asked?.found ?? []).filter(found => !names.some(name => fold(found.name).includes(name)));

  function begin() { work.current?.abort(); work.current = new AbortController(); return work.current.signal; }
  async function ask(text: string, near: Found | null) {
    const clean = text.trim();
    if (!clean) return;
    const set = near ? setStartAsked : setAsked, signal = begin();
    set({ words: clean, found: null, trouble: null }); setAsking(true);
    try { set({ words: clean, found: await findPlaces(clean, { lang, near: near?.position, signal }), trouble: null }); }
    catch (error) { if (!signal.aborted) set({ words: clean, found: null, trouble: troubleOf(error) }); }
    finally { if (!signal.aborted) setAsking(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (words.trim() && words.trim() !== asked?.words) void ask(words, null);
  }
  function submitStart(event: FormEvent) {
    event.preventDefault();
    if (stage.kind === 'start' && startWords.trim() && startWords.trim() !== startAsked?.words) void ask(startWords, stage.target);
  }
  async function build(target: Found, start: Found) {
    const signal = begin();
    setStage({ kind: 'build', target, start, step: null, trouble: null });
    try {
      const built = await buildWalk({ name: start.name, position: start.position, osm: start.osm }, { name: target.name, position: target.position, osm: target.osm }, target.area || target.detail,
        step => { if (!signal.aborted) setStage(now => now.kind === 'build' ? { ...now, step } : now); }, signal);
      if (signal.aborted) return;
      onWalk(built, await saveWalk(built));
    } catch (error) {
      if (!signal.aborted) setStage(now => now.kind === 'build' ? { ...now, trouble: troubleOf(error) } : now);
    }
  }
  function clear() {
    work.current?.abort(); setAsking(false);
    setWords(''); setAsked(null); setStage({ kind: 'find' }); setStartWords(''); setStartAsked(null);
    field.current?.focus();
  }
  function back() { work.current?.abort(); setAsking(false); setStage({ kind: 'find' }); setStartWords(''); setStartAsked(null); }

  const troubleText = (trouble: Trouble, about = '') => trouble === 'none' ? t('search.none', { words: about }) : t(({ offline: 'search.offline', busy: 'search.busy', 'no-walk': 'search.noWalk', 'too-long': 'search.tooLong', failed: 'search.failed' } as const)[trouble]);
  const status = (current: Asked | null) => {
    if (!current) return null;
    if (current.trouble) return <p className="home-search-line" role="alert">{troubleText(current.trouble)}</p>;
    if (!current.found) return <p className="home-search-line" role="status">{t('search.asking')}</p>;
    return null;
  };
  // The label leads, so a narrow screen never cuts it off; a start is near the place already, so its street says more than its town.
  const foundRow = (found: Found, onClick: () => void, mapOnly = true) => <Row key={found.id} icon={<PinIcon />} label={found.name}
    detail={mapOnly ? [t('search.mapOnly'), found.area || found.detail].filter(Boolean).join(' · ') : found.detail} onClick={onClick} />;

  let panel = null;
  if (stage.kind === 'find' && words.trim()) {
    const none = asked && asked.words === words.trim() && asked.found && !others.length && !matches.length;
    panel = <>
      {(matches.length > 0 || others.length > 0) && <List label={t('search.results')}>
        {matches.map(place => <Row key={place.id} icon={<PhotoIcon />} label={place.name} detail={`${t('search.photosRead')} · ${place.area}`} onClick={() => onPrepared(place.id)} />)}
        {others.map(found => foundRow(found, () => { setStage({ kind: 'start', target: found }); setStartWords(''); setStartAsked(null); }))}
      </List>}
      {none ? <p className="home-search-line" role="status">{t('search.none', { words: asked.words })}</p> : status(asked)}
    </>;
  } else if (stage.kind === 'start') {
    panel = <>
      <PanelHead title={t('search.walkTo', { name: stage.target.name })} meta={t('search.mapOnlyLong')} leading={<IconButton label={t('search.back')} onClick={back}><BackIcon /></IconButton>} />
      <form className="home-search-start" role="search" onSubmit={submitStart}>
        <label className="home-search-label" htmlFor="home-search-start">{t('search.start')}</label>
        <div className="home-search-field">
          <SearchIcon />
          <input id="home-search-start" ref={startField} value={startWords} onChange={event => setStartWords(event.target.value)} placeholder={t('search.startHint', { name: stage.target.name })}
            enterKeyHint="search" autoComplete="off" spellCheck={false} />
          <IconButton type="submit" label={t('search.go')} className="home-search-go"><ChevronIcon /></IconButton>
        </div>
      </form>
      {startAsked?.found && <List label={t('search.start')}>{startAsked.found.map(found => foundRow(found, () => void build(stage.target, found), false))}</List>}
      {startAsked?.found && !startAsked.found.length ? <p className="home-search-line" role="status">{t('search.none', { words: startAsked.words })}</p> : status(startAsked)}
    </>;
  } else if (stage.kind === 'build') {
    const now = stage.step ? STEPS.indexOf(stage.step) : -1;
    panel = <>
      <PanelHead title={t('search.walkTo', { name: stage.target.name })} meta={t('search.mapOnlyLong')} leading={<IconButton label={t('search.back')} onClick={back}><BackIcon /></IconButton>} />
      <ol className="home-search-steps" aria-live="polite">
        {STEPS.map((step, i) => <li key={step} data-state={i < now ? 'done' : i === now ? (stage.trouble ? 'stopped' : 'now') : 'later'}>
          {t(({ walk: 'search.stepWalk', map: 'search.stepMap', stretches: 'search.stepStretches' } as const)[step])}
        </li>)}
      </ol>
      {stage.trouble && <div className="home-search-trouble" role="alert">
        <p className="home-search-line">{troubleText(stage.trouble)}</p>
        <TextButton icon={<RotateIcon />} onClick={() => void build(stage.target, stage.start)}>{t('search.tryAgain')}</TextButton>
      </div>}
    </>;
  }

  return <div className="home-search" onKeyDown={event => { if (event.key === 'Escape' && (words || stage.kind !== 'find')) { event.stopPropagation(); clear(); } }}>
    <form role="search" onSubmit={submit} aria-label={t('search.label')}>
      <div className="home-search-field" data-tone="dark">
        <SearchIcon />
        <input ref={field} value={words} onChange={event => { setWords(event.target.value); if (stage.kind !== 'find') back(); }} placeholder={t('search.label')} aria-label={t('search.label')}
          enterKeyHint="search" autoComplete="off" spellCheck={false} />
        {words && <IconButton label={t('search.clear')} onClick={clear}><CloseIcon size={16} /></IconButton>}
        <IconButton type="submit" label={t('search.go')} className="home-search-go" aria-busy={asking || undefined}><ChevronIcon /></IconButton>
      </div>
    </form>
    <p className="home-search-note">{t('search.online')}</p>
    {panel && <Panel size="card" scroll className="home-search-panel" aria-label={t('search.results')}>{panel}</Panel>}
  </div>;
}

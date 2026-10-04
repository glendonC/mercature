import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLanguage } from '../i18n';
import { SCRIPT } from '../guide/script';
import { IconButton, List, Panel, PanelHead, Row, Section } from '../ui';
import { BackIcon, CloseIcon, PhotoIcon, PinIcon, RotateIcon } from '../ui/icons';
import type { Built } from '../search/build';
import { SEARCH_LINES } from '../search/lines';
import { matchPrepared, type Prepared } from '../search/prepared';
import { readWalk, routeWalk } from '../search/run';
import { findPlaces, SearchTrouble, type Found, type Trouble } from '../search/services';
import type { SavedWalk } from '../search/store';
import './search.css';

const fold = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const troubleOf = (error: unknown): Trouble => error instanceof SearchTrouble ? error.kind : 'failed';

function SearchIcon() {
  return <svg className="ui-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></svg>;
}

/** What the guide says at the bottom of Home; working shows its typing dots in place of the words' end. */
export type GuideLine = { text: string; working?: boolean };
/** What one search asked and what came back. */
type Asked = { words: string; found: Found[] | null; trouble: Trouble | null };
type Stage = { kind: 'find' } | { kind: 'build'; target: Found; trouble: Trouble | null } | { kind: 'start'; target: Found; from: string };
/** A tour route just built, offered again with another start. */
export type Again = { target: Found; from: string };

/**
 * Home's search. Typing filters the places prepared here at once, offline. Enter or the round button asks OpenStreetMap once.
 * One tap on any other place builds a map-only route to it on this device, from a start picked nearby, and opens it as soon as
 * the way on foot is known; what OpenStreetMap says along it is added when it arrives. A route just built can take another start from here.
 */
export default function Search({ prepared, onPrepared, onWalk, onLine, onPreview, again, recent = [], onRecent, onForget }: {
  prepared: readonly Prepared[];
  onPrepared: (id: string) => void;
  /** The route on foot, opened at once; rest brings it with what OpenStreetMap says along it. */
  onWalk: (built: Built, rest: Promise<Built>, target: Found) => void;
  onLine: (line: GuideLine | null) => void;
  onPreview: (built: Built | null) => void;
  again?: Again | null;
  /** Routes built on this device, newest first, offered while the field is focused and empty. */
  recent?: readonly SavedWalk[];
  onRecent?: (id: string) => void;
  onForget?: (id: string) => void;
}) {
  const { t, lang } = useLanguage();
  const say = SEARCH_LINES[lang];
  const [words, setWords] = useState('');
  const [asked, setAsked] = useState<Asked | null>(null);
  const [stage, setStage] = useState<Stage>(() => again ? { kind: 'start', ...again } : { kind: 'find' });
  const [startWords, setStartWords] = useState('');
  const [startFound, setStartFound] = useState<Found[] | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const card = useRef<HTMLElement>(null);
  const [focused, setFocused] = useState(false);
  const work = useRef<AbortController | null>(null);
  useEffect(() => () => { work.current?.abort(); onLine(null); onPreview(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const matches = useMemo(() => matchPrepared(words, prepared), [words, prepared]);
  const names = useMemo(() => prepared.map(place => fold(place.name)), [prepared]);
  const clean = words.trim();
  const current = asked && asked.words === clean ? asked : null;
  /** OpenStreetMap's answers, without the places already prepared here, which lead the list. */
  const others = (current?.found ?? []).filter(found => !names.some(name => fold(found.name).includes(name)));

  function begin() { work.current?.abort(); work.current = new AbortController(); return work.current.signal; }
  const troubleLine = (trouble: Trouble): GuideLine => ({ text: ({ offline: say.offline, busy: say.busy, 'no-walk': say.noWalk, 'too-long': say.noWalk, none: say.none, failed: say.failed })[trouble] });

  async function ask(text: string) {
    const signal = begin();
    setAsked({ words: text, found: null, trouble: null });
    onLine({ text: say.searching, working: true });
    try {
      const found = await findPlaces(text, { lang, signal });
      if (signal.aborted) return;
      setAsked({ words: text, found, trouble: null });
      const kept = found.filter(item => !names.some(name => fold(item.name).includes(name)));
      const buildable = kept.filter(item => !item.broad);
      const typed = matchPrepared(text, prepared);
      if (!found.length) onLine(typed.length ? null : { text: say.none });
      else if (!buildable.length && kept.length) onLine({ text: say.tooBig({ place: kept[0].name }) });
      // One clear answer and nothing prepared by that name: the route starts building at once.
      else if (buildable.length === 1 && !typed.length) void build(buildable[0]);
      else onLine(buildable.length > 1 ? { text: say.several } : null);
    } catch (error) {
      if (signal.aborted) return;
      const trouble = troubleOf(error);
      setAsked({ words: text, found: null, trouble });
      onLine(troubleLine(trouble));
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!clean) return;
    const buildable = others.filter(item => !item.broad);
    if (current?.found && buildable.length === 1) void build(buildable[0]);
    else if (!current || current.trouble) void ask(clean);
  }
  async function askStart(target: Found, text: string) {
    const signal = begin();
    setStartFound(null);
    try {
      const found = await findPlaces(text, { lang, near: target.position, signal });
      if (!signal.aborted) { setStartFound(found); onLine(found.length ? null : { text: say.none }); }
    } catch (error) { if (!signal.aborted) onLine(troubleLine(troubleOf(error))); }
  }
  async function build(target: Found, start?: Found) {
    if (target.broad) { onLine({ text: say.tooBig({ place: target.name }) }); return; }
    const signal = begin();
    setStage({ kind: 'build', target, trouble: null });
    onLine({ text: say.routing({ place: target.name }), working: true });
    try {
      const routed = await routeWalk({ name: target.name, position: target.position, osm: target.osm }, target.area || target.detail, signal, start && { name: start.name, position: start.position, osm: start.osm });
      if (signal.aborted) return;
      onPreview(routed.preview);
      setStage({ kind: 'find' });
      // The route opens now; OpenStreetMap along it arrives on its own, even after this field has gone.
      onWalk(routed.preview, readWalk(routed), target);
    } catch (error) {
      if (signal.aborted) return;
      onPreview(null);
      const trouble = troubleOf(error);
      setStage({ kind: 'build', target, trouble });
      onLine(troubleLine(trouble));
    }
  }
  function clear() {
    work.current?.abort();
    setWords(''); setAsked(null); setStage({ kind: 'find' }); setStartWords(''); setStartFound(null);
    onLine(null); onPreview(null);
    field.current?.focus();
  }

  const preparedRow = (place: Prepared) => <Row key={place.id} icon={<PhotoIcon />} label={place.name} detail={`${t('search.photosRead')} · ${place.area}`} onClick={() => onPrepared(place.id)} />;
  const preparedInstead = <Section title={say.prepared}><List>{prepared.map(preparedRow)}</List></Section>;
  // Nothing renders until there is something to tap.
  let panel = null;
  if (stage.kind === 'find' && !clean && focused && recent.length) {
    panel = <Section title={t('search.recent')}><ul className="ui-list home-search-recent">{recent.map(walk => <li key={walk.id}>
      <Row icon={<PinIcon />} label={walk.target} detail={walk.area} onMouseDown={event => event.preventDefault()} onClick={() => onRecent?.(walk.id)} />
      <IconButton label={t('search.forget', { name: walk.target })} onMouseDown={event => event.preventDefault()} onClick={() => onForget?.(walk.id)}><CloseIcon size={16} /></IconButton>
    </li>)}</ul></Section>;
  } else if (stage.kind === 'find' && clean) {
    const rows = [
      ...matches.map(preparedRow),
      ...others.map(found => <Row key={found.id} icon={<PinIcon />} label={found.name} onClick={() => void build(found)}
        detail={found.broad ? found.area || found.detail : [t('search.mapOnly'), found.area || found.detail].filter(Boolean).join(' · ')} />),
      ...(!current && clean.length > 1 ? [<Row key="ask" icon={<SearchIcon />} label={t('search.ask', { words: clean })} onClick={() => void ask(clean)} />] : []),
    ];
    const failed = !!current && !matches.length && (!!current.trouble || (!!current.found && !current.found.length));
    if (rows.length || (failed && prepared.length)) panel = <>{rows.length > 0 && <List label={t('search.results')}>{rows}</List>}{failed && prepared.length > 0 && preparedInstead}</>;
  } else if (stage.kind === 'build' && stage.trouble) {
    panel = <>
      <List><Row icon={<RotateIcon />} label={say.retry} detail={stage.target.name} onClick={() => void build(stage.target)} /></List>
      {prepared.length > 0 && preparedInstead}
    </>;
  } else if (stage.kind === 'start') {
    const target = stage.target;
    panel = <>
      <PanelHead title={t('search.walkTo', { name: target.name })} meta={t('search.from', { name: stage.from })} leading={<IconButton label={t('search.back')} onClick={clear}><BackIcon /></IconButton>} />
      <form className="home-search-start" role="search" onSubmit={event => { event.preventDefault(); if (startWords.trim()) void askStart(target, startWords.trim()); }}>
        <label className="home-search-label" htmlFor="home-search-start">{t('search.start')}</label>
        <div className="home-search-row">
          <div className="home-search-field">
            <input id="home-search-start" value={startWords} onChange={event => setStartWords(event.target.value)} placeholder={t('search.startHint', { name: target.name })} enterKeyHint="search" autoComplete="off" spellCheck={false} />
          </div>
          <IconButton type="submit" label={t('search.go')} className="home-search-go"><SearchIcon /></IconButton>
        </div>
      </form>
      {startFound && startFound.length > 0 && <List label={t('search.start')}>{startFound.map(found => <Row key={found.id} icon={<PinIcon />} label={found.name} detail={found.detail} onClick={() => void build(target, found)} />)}</List>}
    </>;
  }

  // The answers open downward and stop short of the guide's line, scrolling inside what is left.
  useLayoutEffect(() => {
    const panel = card.current, guide = document.querySelector('.home-guide');
    if (!panel || !guide) return;
    panel.style.maxHeight = `${Math.max(160, guide.getBoundingClientRect().top - panel.getBoundingClientRect().top - 12)}px`;
  });
  return <div className="home-search" onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }} onKeyDown={event => { if (event.key === 'Escape' && (words || stage.kind !== 'find')) { event.stopPropagation(); clear(); } }}>
    <form role="search" onSubmit={submit} aria-label={t('search.label')} className="home-search-row" data-tone="dark">
      <div className="home-search-field">
        <input ref={field} value={words} placeholder={SCRIPT[lang].home.search} aria-label={t('search.label')} enterKeyHint="search" autoComplete="off" spellCheck={false}
          onChange={event => { setWords(event.target.value); if (stage.kind !== 'find') { work.current?.abort(); setStage({ kind: 'find' }); onPreview(null); } onLine(null); }} />
        {words && <IconButton label={t('search.clear')} onClick={clear}><CloseIcon size={16} /></IconButton>}
      </div>
      <IconButton type="submit" label={t('search.go')} className="home-search-go"><SearchIcon /></IconButton>
    </form>
    {panel && <Panel ref={card} size="card" scroll className="home-search-panel" aria-label={t('search.results')}>{panel}</Panel>}
  </div>;
}

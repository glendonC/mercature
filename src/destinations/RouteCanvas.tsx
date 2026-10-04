import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { BotAvatar } from 'bot-avatars';
import AIResultCard, { type AIResult } from '../components/AIResultCard';
import { decide, loadReview, logMessage, saveReview, startOver, updateMessage, verdictOf, type LoggedMessage, type ModelAnswer, type Review, type Verdict } from '../decisions/store';
import { modelDownloadBytes, modelState, modelStored, prepareModel, prepareSite, understand, type ModelState, type Understanding } from '../language/understand';
import { ROUTE_PLACES } from '../site/registry';
import { COPY, NOTE, REPLY, guessLanguage, where, type Copy, type Subject, type UiLang, type VisitorLang, type Where } from './copy';
import { DESTINATIONS, type Destination, type Finding, type Photo, type View } from './data';
import RouteMap, { type MapHandle, type Marker } from './RouteMap';
import { buildWalk, midpoint, nearestStretch, type Point, type Spot, type Walk } from './walk';
import { spotState } from './markers';
import { useLanguage } from '../i18n';
import { fromRecord } from '../i18n/records';
import InterfaceLanguage from '../i18n/LanguageSwitch';
import './route-canvas.css';

type Tab = 'place' | 'messages' | 'changes';
type Selection = { kind: 'spot'; id: string } | { kind: 'stretch'; index: number } | { kind: 'landmark'; id: string };
const TABS: Tab[] = ['place', 'messages', 'changes'];
/** Places whose walk has named spots, so messages can be read against them. */
export const hasRouteCanvas = (data: Destination) => !!ROUTE_PLACES[data.id] && data.stretches.length > 0;
const VISITOR_LANGS: { id: VisitorLang; label: string }[] = [{ id: 'en', label: 'English' }, { id: 'es', label: 'Español' }, { id: 'ko', label: '한국어' }];
const MESSAGE_LANGS = [...VISITOR_LANGS, { id: 'qu', label: 'Runasimi' }, { id: 'other', label: 'Other' }];
const bare = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '');
const subjectOf = (findings: readonly Finding[]): Subject => findings.some(f => /steps/.test(f.concept)) ? 'steps' : findings.some(f => f.concept === 'kerb') ? 'kerb' : 'path';
const same = (a: Selection | null, b: Selection | null) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
const replyLang = (language: string): VisitorLang => language === 'es' || language === 'ko' ? language : 'en';

/** What a card can show for a spot: photo outlines it can display, then map records. */
function evidenceOf(spot: Spot | null, views: Map<string, View>) {
  return spot?.kind === 'flagged' ? spot.findings.filter(finding => finding.viewId ? views.has(finding.viewId) : !!finding.osm) : [];
}

function useNarrow() {
  const query = '(max-width: 640px)';
  const [narrow, setNarrow] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query), change = () => setNarrow(list.matches);
    list.addEventListener('change', change);
    return () => list.removeEventListener('change', change);
  }, []);
  return narrow;
}

/** The route workspace: one persistent map, with places, messages and changes as views over it. */
export default function RouteCanvas({ data, asset, onHome }: { data: Destination; asset: (file: string) => string; onHome: () => void }) {
  const [tab, setTab] = useState<Tab>('place');
  const { lang } = useLanguage();
  const t = COPY[lang];
  const narrow = useNarrow();
  const tabsId = useId();
  const walk = useMemo(() => buildWalk(data), [data]);
  const place = ROUTE_PLACES[data.id] ?? null;
  const routeSpots = place?.features ?? [];
  const views = useMemo(() => new Map(data.views.map(view => [view.id, view])), [data.views]);
  const photos = useMemo(() => new Map(data.photos.map(photo => [photo.id, photo])), [data.photos]);
  const map = useRef<MapHandle>(null);
  const root = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  const [initial] = useState(() => loadReview(data.id));
  const [review, setReview] = useState(initial.review);
  const latest = useRef(review);
  const [problem, setProblem] = useState<'unreadable' | 'notSaved' | ''>(initial.error === 'unreadable' ? 'unreadable' : '');
  function commit(change: (review: Review) => Review) {
    const next = change(latest.current);
    latest.current = next;
    setReview(next);
    if (!saveReview(next)) setProblem('notSaved');
  }

  const [selection, setSelection] = useState<Selection | null>(null);
  const [page, setPage] = useState(0);
  const [said, setSaid] = useState('');
  const [draft, setDraft] = useState('');
  const [draftLang, setDraftLang] = useState('en');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const current = review.messages.find(message => message.id === currentId) ?? null;
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [noteLang, setNoteLang] = useState<VisitorLang>('en');
  const [replyLanguage, setReplyLanguage] = useState<VisitorLang | null>(null);
  const [thinking, setThinking] = useState(false);
  const [model, setModel] = useState<ModelState>(() => modelState());
  const [stored, setStored] = useState(false);
  const [busy, setBusy] = useState<'download' | 'warm' | null>(null);
  const [modelFailed, setModelFailed] = useState(false);
  /** What a download would really cost here, so the person can decide on mobile data. */
  const [downloadBytes, setDownloadBytes] = useState<number | null>(null);
  const ticket = useRef(0);

  // A stored model warms up on its own; nothing is ever downloaded without a tap.
  useEffect(() => {
    if (!place) return;
    let alive = true;
    void (async () => {
      if (modelState().status === 'ready') { await prepareSite(place); return; }
      const isStored = await modelStored();
      if (!alive || !isStored) return;
      setStored(true); setBusy('warm');
      const next = await prepareModel(state => { if (alive) setModel(state); });
      if (!alive) return;
      setModel(next); setBusy(null);
      if (next.status === 'ready') await prepareSite(place);
    })();
    return () => { alive = false; };
  }, [place]);
  useEffect(() => () => { ticket.current++; }, []);
  useEffect(() => {
    if (!place || model.status === 'ready') return;
    let alive = true;
    void modelDownloadBytes().then(bytes => { if (alive) setDownloadBytes(bytes); });
    return () => { alive = false; };
  }, [place, model.status]);

  // Names and positions
  const routeSpotFor = (stretches: readonly number[]) => routeSpots.find(spot => spot.stretches.length && spot.stretches[0] === stretches[0]);
  /** A spot as people read it: where it is and how far along the walk. Display only; the route.ts names feed the model. */
  const spotName = (spot: Spot) => {
    const at = whereOf(spot), place = lang === 'es' ? at.es.replace(/^(en|cerca)\s+(de\s+)?(la\s+|el\s+|los\s+|las\s+|del\s+)?/i, '') : at.en.replace(/^(at|near|on|by)\s+(the\s+)?/i, '');
    return `${place.charAt(0).toLocaleUpperCase()}${place.slice(1)}, ${t.range(Math.round(spot.from), Math.round(spot.to))}`;
  };
  const spotOf = (index: number) => walk.spots.find(spot => spot.stretches.includes(index)) ?? null;
  function targetOf(id: string): Selection | null {
    const named = routeSpots.find(spot => spot.id === id);
    const index = named ? named.stretches[0] : /^stretch-\d+$/.test(id) ? Number(id.slice(8)) : undefined;
    if (index !== undefined) { const spot = spotOf(index); return spot ? { kind: 'spot', id: spot.id } : { kind: 'stretch', index }; }
    return named ? { kind: 'landmark', id: named.id } : null;
  }
  function keyOf(target: Selection): string {
    if (target.kind === 'landmark') return target.id;
    const stretches = target.kind === 'spot' ? walk.spots.find(spot => spot.id === target.id)!.stretches : [target.index];
    return routeSpotFor(stretches)?.id ?? (target.kind === 'spot' ? target.id : `stretch-${target.index}`);
  }
  function pointOf(target: Selection): Point | null {
    if (target.kind === 'spot') return walk.spots.find(spot => spot.id === target.id)?.at ?? null;
    if (target.kind === 'stretch') return data.stretches[target.index] ? midpoint(data.stretches[target.index].line.map(walk.project)) : null;
    const named = routeSpots.find(spot => spot.id === target.id);
    return named ? walk.locate(named.landmark) : null;
  }
  function nameOfKey(key: string) {
    const target = targetOf(key);
    if (!target) return key;
    if (target.kind === 'spot') return spotName(walk.spots.find(spot => spot.id === target.id)!);
    if (target.kind === 'landmark') return bare(routeSpots.find(spot => spot.id === target.id)!.name[lang]);
    const stretch = data.stretches[target.index];
    return t.range(Math.round(stretch.from), Math.round(stretch.to));
  }
  const stretchesOfKey = (key: string): number[] => { const target = targetOf(key); return !target || target.kind === 'landmark' ? [] : target.kind === 'spot' ? walk.spots.find(spot => spot.id === target.id)!.stretches : [target.index]; };

  // Selection and camera
  /** What had focus when the card opened, so closing it returns there. */
  const opener = useRef<HTMLElement | null>(null);
  const returning = useRef<(HTMLElement | null)[] | null>(null);
  function open(target: Selection | null, move = true) {
    if (target) { const active = document.activeElement; opener.current = active instanceof HTMLElement && active !== document.body && !active.closest('.route-card') ? active : null; }
    setSelection(target); setPage(0); setSaid('');
    if (!target || !move || !map.current) return;
    const at = pointOf(target); if (!at) return;
    const { width, height, fitK } = map.current.size();
    const screen: Point = narrow ? [width / 2, 104 + Math.max(60, height * 0.4 - 104) / 2] : [Math.max(tab === 'place' ? 120 : 420, width * 0.34), height * 0.48];
    map.current.focus(at, screen, fitK * 1.9);
  }
  /** Closes the card. When focus was in it, focus goes back to what opened it, or else to its marker. */
  function close() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('.route-card')) returning.current = [opener.current, root.current?.querySelector<HTMLElement>('.route-marker[aria-pressed=true]') ?? null];
    open(null);
  }
  useEffect(() => {
    const wanted = returning.current;
    if (!wanted || selection) return;
    returning.current = null;
    // On phones the card takes the panel's place in the sheet, so the opener may come back as a new button with the same words.
    const again = (element: HTMLElement) => element.isConnected ? element
      : [...root.current?.querySelectorAll<HTMLElement>('button') ?? []].find(button => button.textContent === element.textContent && button.getAttribute('aria-label') === element.getAttribute('aria-label')) ?? null;
    for (const element of wanted) {
      const target = element && again(element);
      if (target) { target.focus({ preventScroll: true }); return; }
    }
  }, [selection]);
  function tapMap(at: Point, k: number) {
    const index = nearestStretch(data, walk, at);
    const stretch = index === null ? null : data.stretches[index];
    const distance = stretch ? Math.min(...stretch.line.map(walk.project).map(p => Math.hypot(p[0] - at[0], p[1] - at[1]))) : Infinity;
    if (stretch && distance * k < 28) { const spot = spotOf(stretch.index); open(spot ? { kind: 'spot', id: spot.id } : { kind: 'stretch', index: stretch.index }, false); }
    else open(null);
  }
  function judge(spot: Spot, verdict: Verdict | null) {
    commit(review => decide(review, spot.stretches, verdict));
    setSaid(verdict ? t.guide.decided(verdict) : '');
  }

  // Messages
  const ai = !!place && (model.status === 'ready' || stored);
  function startMessage(text: string, answer: ModelAnswer | null) {
    const id = crypto.randomUUID();
    commit(review => logMessage(review, { text, language: draftLang, answer, spot: null }, id));
    setCurrentId(id); setReplyFor(id); setDraft(''); setSaid('');
  }
  async function find() {
    if (!place || !draft.trim() || thinking) return;
    const text = draft, mine = ++ticket.current;
    setThinking(true); setSaid(''); setSelection(null);
    let result: Understanding;
    try { result = await understand(text, place); } catch { result = { status: 'unavailable', kind: null, category: null, candidates: [], reason: 'model-failed' }; }
    if (mine !== ticket.current) return;
    setThinking(false);
    if (result.status === 'invalid') { setSaid(t.guide.write); return; }
    const candidates = result.candidates.filter(id => targetOf(id)).slice(0, 3);
    startMessage(text, { status: result.status, kind: result.kind, category: result.category, candidates, model: result.model ? `${result.model.id}@${result.model.revision}` : null });
    if (result.status === 'ready' && candidates[0]) open(targetOf(candidates[0]));
    else showAll(candidates);
  }
  /** Brings every suggested spot into view, clear of the panel or the sheet. */
  function showAll(ids: readonly string[]) {
    const points = ids.map(targetOf).filter((target): target is Selection => !!target).map(pointOf).filter((point): point is Point => !!point);
    if (!points.length) return;
    // Wait for the sheet to show the answer, so its real height is known.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!map.current) return;
      const { height } = map.current.size(), sheetHeight = sheet.current?.offsetHeight ?? Math.round(height * 0.5);
      const guide = foot.current?.offsetHeight ?? 90;
      map.current.frame(points, narrow ? { top: 150, right: 28, bottom: sheetHeight + guide + 16, left: 28 } : { top: 150, right: 120, bottom: guide + 30, left: 400 });
    }));
  }
  async function download() {
    if (!place || busy) return;
    setBusy('download'); setModelFailed(false);
    const next = await prepareModel(setModel);
    setModel(next); setBusy(null);
    if (next.status === 'ready') { setStored(true); void prepareSite(place); } else setModelFailed(true);
  }
  function link(target: Selection) {
    if (!current) return;
    commit(review => updateMessage(review, current.id, { spot: keyOf(target) }));
    setSaid(t.guide.linked);
  }
  function freshMessage() { ticket.current++; setThinking(false); setCurrentId(null); setSelection(null); setSaid(''); }

  // Visitor-facing text, from fixed templates only
  const names = { start: walk.start?.name ?? '', target: walk.target.name };
  /** Where a spot is, in the words of its own name, so the card, the note and the reply agree. */
  function whereOf(spot: Spot): Where {
    const fallback = where(spot.near, names), named = routeSpotFor(spot.stretches);
    if (!named) return fallback;
    const landmark = routeSpots.find(item => !item.stretches.length && item.landmark === named.landmark);
    return {
      en: bare(named.name.en).match(/\b(at|near|on|by)\b.*$/)?.[0] ?? fallback.en,
      es: bare(named.name.es).match(/\b(en|cerca)\b.*$/)?.[0] ?? fallback.es,
      ko: spot.from === 0 && walk.start ? where(walk.start, names).ko : landmark?.aliases.ko?.[0] ?? fallback.ko,
    };
  }
  const decided = walk.spots.map(spot => ({ spot, verdict: verdictOf(review, spot.stretches) })).filter((item): item is { spot: Spot; verdict: Verdict } => !!item.verdict);
  function noteText(language: VisitorLang) {
    const lines = decided.filter(item => item.verdict !== 'not-barrier').map(({ spot, verdict }) => NOTE[verdict === 'barrier' ? 'barrier' : 'check'][language](subjectOf(spot.findings), whereOf(spot), Math.round(spot.from)));
    if (!lines.length) return '';
    const end = (name: string) => {
      const spot = routeSpots.find(item => !item.stretches.length && item.landmark === name);
      return !spot ? name : language === 'ko' ? spot.aliases.ko?.[0] ?? spot.name.en : spot.name[language];
    };
    const head = walk.start ? NOTE.title[language](end(walk.start.name), end(walk.target.name), Math.round(data.lengthMetres)) : data.title;
    const steps = decided.some(item => item.verdict === 'barrier' && subjectOf(item.spot.findings) === 'steps');
    return [head, ...lines, ...(steps ? [NOTE.steps[language]] : []), NOTE.basis[language]].join('\n');
  }
  function replyText(message: LoggedMessage, language: VisitorLang) {
    // Questions get a personal answer, never a statement about access. Only a sure answer picks the praise or question reply.
    if (message.answer?.status === 'ready' && message.answer.kind === 'praise') return REPLY.praise[language]();
    if (message.answer?.status === 'ready' && message.answer.kind === 'question') return REPLY.question[language]();
    const stretches = message.spot ? stretchesOfKey(message.spot) : [];
    const verdict = verdictOf(review, stretches), spot = stretches.length ? spotOf(stretches[0]) : null;
    if (!message.spot || !verdict) return REPLY.open[language]();
    if (verdict === 'barrier') return REPLY.barrier[language](subjectOf(spot?.findings ?? []), spot ? whereOf(spot) : where(null, names));
    return REPLY[verdict][language]();
  }
  function copy(text: string) { navigator.clipboard.writeText(text).then(() => setSaid(t.copied), () => setSaid(t.copyFailed)); }

  // Map content
  const candidates = tab === 'messages' && current?.answer && !current.spot ? current.answer.candidates : [];
  const rankOf = (target: Selection) => { const rank = candidates.findIndex(id => same(targetOf(id), target)) + 1; return rank || undefined; };
  const markers: Marker[] = walk.spots.map(spot => {
    const verdict = verdictOf(review, spot.stretches), name = spotName(spot), target: Selection = { kind: 'spot', id: spot.id };
    const state = spotState(spot, review);
    const status = spot.kind === 'no-photos' ? t.noPhotos : verdict ? t.verdicts[verdict] : t.unreviewed;
    return { id: spot.id, at: spot.at, state, selected: same(selection, target), rank: rankOf(target), tag: spot.kind === 'no-photos' ? t.noPhotos : verdict ? t.verdicts[verdict] : undefined, label: `${name}, ${status}` };
  });
  type Extra = Exclude<Selection, { kind: 'spot' }>;
  const extraTargets: Extra[] = [...candidates.map(targetOf).filter((target): target is Extra => !!target && target.kind !== 'spot'), ...(selection && selection.kind !== 'spot' ? [selection] : [])];
  for (const target of extraTargets) {
    const id = target.kind === 'landmark' ? `landmark:${target.id}` : `stretch:${target.index}`;
    const at = pointOf(target);
    if (!at || markers.some(marker => marker.id === id)) continue;
    markers.push({ id, at, state: target.kind === 'landmark' ? 'landmark' : 'clear', selected: same(selection, target), rank: rankOf(target), label: target.kind === 'landmark' ? nameOfKey(target.id) : `${t.noBarrier}, ${nameOfKey(`stretch-${target.index}`)}` });
  }
  function markerTarget(id: string): Selection | null {
    if (id.startsWith('landmark:')) return { kind: 'landmark', id: id.slice(9) };
    if (id.startsWith('stretch:')) return { kind: 'stretch', index: Number(id.slice(8)) };
    return walk.spots.some(spot => spot.id === id) ? { kind: 'spot', id } : null;
  }
  const selectedMarker = selection ? markers.find(marker => same(markerTarget(marker.id), selection))?.id ?? null : null;
  const highlight = selection?.kind === 'spot' ? walk.spots.find(spot => spot.id === selection.id)?.path ?? null : selection?.kind === 'stretch' ? data.stretches[selection.index]?.line.map(walk.project) ?? null : null;
  const labels = useMemo(() => {
    // The walk's two ends use their spot names, which exist in each interface language.
    const endName = (name: string) => routeSpots.find(spot => !spot.stretches.length && spot.landmark === name)?.name[lang] ?? fromRecord(name, lang);
    return [...(walk.start ? [{ name: endName(walk.start.name), at: walk.start.at, dy: 20 }] : []), { name: endName(walk.target.name), at: walk.target.at, dy: 22 }, ...walk.landmarks.filter(l => l.kind === 'building' || l.kind === 'street').map(l => ({ name: l.kind === 'street' && !/^calle /i.test(l.name) ? `Calle ${l.name}` : l.name, at: l.at }))];
  }, [walk, lang, routeSpots]);

  // Words
  const flagged = walk.spots.filter(spot => spot.kind === 'flagged');
  const left = flagged.filter(spot => !verdictOf(review, spot.stretches)).length;
  const selectedSpot = selection?.kind === 'spot' ? walk.spots.find(spot => spot.id === selection.id) ?? null : null;
  const linking = tab === 'messages' && !!current && !current.spot;
  const answer = current?.answer ?? null;
  const line = thinking ? t.guide.reading
    : busy === 'download' ? t.guide.downloading
    : said ? said
    : tab === 'messages' && busy === 'warm' ? t.guide.warming
    : tab === 'messages' ? !current ? t.guide.write : current.spot ? t.guide.linked : selection ? t.guide.ready
      : !answer || answer.status === 'unavailable' ? t.guide.manual : !answer.kind ? t.guide.unsure : !answer.candidates.length ? t.guide.noSpot : answer.status === 'ready' ? t.guide.ready : t.guide.compare
    : tab === 'changes' ? review.messages.length || decided.length ? t.guide.changes : t.guide.nothing
    : selectedSpot ? selectedSpot.kind === 'no-photos' ? t.guide.empty : verdictOf(review, selectedSpot.stretches) ? t.guide.decided(verdictOf(review, selectedSpot.stretches)!) : t.guide.spot
    : selection?.kind === 'stretch' ? t.guide.clear : t.guide.place(left);

  const shownView = (() => {
    if (selection?.kind === 'spot') { const evidence = evidenceOf(selectedSpot, views); return evidence[Math.min(page, evidence.length - 1)]?.viewId ?? null; }
    if (selection?.kind === 'stretch') return data.stretches[selection.index]?.views.find(id => views.has(id)) ?? null;
    return null;
  })();
  const card = selection && <SpotCard key={JSON.stringify(selection)} t={t} lang={lang} selection={selection} walk={walk} data={data} review={review} views={views} photos={photos} asset={asset}
    page={page} setPage={setPage} name={selection.kind === 'spot' ? spotName(walk.spots.find(spot => spot.id === selection.id)!) : selection.kind === 'landmark' ? nameOfKey(selection.id) : t.noBarrier}
    onJudge={judge} onClose={close} link={linking ? () => link(selection) : undefined} />;

  const messagesPanel = <section className="route-panel">
    {!current ? <>
      <label className="route-label" htmlFor={`${tabsId}-message`}>{t.message}</label>
      <textarea id={`${tabsId}-message`} value={draft} maxLength={500} placeholder={t.messagePlaceholder} onChange={event => { setDraft(event.target.value); setDraftLang(guessLanguage(event.target.value)); }} />
      <div className="route-field">
        <label className="route-label" htmlFor={`${tabsId}-language`}>{t.language}</label>
        <select id={`${tabsId}-language`} value={draftLang} onChange={event => setDraftLang(event.target.value)}>{MESSAGE_LANGS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      </div>
      <div className="route-actions">
        {ai ? <button className="route-primary" disabled={!draft.trim() || thinking || busy === 'warm'} onClick={() => void find()}>{t.find}</button>
          : <button className="route-primary" disabled={!draft.trim()} onClick={() => startMessage(draft, null)}>{t.withoutAi}</button>}
        {!ai && place && (downloadBytes || model.status === 'downloading') && <button className="route-secondary" disabled={!!busy} onClick={() => void download()}>{model.status === 'downloading' ? t.downloadProgress(Math.round(model.loadedBytes / 1e6), Math.round(model.totalBytes / 1e6)) : t.download(Math.max(1, Math.round(downloadBytes! / 1e6)))}</button>}
      </div>
      {modelFailed && <p className="route-quiet" role="status">{t.modelFailed}</p>}
    </> : <>
      <blockquote className="route-quote" lang={current.language === 'other' ? undefined : current.language}>{current.text}</blockquote>
      {current.spot ? <p className="route-linked">{t.linkedTo(nameOfKey(current.spot))}</p>
        : answer && answer.status !== 'unavailable' ? <AIResultCard numbered hideEmpty labels={{ region: t.views.messages, message: t.kind, issue: t.issue, notSure: answer.candidates.length ? t.notSureSpots : t.notSureNone, suggested: t.suggested, none: t.none }}
          result={{ messageType: answer.kind ? t.kinds[answer.kind] : t.notSure, issueType: '', state: answer.kind ? 'matched' : 'not-sure', spots: answer.candidates.map(id => ({ id, label: nameOfKey(id) })) } satisfies AIResult}
          selectedId={answer.candidates.find(id => same(targetOf(id), selection)) ?? null} onSpot={id => open(targetOf(id))} onNotSure={() => { open(null); setSaid(t.guide.manual); }} />
        : <p className="route-quiet">{t.noModel}</p>}
      <div className="route-actions"><button className="route-secondary" onClick={freshMessage}>{t.newMessage}</button></div>
    </>}
  </section>;

  const replyMessage = review.messages.find(message => message.id === replyFor) ?? review.messages[0] ?? null;
  const replyLanguageNow = replyLanguage ?? (replyMessage ? replyLang(replyMessage.language) : 'en');
  const note = noteText(noteLang);
  const changesPanel = <section className="route-panel route-changes">
    {!decided.length && !review.messages.length && <p className="route-quiet">{t.guide.nothing}</p>}
    {decided.length > 0 && <><h2>{t.spots}</h2><ul className="route-list">{decided.map(({ spot, verdict }) =>
      <li key={spot.id}><button onClick={() => open({ kind: 'spot', id: spot.id })}><span>{spotName(spot)}</span><span className="route-verdict" data-verdict={verdict}>{t.verdicts[verdict]}</span></button></li>)}</ul></>}
    {review.messages.length > 0 && <><h2>{t.messages}</h2><ul className="route-list">{review.messages.slice(0, 8).map(message =>
      <li key={message.id}><button aria-pressed={replyMessage?.id === message.id} onClick={() => { setReplyFor(message.id); setReplyLanguage(null); }}><span className="route-excerpt" lang={message.language === 'other' ? undefined : message.language}>{message.text}</span><span className="route-verdict">{message.spot ? nameOfKey(message.spot) : t.notLinked}</span></button></li>)}</ul></>}
    {replyMessage && <>
      <h2>{t.reply}</h2>
      <LanguageSwitch value={replyLanguageNow} onChange={setReplyLanguage} label={t.reply} />
      <p className="route-text" lang={replyLanguageNow}>{replyText(replyMessage, replyLanguageNow)}</p>
      <div className="route-actions"><button className="route-primary" onClick={() => copy(replyText(replyMessage, replyLanguageNow))}>{t.copyReply}</button></div>
    </>}
    {(decided.length > 0 || review.messages.length > 0) && <>
      <h2>{t.note}</h2>
      <LanguageSwitch value={noteLang} onChange={setNoteLang} label={t.note} />
      {note ? <><p className="route-text" lang={noteLang}>{note}</p><div className="route-actions"><button className="route-primary" onClick={() => copy(note)}>{t.copyNote}</button></div></> : <p className="route-quiet">{t.noNote}</p>}
    </>}
    {(decided.length > 0 || review.messages.length > 0) && <div className="route-start-over">
      {clearing ? <><p className="route-quiet">{t.startOverAsk}</p><div className="route-actions">
        <button className="route-secondary" onClick={() => { commit(startOver); setClearing(false); setCurrentId(null); setReplyFor(null); setSelection(null); setSaid(t.cleared); }}>{t.clear}</button>
        <button className="route-text-button" onClick={() => setClearing(false)}>{t.keep}</button>
      </div></> : <button className="route-text-button" onClick={() => setClearing(true)}>{t.startOver}</button>}
    </div>}
  </section>;

  const panel = tab === 'messages' ? messagesPanel : tab === 'changes' ? changesPanel : null;
  const sheetContent = narrow ? card ?? panel : null;
  const [sheetHeight, setSheetHeight] = useState(0);
  const foot = useRef<HTMLElement>(null);
  const [footHeight, setFootHeight] = useState(0);
  useLayoutEffect(() => {
    const element = foot.current; if (!element) return;
    const measure = () => setFootHeight(element.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const element = sheet.current, canvas = root.current;
    if (!canvas) return;
    if (!element) { canvas.style.setProperty('--sheet', '0px'); setSheetHeight(0); return; }
    const measure = () => { canvas.style.setProperty('--sheet', `${element.offsetHeight}px`); setSheetHeight(element.offsetHeight); };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, [sheetContent]);

  function keyTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % TABS.length : event.key === 'ArrowLeft' ? (index + TABS.length - 1) % TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); setTab(TABS[next]); setSaid(''); setSelection(null);
    document.getElementById(`${tabsId}-${TABS[next]}`)?.focus();
  }
  const insets = narrow ? { top: 112, right: 20, bottom: 150, left: 20 } : { top: 150, right: 60, bottom: 110, left: 70 };

  return <main ref={root} className="route-canvas" data-tab={tab} data-sheet={narrow && !!sheetContent} aria-label={t.workspace} lang={lang} onKeyDown={event => { if (event.key === 'Escape' && selection) close(); }}>
    <header className="route-bar">
      <button className="route-icon-button" onClick={onHome} aria-label={t.home}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 10 12 3l8 7v11h-6v-7h-4v7H4Z" /></svg></button>
      <div className="route-tabs" role="tablist" aria-label={t.workspace}>
        {TABS.map((item, index) => <button key={item} id={`${tabsId}-${item}`} role="tab" aria-selected={tab === item} aria-controls={`${tabsId}-view`} tabIndex={tab === item ? 0 : -1} onKeyDown={event => keyTabs(event, index)} onClick={() => { setTab(item); setSaid(''); setSelection(null); }}>
          {t.views[item]}{item === 'place' && left > 0 && <span className="route-count" aria-hidden="true">{left}</span>}
        </button>)}
      </div>
      <InterfaceLanguage className="route-ui-lang"/>
    </header>
    <div className="route-title">
      <h1>{DESTINATIONS[data.id].name}</h1>
      <p>{t.walk(walk.start?.name ?? data.title, Math.round(data.lengthMetres))}</p>
      <p className="route-recorded">{t.recorded}</p>
    </div>
    {/* The panel and the sheet come before the map, so Tab reaches them first; their positions keep the visual order. */}
    <div className="route-view" role="tabpanel" id={`${tabsId}-view`} aria-labelledby={`${tabsId}-${tab}`}>
      {!narrow && panel}
      {narrow && sheetContent && <div className="route-sheet" ref={sheet}>{sheetContent}<p className="route-sheet-credit">{t.creditsShort}</p></div>}
      <RouteMap ref={map} data={data} photoView={shownView ?? ''} walk={walk} markers={markers} labels={labels} insets={insets} highlight={highlight} onMarker={id => { const target = markerTarget(id); if (target) open(target); }}
        onMap={tapMap} words={t.map} clearBottom={(narrow ? sheetHeight : 0) + footHeight + 12} card={!narrow ? card : null} cardFor={!narrow ? selectedMarker : null} ariaLabel={data.title} />
    </div>
    {problem && <p className="route-problem" role="alert">{problem === 'unreadable' ? t.unreadable : t.notSaved}<button className="route-icon-button" aria-label={t.close} onClick={() => setProblem('')}><Close /></button></p>}
    <footer className="route-foot" ref={foot}>
      {tab === 'place' ? <div className="route-task" aria-label={t.task(left)}>
        <strong>{t.task(left)}</strong>
        <span className="route-progress" aria-hidden="true"><span style={{ width: `${flagged.length ? (flagged.length - left) / flagged.length * 100 : 0}%` }} /></span>
        <small>{t.reviewed(flagged.length - left, flagged.length)}</small>
      </div> : current && <button className="route-chip" onClick={() => setTab('messages')} aria-label={`${t.message}: ${current.text}`}>
        <span className="route-excerpt" lang={current.language === 'other' ? undefined : current.language}>{current.text}</span>
        <small>{current.spot ? t.linkedTo(nameOfKey(current.spot)) : t.notLinked}</small>
      </button>}
      <Guide working={thinking || !!busy} text={line} size={narrow ? 48 : 64} />
      <div className="route-hints">
        <small>{narrow ? t.creditsShort : t.credits}</small>
      </div>
    </footer>
  </main>;
}

function Close() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}
function Chevron({ back }: { back?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={back ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'} /></svg>;
}

function LanguageSwitch({ value, onChange, label }: { value: VisitorLang; onChange: (value: VisitorLang) => void; label: string }) {
  return <div className="route-switch" role="group" aria-label={label}>{VISITOR_LANGS.map(item => <button key={item.id} aria-pressed={value === item.id} onClick={() => onChange(item.id)} lang={item.id}>{item.label}</button>)}</div>;
}

/** The one line the guide says. It looks busy only while a real promise runs. */
function Guide({ text, working, size }: { text: string; working: boolean; size: number }) {
  const [silver] = useState(() => getComputedStyle(document.documentElement).getPropertyValue('--field').trim() || 'gray');
  return <div className="route-guide">
    <span className="route-guide-avatar" aria-hidden="true"><BotAvatar type="blob" state={working ? 'working' : 'default'} size={size} color={silver} shading="plastic" speed={0.4} turn={0.25} jumpEvery={0} interactive={false} saturation={1} theme="light" /></span>
    <p role="status" aria-live="polite">{text}</p>
  </div>;
}

function SpotCard({ t, lang, selection, walk, data, review, views, photos, asset, page, setPage, name, onJudge, onClose, link }: {
  t: Copy; lang: UiLang; selection: Selection; walk: Walk; data: Destination; review: Review; views: Map<string, View>; photos: Map<string, Photo>;
  asset: (file: string) => string; page: number; setPage: (page: number) => void; name: string;
  onJudge: (spot: Spot, verdict: Verdict | null) => void; onClose: () => void; link?: () => void;
}) {
  // Focus starts on the card itself, so Tab meets Close, the photo and the pager in the order they are seen.
  const box = useRef<HTMLElement>(null);
  useEffect(() => { box.current?.focus({ preventScroll: true }); }, []);
  const spot = selection.kind === 'spot' ? walk.spots.find(item => item.id === selection.id) ?? null : null;
  const stretch = selection.kind === 'stretch' ? data.stretches[selection.index] : null;
  const verdict = spot ? verdictOf(review, spot.stretches) : null;
  const evidence = evidenceOf(spot, views);
  const shown = evidence[Math.min(page, evidence.length - 1)] ?? null;
  const plainView = stretch ? stretch.views.map(id => views.get(id)).find(Boolean) ?? null : null;
  const range = spot ? t.range(Math.round(spot.from), Math.round(spot.to)) : stretch ? t.range(Math.round(stretch.from), Math.round(stretch.to)) : null;
  const pager = evidence.length > 1 ? <div className="route-pager">
    <button className="route-icon-button" aria-label={t.previous} onClick={() => setPage((page + evidence.length - 1) % evidence.length)}><Chevron back /></button>
    <span>{t.photoOf(Math.min(page, evidence.length - 1) + 1, evidence.length)}</span>
    <button className="route-icon-button" aria-label={t.next} onClick={() => setPage((page + 1) % evidence.length)}><Chevron /></button>
  </div> : null;
  let figure: ReactNode = null;
  if (shown?.viewId) figure = <Evidence key={shown.id} t={t} view={views.get(shown.viewId)!} finding={shown} photo={photos.get(views.get(shown.viewId)!.photoId)} asset={asset} lang={lang} alt={`${fromRecord(shown.label, lang)}, ${name}`} pager={pager} />;
  else if (shown?.osm) figure = <div className="route-map-record"><strong>{fromRecord(shown.label, lang)}</strong><span>OpenStreetMap</span>{pager}</div>;
  else if (plainView) figure = <Evidence key={plainView.id} t={t} view={plainView} finding={null} photo={photos.get(plainView.photoId)} asset={asset} lang={lang} alt={name} />;
  return <section className="route-card" aria-label={name} ref={box} tabIndex={-1}>
    <button className="route-icon-button route-card-close" aria-label={t.close} onClick={onClose}><Close /></button>
    {figure}
    <h2>{name}</h2>
    {stretch && range && <p className="route-card-line">{range}</p>}
    {shown && <p className="route-card-quiet"><span className="route-mark" aria-hidden="true" />{fromRecord(shown.label, lang)}. {shown.viewId ? t.suggestion : t.mapRecord}</p>}
    {spot?.kind === 'no-photos' && <p className="route-card-quiet">{t.noPhotos}</p>}
    {stretch && <p className="route-card-quiet">{t.noBarrier}</p>}
    {link && <div className="route-actions"><button className="route-primary" onClick={link}>{t.yes}</button></div>}
    {spot && <div className="route-decide" role="group" aria-label={name}>
      {spot.kind === 'flagged' && <button className={link ? 'route-secondary' : 'route-primary'} aria-pressed={verdict === 'barrier'} onClick={() => onJudge(spot, 'barrier')}>{t.confirm}</button>}
      {spot.kind === 'flagged' && <button className="route-secondary" aria-pressed={verdict === 'not-barrier'} onClick={() => onJudge(spot, 'not-barrier')}>{t.notBarrier}</button>}
      <button className="route-quiet-button" aria-pressed={verdict === 'check'} onClick={() => onJudge(spot, 'check')}>{t.check}</button>
    </div>}
    {spot && verdict && <p className="route-card-verdict" data-verdict={verdict}>{t.verdicts[verdict]} <button className="route-text-button" onClick={() => onJudge(spot, null)}>{t.undo}</button></p>}
  </section>;
}

/** Frames a small outline closely so a person can judge it; a tap shows the whole photo. */
function zoomOn(view: View, finding: Finding | null) {
  if (!finding || finding.outline.length < 3) return null;
  const xs = finding.outline.map(p => p[0]), ys = finding.outline.map(p => p[1]);
  const width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys) - Math.min(...ys);
  const scale = Math.min(3, view.width / (width * 3.2), view.height / (height * 3.2));
  if (scale < 1.4) return null;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2 / view.width, cy = (Math.max(...ys) + Math.min(...ys)) / 2 / view.height;
  const shift = (centre: number) => Math.max((1 - scale) * 100, Math.min(0, (0.5 - centre * scale) * 100));
  return `translate(${shift(cx)}%, ${shift(cy)}%) scale(${scale})`;
}

function Evidence({ view, finding, photo, asset, lang, alt, t, pager }: { view: View; finding: Finding | null; photo: Photo | undefined; asset: (file: string) => string; lang: UiLang; alt: string; t: Copy; pager?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const zoom = zoomOn(view, finding);
  const [whole, setWhole] = useState(false);
  const date = photo?.capturedAt ? new Date(photo.capturedAt).toLocaleDateString(lang === 'es' ? 'es-PE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const image = <div className="route-photo-image" style={{ transform: zoom && !whole ? zoom : undefined }}>
    {failed ? <span className="route-photo-missing" /> : <img src={asset(view.file)} alt={alt} onError={() => setFailed(true)} />}
    {finding && finding.outline.length > 2 && !failed && <svg viewBox={`0 0 ${view.width} ${view.height}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon className="outline-halo" points={finding.outline.map(p => p.join(',')).join(' ')} />
      <polygon className="outline" points={finding.outline.map(p => p.join(',')).join(' ')} />
    </svg>}
  </div>;
  // The frame may crop the photo to save height on phones; the image and its outline keep one box, centred in it.
  const ratio = { '--ratio': view.height / view.width } as CSSProperties;
  return <figure className="route-photo" style={ratio}>
    <div className="route-photo-box">
      {zoom ? <button className="route-photo-frame" aria-pressed={whole} onClick={() => setWhole(value => !value)} aria-label={whole ? t.closer : t.whole}>{image}</button>
        : <div className="route-photo-frame">{image}</div>}
      {pager}
    </div>
    {photo && <figcaption>{photo.creator}{date ? `, ${date}` : ''}. CC BY-SA 4.0 · {photo.link ? <a href={photo.link} target="_blank" rel="noreferrer">Mapillary</a> : 'Mapillary'}</figcaption>}
  </figure>;
}

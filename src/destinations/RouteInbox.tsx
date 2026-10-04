import { useEffect, useMemo, useRef, useState, useLayoutEffect, type CSSProperties } from 'react';
import { decide, loadReview, logMessage, saveReview, startOver, updateMessage, verdictOf, type LoggedMessage, type ModelAnswer, type Review } from '../decisions/store';
import { addSpot, clearEdits, clearFixed, isFixed, loadEdits, markFixed, noteOf, saveEdits, setNote, type EditKind, type Edits } from '../edits/store';
import { addedFeature, fixedLine, ownNoteLines, withEdits, type Locate } from '../edits/place';
import { recordDate } from '../edits/words';
import { forgetPlace, modelDownloadBytes, modelState, modelStored, prepareModel, prepareSite, remember, understand, type ModelState } from '../language/understand';
import { ROUTE_PLACES } from '../site/registry';
import { useLanguage } from '../i18n';
import { useEditWords } from '../i18n/edit';
import { fromRecord } from '../i18n/records';
import Menu, { type MenuPlace } from '../home/Menu';
import { COPY, NOTE, REPLY, guessLanguage, where, type Subject, type UiLang, type VisitorLang, type Where } from './copy';
import { DESTINATIONS, type Destination, type Finding, type Photo, type View } from './data';
import { EXAMPLES } from './examples';
import { spotState } from './markers';
import RouteMap, { type Insets, type MapHandle, type Marker } from './RouteMap';
import { buildWalk, midpoint, nearestStretch, type Point, type Spot } from './walk';
import { iconFor } from '../ui/icons';
import AddSpot from './edit/AddSpot';
import MarkFixed from './edit/MarkFixed';
import OwnNoteEditor from './edit/OwnNote';
import './route-inbox.css';

/** A place on the walk the panel can show: a spot of the walk, a plain stretch, a named landmark, or a spot she added. */
type Target = { kind: 'spot'; id: string } | { kind: 'stretch'; index: number } | { kind: 'landmark'; id: string } | { kind: 'added'; id: string };
type Pane = { kind: 'inbox' } | { kind: 'paste' } | { kind: 'message'; id: string } | { kind: 'spot'; target: Target };
type Editing = 'add' | 'fix' | 'note' | null;

const same = (a: Target | null, b: Target | null) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
const bare = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '');
const subjectOf = (findings: readonly Finding[]): Subject => findings.some(f => /steps/.test(f.concept)) ? 'steps' : findings.some(f => f.concept === 'kerb') ? 'kerb' : 'path';
const subjectOfKind = (kind: EditKind): Subject => kind === 'steps' ? 'steps' : kind === 'kerb' ? 'kerb' : 'path';
const kindOfSubject = (subject: Subject): EditKind => subject === 'steps' ? 'steps' : subject === 'kerb' ? 'kerb' : 'other';
const replyLanguage = (language: string): VisitorLang => language === 'es' || language === 'ko' ? language : language === 'qu' ? 'es' : 'en';
const noteLanguage = (text: string) => guessLanguage(text);
const VISITOR_LANGS: { id: VisitorLang; label: string }[] = [{ id: 'en', label: 'English' }, { id: 'es', label: 'Español' }, { id: 'ko', label: '한국어' }];
const MESSAGE_LANGS = [...VISITOR_LANGS, { id: 'qu', label: 'Runasimi' }, { id: 'other', label: 'Other' }];

/** Where the walk is framed: clear of the panel on wide screens and of the sheet on phones. The first fit uses no sheet height. */
export const mapInsets = (narrow: boolean, sheetHeight = 0): Insets => narrow ? { top: 110, right: 20, bottom: Math.max(180, sheetHeight + 20), left: 20 } : { top: 100, right: 430, bottom: 50, left: 50 };

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

/** The tallest a phone's sheet starts when the screen opens behind the reveal, so the map keeps the reveal's framing: mapInsets keeps its bottom at 180 up to here. */
export const PEEK = 160;
const quiet = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The route screen: visitors' messages placed on the walk and answered in their language, on a map she can edit.
 * settled: opened behind the reveal, which has already framed and leaned the same map.
 */
export default function RouteInbox({ data, asset, onHome, onPlace, settled = false }: { data: Destination; asset: (file: string) => string; onHome: () => void; onPlace?: (place: MenuPlace) => void; settled?: boolean }) {
  const { lang } = useLanguage();
  const editWords = useEditWords();
  const t = COPY[lang], w = t.inbox;
  const narrow = useNarrow();
  const walk = useMemo(() => buildWalk(data), [data]);
  const authored = ROUTE_PLACES[data.id] ?? null;
  const views = useMemo(() => new Map(data.views.map(view => [view.id, view])), [data.views]);
  const photos = useMemo(() => new Map(data.photos.map(photo => [photo.id, photo])), [data.photos]);
  const map = useRef<MapHandle>(null);
  const root = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLElement>(null);

  // What she keeps on this device: messages and removals, and her own edits.
  const [review, setReview] = useState(() => loadReview(data.id).review);
  const latest = useRef(review);
  const [edits, setEdits] = useState(() => loadEdits(data.id).edits);
  const latestEdits = useRef(edits);
  const [problem, setProblem] = useState('');
  function commit(change: (review: Review) => Review) {
    const next = change(latest.current); latest.current = next; setReview(next);
    if (!saveReview(next)) setProblem(t.notSaved);
  }
  /** Where a stretch is, for a spot she adds there. */
  const locate: Locate = stretch => {
    const line = data.stretches[stretch], at = midpoint(line.line.map(walk.project));
    const near = [...walk.landmarks].sort((a, b) => Math.hypot(a.at[0] - at[0], a.at[1] - at[1]) - Math.hypot(b.at[0] - at[0], b.at[1] - at[1]))[0];
    return { from: line.from, to: line.to, landmark: near?.name ?? '' };
  };
  const place = useMemo(() => authored ? withEdits(authored, edits, locate) : null, [authored, edits]); // eslint-disable-line react-hooks/exhaustive-deps
  function edit(change: (edits: Edits) => Edits) {
    const next = change(latestEdits.current); latestEdits.current = next; setEdits(next);
    if (!saveEdits(next)) setProblem(editWords.notSaved);
    // The model reads her added spots too; only what changed is embedded again.
    if (authored) void prepareSite(withEdits(authored, next, locate));
  }

  // The model: a stored one warms up on its own; nothing downloads without a tap.
  const [model, setModel] = useState<ModelState>(() => modelState());
  const [stored, setStored] = useState(false);
  const [busy, setBusy] = useState<'download' | 'warm' | 'reading' | null>(null);
  const [downloadBytes, setDownloadBytes] = useState<number | null>(null);
  const ticket = useRef(0);
  useEffect(() => {
    if (!place) return;
    let alive = true;
    void (async () => {
      if (modelState().status === 'ready') { await prepareSite(place); return; }
      const isStored = await modelStored();
      if (!alive || !isStored) return;
      setStored(true); setBusy(value => value ?? 'warm');
      const next = await prepareModel(state => { if (alive) setModel(state); });
      if (!alive) return;
      setModel(next); setBusy(value => value === 'warm' ? null : value);
      if (next.status === 'ready') await prepareSite(place);
    })();
    return () => { alive = false; };
  }, [authored]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!place || model.status === 'ready') return;
    let alive = true;
    void modelDownloadBytes().then(bytes => { if (alive) setDownloadBytes(bytes); });
    return () => { alive = false; };
  }, [authored, model.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const ai = !!place && (model.status === 'ready' || stored);

  // Names and positions
  const routeSpots = place?.features ?? [];
  const routeSpotFor = (stretches: readonly number[]) => routeSpots.find(spot => spot.stretches.length && spot.stretches[0] === stretches[0] && !spot.id.startsWith('added-'));
  const names = { start: walk.start?.name ?? '', target: walk.target.name };
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
  const spotName = (spot: Spot) => {
    const at = whereOf(spot), name = lang === 'es' ? at.es.replace(/^(en|cerca)\s+(de\s+)?(la\s+|el\s+|los\s+|las\s+|del\s+)?/i, '') : at.en.replace(/^(at|near|on|by)\s+(the\s+)?/i, '');
    return `${name.charAt(0).toLocaleUpperCase()}${name.slice(1)}, ${t.range(Math.round(spot.from), Math.round(spot.to))}`;
  };
  const added = (id: string) => edits.added.find(spot => spot.id === id) ?? null;
  const addedName = (id: string) => { const spot = added(id); return spot ? addedFeature(spot, locate).name[lang] : id; };
  const spotOf = (index: number) => walk.spots.find(spot => spot.stretches.includes(index)) ?? null;
  function targetOf(key: string): Target | null {
    if (added(key)) return { kind: 'added', id: key };
    const named = routeSpots.find(spot => spot.id === key);
    const index = named ? named.stretches[0] : /^stretch-\d+$/.test(key) ? Number(key.slice(8)) : undefined;
    if (index !== undefined) { const spot = spotOf(index); return spot ? { kind: 'spot', id: spot.id } : { kind: 'stretch', index }; }
    return named ? { kind: 'landmark', id: named.id } : null;
  }
  function stretchesOf(target: Target): number[] {
    if (target.kind === 'spot') return walk.spots.find(spot => spot.id === target.id)?.stretches ?? [];
    if (target.kind === 'stretch') return [target.index];
    if (target.kind === 'added') { const spot = added(target.id); return spot ? [spot.stretch] : []; }
    return [];
  }
  function keyOf(target: Target): string {
    if (target.kind === 'landmark' || target.kind === 'added') return target.id;
    const stretches = stretchesOf(target);
    return routeSpotFor(stretches)?.id ?? (target.kind === 'spot' ? target.id : `stretch-${target.index}`);
  }
  function pointOf(target: Target): Point | null {
    if (target.kind === 'spot') return walk.spots.find(spot => spot.id === target.id)?.at ?? null;
    if (target.kind === 'stretch' || target.kind === 'added') { const index = stretchesOf(target)[0]; return index === undefined ? null : midpoint(data.stretches[index].line.map(walk.project)); }
    const named = routeSpots.find(spot => spot.id === target.id);
    return named ? walk.locate(named.landmark) : null;
  }
  function nameOf(target: Target): string {
    if (target.kind === 'spot') return spotName(walk.spots.find(spot => spot.id === target.id)!);
    if (target.kind === 'added') return addedName(target.id);
    if (target.kind === 'landmark') return bare(routeSpots.find(spot => spot.id === target.id)?.name[lang] ?? target.id);
    const stretch = data.stretches[target.index];
    return t.range(Math.round(stretch.from), Math.round(stretch.to));
  }
  const nameOfKey = (key: string) => { const target = targetOf(key); return target ? nameOf(target) : key; };
  const removed = (stretches: readonly number[]) => verdictOf(review, stretches) === 'not-barrier';

  // Panels and camera
  const [pane, setPane] = useState<Pane>({ kind: 'inbox' });
  const paneNow = useRef(pane);
  paneNow.current = pane;
  // On a phone behind the reveal, the sheet starts low and the map keeps the reveal's framing; a swipe or a tap lifts it.
  const [peek, setPeek] = useState(settled);
  const peeking = narrow && peek && pane.kind === 'inbox';
  const refit = useRef(false);
  useEffect(() => { if (pane.kind !== 'inbox') setPeek(false); }, [pane.kind]);
  function lift(open: boolean) {
    setPeek(!open); refit.current = true;
    if (!open) sheet.current?.scrollTo({ top: 0 });
  }
  // Once the sheet has moved, the walk is framed again in the map left above it.
  useEffect(() => {
    if (!refit.current) return;
    refit.current = false;
    const timer = setTimeout(() => map.current?.fit(true), quiet() ? 0 : 260);
    return () => clearTimeout(timer);
  }, [peek]);
  const swipe = useRef<{ id: number; y: number; handle: boolean } | null>(null);
  const swiped = useRef(false);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Editing>(null);
  const [line, setLine] = useState('');
  const [draft, setDraft] = useState('');
  const [draftLang, setDraftLang] = useState('en');
  const [replyLang, setReplyLang] = useState<VisitorLang | null>(null);
  const [noteLang, setNoteLang] = useState<VisitorLang>('en');
  const [said, setSaid] = useState('');
  const [clearing, setClearing] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  function fly(target: Target | null) {
    const at = target && pointOf(target);
    if (!at || !map.current) return;
    const { width, height, fitK } = map.current.size();
    const screen: Point = narrow ? [width / 2, Math.max(150, (height - sheetHeight) * 0.55)] : [Math.max(260, (width - 400) * 0.5), height * 0.5];
    map.current.focus(at, screen, fitK * 1.8);
  }
  function frameAll(keys: readonly string[]) {
    const points = keys.map(targetOf).filter((target): target is Target => !!target).map(pointOf).filter((point): point is Point => !!point);
    if (!points.length || !map.current) return;
    // Wait for the panel to show the answer, so its real height is known.
    requestAnimationFrame(() => requestAnimationFrame(() => map.current?.frame(points, narrow ? { top: 130, right: 30, bottom: (sheet.current?.offsetHeight ?? 300) + 20, left: 30 } : { top: 110, right: 440, bottom: 60, left: 60 })));
  }
  function openSpot(target: Target, move = true) {
    setPane({ kind: 'spot', target }); setPage(0); setEditing(null); setSaid('');
    if (move) fly(target);
  }
  function home() { setPane({ kind: 'inbox' }); setEditing(null); setSaid(''); setLine(''); map.current?.fit(true); }
  // An editor opened low in the panel scrolls into view, so a phone shows it above the fold.
  useEffect(() => {
    if (!editing) return;
    sheet.current?.querySelector('.edit-panel')?.scrollIntoView({ block: 'nearest', behavior: quiet() ? 'auto' : 'smooth' });
  }, [editing]);
  // Focus follows the panel: into a pane when it opens, back to the row that opened it on return.
  const lastRow = useRef<string | null>(null);
  useEffect(() => {
    const panel = sheet.current; if (!panel) return;
    if (pane.kind !== 'inbox') { panel.querySelector<HTMLElement>('.ri-back')?.focus({ preventScroll: true }); return; }
    const row = lastRow.current && panel.querySelector<HTMLElement>(`[data-row="${CSS.escape(lastRow.current)}"]`);
    if (row) row.focus({ preventScroll: true });
    lastRow.current = null;
  }, [pane.kind]);

  // Messages: examples first read here, then kept like any message she adds.
  const examples = EXAMPLES[data.id] ?? [];
  const [pending, setPending] = useState<{ id: string; text: string; language: string } | null>(null);
  /** The message the model answered while this screen was open; any other answer shown is a stored one. */
  const [readNow, setReadNow] = useState<string | null>(null);
  const reading = useRef<string | null>(null);
  const messageOf = (id: string) => review.messages.find(message => message.id === id) ?? null;
  function read(id: string, text: string, language: string) {
    if (pane.kind === 'inbox') lastRow.current = id;
    setPane({ kind: 'message', id }); setReplyLang(null); setSaid(''); setReadNow(null);
    // A placed message keeps its answer. An unplaced one is read again when the model is at hand,
    // since a message she placed since may change where it points.
    const known = messageOf(id);
    if (known && (known.spot || !ai)) { show(known); return; }
    setPending({ id, text, language }); setLine('');
  }
  // A new message is read once the model is ready or found stored on this device, while its pane is open.
  useEffect(() => {
    if (!ai || !pending || pane.kind !== 'message' || pane.id !== pending.id || reading.current === pending.id) return;
    void run(pending.id, pending.text, pending.language);
  }, [ai, pending, pane]); // eslint-disable-line react-hooks/exhaustive-deps
  function show(message: LoggedMessage) {
    setPending(null);
    const answer = message.answer;
    setLine(!answer ? message.spot ? w.line.linked : w.line.manual : lineFor(answer, !!message.spot));
    const target = message.spot ? targetOf(message.spot) : null;
    if (target) fly(target); else if (answer?.candidates.length) frameAll(answer.candidates);
  }
  function lineFor(answer: ModelAnswer, filed: boolean) {
    if (answer.remembered) return w.line.remembered;
    if (answer.status === 'unavailable') return w.line.manual;
    if (!answer.candidates.length) return answer.kind ? w.line.noSpot : w.line.none;
    if (answer.status === 'ready' && filed) return w.line.ready;
    return w.line.unsure;
  }
  async function run(id: string, text: string, language: string) {
    if (!place) return;
    const mine = ++ticket.current;
    reading.current = id;
    setBusy('reading'); setLine(w.line.reading);
    let result;
    try { result = await understand(text, place); } catch { result = { status: 'unavailable' as const, kind: null, category: null, candidates: [], reason: 'model-failed' as const }; }
    if (mine !== ticket.current) return;
    reading.current = null;
    setBusy(null);
    if (result.status === 'invalid') { setLine(w.line.manual); return; }
    const candidates = result.candidates.filter(key => targetOf(key)).slice(0, 3);
    const answer: ModelAnswer = { status: result.status, kind: result.kind, category: result.category, candidates, model: result.model ? `${result.model.id}@${result.model.revision}` : null, ...(result.reason === 'remembered' ? { remembered: true as const } : {}) };
    // A sure answer files itself on the first spot; she can move it with one tap.
    const spot = answer.status === 'ready' && candidates[0] ? candidates[0] : null;
    commit(review => review.messages.some(message => message.id === id) ? updateMessage(review, id, { answer, spot }) : logMessage(review, { text, language, answer, spot }, id));
    setPending(null); setReadNow(id);
    setLine(lineFor(answer, !!spot));
    // The camera follows the answer only while its message is still open.
    if (paneNow.current.kind !== 'message' || paneNow.current.id !== id) return;
    if (spot) fly(targetOf(spot)); else frameAll(candidates);
  }
  function withoutAi(id: string, text: string, language: string) {
    commit(review => logMessage(review, { text, language, answer: null, spot: null }, id));
    setPending(null); setLine(w.line.manual);
  }
  async function download() {
    if (!place || busy) return;
    setBusy('download');
    const next = await prepareModel(setModel);
    setModel(next); setBusy(null);
    if (next.status === 'ready') { setStored(true); void prepareSite(place); }
  }
  /** Her tap files the message on a spot; the model learns from it when the spot is one it can suggest. */
  function file(id: string, target: Target) {
    const message = messageOf(id); if (!message) return;
    const key = keyOf(target);
    commit(review => updateMessage(review, id, { spot: key }));
    setLine(w.line.linked); fly(target);
    if (place?.features.some(feature => feature.id === key)) void remember(message.text, place, key);
  }
  function paste() {
    const text = draft.trim(); if (!text) return;
    const id = crypto.randomUUID();
    setDraft('');
    void read(id, text, draftLang);
  }

  // Map content
  const current = pane.kind === 'message' ? messageOf(pane.id) : null;
  // The map ranks the suggested spots until the message is placed; then only where it went is marked.
  const ranked = pane.kind === 'message' && !current?.spot ? current?.answer?.candidates ?? [] : [];
  const rankOf = (target: Target) => { const rank = ranked.findIndex(key => same(targetOf(key), target)) + 1; return rank || undefined; };
  const filedOn = current?.spot ? targetOf(current.spot) : null;
  const selected: Target | null = pane.kind === 'spot' ? pane.target : filedOn;
  const filedCounts = new Map<string, number>();
  for (const message of review.messages) if (message.spot) filedCounts.set(message.spot, (filedCounts.get(message.spot) ?? 0) + 1);
  /** A marker's name says what she decided and how many visitors wrote about it, since its icon and count are not read aloud. */
  const named = (parts: (string | undefined)[], count: number) => [...parts.filter(Boolean), ...(count ? [w.visitors(count)] : [])].join(', ');
  /** Captions name the kind and how far along the walk; the state is the marker's colour and icon. */
  const along = (from: number) => Math.round(from) === 0 ? w.start : `${Math.round(from)} m`;
  const markers: Marker[] = walk.spots.map(spot => {
    const target: Target = { kind: 'spot', id: spot.id }, fix = isFixed(edits, spot.stretches), count = filedCounts.get(keyOf(target)) ?? 0;
    const state = fix ? 'fixed' : spotState(spot, review) === 'not-barrier' ? 'not-barrier' : spot.kind === 'no-photos' ? 'no-photos' : 'open';
    const subject = subjectOf(spot.findings), tag = `${spot.kind === 'no-photos' ? w.kinds.noPhotos : w.kinds[subject]} · ${along(spot.from)}`;
    const icon = state === 'fixed' ? 'fixed' : state === 'not-barrier' ? 'dismissed' : state === 'no-photos' ? 'no-photos' : subject === 'path' ? iconFor(spot.findings[0]?.concept ?? '') ?? 'path' : subject;
    const status = fix ? editWords.fixedOn(recordDate(fix.at, lang)) : state === 'not-barrier' ? w.removed : undefined;
    return { id: spot.id, at: spot.at, state, selected: same(selected, target), rank: rankOf(target), count, tag, icon, label: named([spotName(spot), status], count) };
  });
  for (const spot of edits.added) {
    const target: Target = { kind: 'added', id: spot.id }, at = pointOf(target), fix = isFixed(edits, [spot.stretch]), count = filedCounts.get(spot.id) ?? 0;
    if (at) markers.push({ id: `added:${spot.id}`, at, state: fix ? 'fixed' : 'barrier', selected: same(selected, target), rank: rankOf(target), count,
      tag: `${editWords.kinds[spot.kind]} · ${along(data.stretches[spot.stretch].from)}`, icon: fix ? 'fixed' : 'added',
      label: named([addedName(spot.id), fix ? editWords.fixedOn(recordDate(fix.at, lang)) : editWords.addedBy], count) });
  }
  const extra: Target[] = [...ranked.map(targetOf).filter((target): target is Target => !!target && (target.kind === 'landmark' || target.kind === 'stretch')), ...(selected && (selected.kind === 'landmark' || selected.kind === 'stretch') ? [selected] : [])];
  for (const target of extra) {
    const id = target.kind === 'landmark' ? `landmark:${target.id}` : `stretch:${(target as { index: number }).index}`, at = pointOf(target);
    if (!at || markers.some(marker => marker.id === id)) continue;
    markers.push({ id, at, state: target.kind === 'landmark' ? 'landmark' : 'clear', selected: same(selected, target), rank: rankOf(target), label: nameOf(target) });
  }
  function markerTarget(id: string): Target | null {
    if (id.startsWith('landmark:')) return { kind: 'landmark', id: id.slice(9) };
    if (id.startsWith('stretch:')) return { kind: 'stretch', index: Number(id.slice(8)) };
    if (id.startsWith('added:')) return { kind: 'added', id: id.slice(6) };
    return walk.spots.some(spot => spot.id === id) ? { kind: 'spot', id } : null;
  }
  function tapTarget(target: Target) {
    if (pane.kind === 'message' && current) file(current.id, target); else openSpot(target);
  }
  function tapPhoto(viewId: string) {
    const stretch = data.stretches.find(item => item.views.includes(viewId)); if (!stretch) return;
    const spot = spotOf(stretch.index);
    if (spot) { openSpot({ kind: 'spot', id: spot.id }); const index = spot.findings.filter(f => f.viewId && views.has(f.viewId)).findIndex(f => f.viewId === viewId); if (index > 0) setPage(index); }
    else openSpot({ kind: 'stretch', index: stretch.index });
  }
  function tapMap(at: Point, k: number) {
    const index = nearestStretch(data, walk, at), stretch = index === null ? null : data.stretches[index];
    const distance = stretch ? Math.min(...stretch.line.map(walk.project).map(p => Math.hypot(p[0] - at[0], p[1] - at[1]))) : Infinity;
    if (!stretch || distance * k > 28) return;
    const spot = spotOf(stretch.index), addedHere = edits.added.find(item => item.stretch === stretch.index);
    tapTarget(spot ? { kind: 'spot', id: spot.id } : addedHere ? { kind: 'added', id: addedHere.id } : { kind: 'stretch', index: stretch.index });
  }
  const highlight = selected?.kind === 'spot' ? walk.spots.find(spot => spot.id === selected.id)?.path ?? null
    : selected && (selected.kind === 'stretch' || selected.kind === 'added') ? stretchesOf(selected).flatMap(index => data.stretches[index].line.map(walk.project)) : null;
  const labels = useMemo(() => {
    const endName = (name: string) => routeSpots.find(spot => !spot.stretches.length && spot.landmark === name)?.name[lang] ?? fromRecord(name, lang);
    return [...(walk.start ? [{ name: endName(walk.start.name), at: walk.start.at, dy: 20 }] : []), { name: endName(walk.target.name), at: walk.target.at, dy: 22 }, ...walk.landmarks.filter(l => l.kind === 'building' || l.kind === 'street').map(l => ({ name: l.kind === 'street' && !/^calle /i.test(l.name) ? `Calle ${l.name}` : l.name, at: l.at }))];
  }, [walk, lang, routeSpots]);
  const shownView = (() => {
    if (pane.kind !== 'spot') return '';
    const target = pane.target;
    if (target.kind === 'spot') { const spot = walk.spots.find(item => item.id === target.id); const evidence = spot ? spot.findings.filter(f => f.viewId && views.has(f.viewId)) : []; return evidence[Math.min(page, evidence.length - 1)]?.viewId ?? ''; }
    const index = stretchesOf(target)[0];
    return index === undefined ? '' : data.stretches[index]?.views.find(id => views.has(id)) ?? '';
  })();

  // Visitor-facing text, from fixed templates and her own records only
  function replyText(message: LoggedMessage, language: VisitorLang) {
    const answer = message.answer;
    if (answer?.status === 'ready' && answer.kind === 'praise') return REPLY.praise[language]();
    if (answer?.status === 'ready' && answer.kind === 'question') return REPLY.question[language]();
    const target = message.spot ? targetOf(message.spot) : null;
    if (!target || target.kind === 'landmark' || target.kind === 'stretch') return REPLY.open[language]();
    const stretches = stretchesOf(target), fix = isFixed(edits, stretches);
    const spot = target.kind === 'spot' ? walk.spots.find(item => item.id === target.id) ?? null : null;
    if (spot?.kind === 'no-photos') return REPLY.open[language]();
    const subject = spot ? subjectOf(spot.findings) : subjectOfKind(added(target.id)?.kind ?? 'other');
    const at = spot ? whereOf(spot) : where(null, names), from = spot ? spot.from : data.stretches[stretches[0]].from;
    if (fix) return `${REPLY.check[language]().split('.')[0]}. ${fixedLine(spot ? kindOfSubject(subject) : added(target.id)!.kind, at, from, fix.at, language)}`;
    if (removed(stretches)) return REPLY['not-barrier'][language]();
    return REPLY.barrier[language](subject, at);
  }
  function noteText(language: VisitorLang) {
    const lines: string[] = [];
    let steps = false;
    for (const spot of walk.spots.filter(item => item.kind === 'flagged')) {
      const fix = isFixed(edits, spot.stretches), subject = subjectOf(spot.findings);
      if (fix) lines.push(fixedLine(kindOfSubject(subject), whereOf(spot), spot.from, fix.at, language));
      else if (!removed(spot.stretches)) { lines.push(NOTE.barrier[language](subject, whereOf(spot), Math.round(spot.from))); steps ||= subject === 'steps'; }
      const own = noteOf(edits, routeSpotFor(spot.stretches)?.id ?? spot.id); if (own) lines.push(...ownNoteLines(own, language));
    }
    for (const spot of edits.added) {
      const fix = isFixed(edits, [spot.stretch]), stretch = data.stretches[spot.stretch], at = where(null, names);
      const near = locate(spot.stretch).landmark, here: Where = near ? { en: `near ${near}`, es: `cerca de ${near}`, ko: near } : at;
      if (fix) lines.push(fixedLine(spot.kind, here, stretch.from, fix.at, language));
      else { lines.push(NOTE.barrier[language](subjectOfKind(spot.kind), here, Math.round(stretch.from))); steps ||= spot.kind === 'steps'; }
      lines.push(...ownNoteLines(spot.note, language));
    }
    if (!lines.length) return '';
    const end = (name: string) => { const spot = routeSpots.find(item => !item.stretches.length && item.landmark === name); return !spot ? name : language === 'ko' ? spot.aliases.ko?.[0] ?? spot.name.en : spot.name[language]; };
    const head = walk.start ? NOTE.title[language](end(walk.start.name), end(walk.target.name), Math.round(data.lengthMetres)) : data.title;
    return [head, ...lines, ...(steps ? [NOTE.steps[language]] : []), NOTE.basis[language]].join('\n');
  }
  function copy(text: string) { navigator.clipboard.writeText(text).then(() => setSaid(w.copied), () => setSaid(t.copyFailed)); }

  // Panels
  const counts = (() => {
    const kept = walk.spots.filter(spot => spot.kind === 'flagged' && !removed(spot.stretches) && !isFixed(edits, spot.stretches));
    const by: Record<Subject, number> = { steps: 0, kerb: 0, path: 0 };
    for (const spot of kept) by[subjectOf(spot.findings)]++;
    for (const spot of edits.added) if (!isFixed(edits, [spot.stretch])) by[subjectOfKind(spot.kind)]++;
    return { ...by, noPhotos: walk.spots.filter(spot => spot.kind === 'no-photos').length };
  })();
  const raised = [...filedCounts].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const rows = [...review.messages.filter(message => !message.id.startsWith('example-')).map(message => ({ id: message.id, text: message.text, language: message.language, example: false })),
    ...examples.map(example => ({ ...example, example: true }))];
  const note = noteText(noteLang);

  const inbox = <>
    <p className="ri-guide">{w.guide}</p>
    <section className="ri-summary" aria-label={w.found}>
      <p className="ri-meta">{w.found}</p>
      <ul className="ri-counts">{(['steps', 'kerb', 'path', 'noPhotos'] as const).filter(kind => counts[kind]).map(kind => <li key={kind}><KindMark kind={kind} />{w.kinds[kind]} <b>{counts[kind]}</b></li>)}</ul>
      {raised.length > 0 && <p className="ri-raised"><span className="ri-meta">{w.raised}</span> {raised.map(([key, n]) => `${nameOfKey(key)} (${n})`).join(' · ')}</p>}
      {note && <div className="ri-note">
        <span>{w.note}</span>
        <div className="ri-langs" role="group" aria-label={w.note}>{VISITOR_LANGS.map(item => <button key={item.id} aria-pressed={noteLang === item.id} onClick={() => setNoteLang(item.id)} lang={item.id}>{item.id.toUpperCase()}</button>)}</div>
        <button className="ri-text" onClick={() => copy(note)}>{w.copy}</button>
      </div>}
    </section>
    <h2 className="ri-heading">{w.messages}</h2>
    <ul className="ri-list">{rows.map(row => {
      const message = messageOf(row.id), answer = message?.answer;
      return <li key={row.id}><button className="ri-row" data-row={row.id} onClick={() => void read(row.id, row.text, row.language)}>
        <span className="ri-lang" lang={row.language === 'other' ? undefined : row.language}>{row.language.toUpperCase()}</span>
        <span className="ri-row-main">
          <span className="ri-excerpt" lang={row.language === 'other' ? undefined : row.language}>{row.text}</span>
          <span className="ri-row-meta">{row.example && <em>{w.example}</em>}{message ? message.spot ? nameOfKey(message.spot) : w.notFiled : w.unread}</span>
        </span>
        {answer?.kind && answer.status === 'ready' ? <KindIcon kind={answer.kind} /> : message ? <KindIcon kind={null} /> : null}
      </button></li>;
    })}</ul>
    <div className="ri-foot">
      <button className="ri-text" onClick={() => setPane({ kind: 'paste' })}>+ {w.add}</button>
      {(review.messages.length > 0 || Object.keys(review.decisions).length > 0 || edits.added.length > 0 || Object.keys(edits.fixed).length > 0) && (clearing
        ? <span className="ri-confirm">{w.startOverAsk} <button className="ri-text" onClick={() => { commit(startOver); edit(clearEdits); if (place) void forgetPlace(place.id); setClearing(false); }}>{w.clear}</button><button className="ri-text ri-muted" onClick={() => setClearing(false)}>{w.keep}</button></span>
        : <button className="ri-text ri-muted" onClick={() => setClearing(true)}>{w.startOver}</button>)}
    </div>
  </>;

  const pastePane = <>
    <Back onClick={home} label={w.back} />
    <p className="ri-lead">{w.paste}</p>
    <textarea className="ri-input" value={draft} maxLength={500} placeholder={t.messagePlaceholder} aria-label={t.message} onChange={event => { setDraft(event.target.value); setDraftLang(guessLanguage(event.target.value)); }} />
    <div className="ri-actions">
      <select className="ri-select" value={draftLang} aria-label={t.language} onChange={event => setDraftLang(event.target.value)}>{MESSAGE_LANGS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <button className="ri-primary" disabled={!draft.trim()} onClick={paste}>{w.read}</button>
    </div>
  </>;

  const messagePane = (() => {
    if (pane.kind !== 'message') return null;
    const message = current, shown = message ?? pending;
    if (!shown) return null;
    const answer = message?.answer ?? null, language = shown.language;
    const replyIn = replyLang ?? replyLanguage(language);
    const isExample = shown.id.startsWith('example-'), earlier = !!answer && readNow !== shown.id && pending?.id !== shown.id;
    return <>
      <Back onClick={home} label={w.back} />
      <p className="ri-row-meta">{isExample && <em>{w.example}</em>}<span className="ri-lang">{language.toUpperCase()}</span>{w.languages[language] ?? language}{answer?.kind && <> · {answer.status === 'ready' ? t.kinds[answer.kind] : `${t.kinds[answer.kind]}?`}</>}{earlier && <> · {w.readEarlier}</>}</p>
      <blockquote className="ri-quote" lang={language === 'other' ? undefined : language}>{shown.text}</blockquote>
      {!message && !ai && <div className="ri-actions">
        {(downloadBytes || model.status === 'downloading') ? <button className="ri-primary" disabled={!!busy} onClick={() => void download()}>{model.status === 'downloading' ? t.downloadProgress(Math.round(model.loadedBytes / 1e6), Math.round(model.totalBytes / 1e6)) : t.download(Math.max(1, Math.round(downloadBytes! / 1e6)))}</button> : null}
        <button className="ri-text" onClick={() => withoutAi(shown.id, shown.text, language)}>{t.withoutAi}</button>
      </div>}
      {line && <Assistant working={busy === 'reading' || busy === 'download'} text={busy === 'download' ? t.downloading : line} />}
      {answer && answer.candidates.length > 0 && <>
        <h2 className="ri-heading">{w.about}</h2>
        <ol className="ri-list ri-about">{answer.candidates.map((key, index) => { const target = targetOf(key); return target && <li key={key}>
          <button className="ri-row" aria-pressed={message?.spot === key} onClick={() => message?.spot === key ? openSpot(target) : file(shown.id, target)}><span className="ri-rank">{index + 1}</span><span className="ri-row-main">{nameOf(target)}</span>{message?.spot === key && <span className="ri-filed">{w.placed}</span>}</button>
        </li>; })}</ol>
      </>}
      {message?.spot && !answer?.candidates.includes(message.spot) && <p className="ri-filedline"><button className="ri-text" onClick={() => { const target = targetOf(message.spot!); if (target) openSpot(target); }}>{w.filed(nameOfKey(message.spot))}</button></p>}
      {message && <>
        <h2 className="ri-heading">{w.reply}</h2>
        <div className="ri-langs" role="group" aria-label={w.reply}>{VISITOR_LANGS.map(item => <button key={item.id} aria-pressed={replyIn === item.id} onClick={() => setReplyLang(item.id)} lang={item.id}>{item.label}</button>)}</div>
        <p className="ri-reply" lang={replyIn}>{replyText(message, replyIn)}</p>
        <div className="ri-actions"><button className="ri-primary" onClick={() => copy(replyText(message, replyIn))}><CopyIcon />{w.copyReply}</button>{said && <span className="ri-said" role="status">{said}</span>}</div>
      </>}
    </>;
  })();

  const spotPane = (() => {
    if (pane.kind !== 'spot') return null;
    const target = pane.target, stretches = stretchesOf(target), name = nameOf(target);
    const spot = target.kind === 'spot' ? walk.spots.find(item => item.id === target.id) ?? null : null;
    const evidence = spot ? spot.findings.filter(f => (f.viewId && views.has(f.viewId)) || f.osm) : [];
    const shown = evidence[Math.min(page, Math.max(0, evidence.length - 1))] ?? null;
    const plainView = !spot || spot.kind === 'no-photos' ? stretches.length ? data.stretches[stretches[0]]?.views.map(id => views.get(id)).find(Boolean) ?? null : null : null;
    const fix = stretches.length ? isFixed(edits, stretches) : null, gone = stretches.length > 0 && removed(stretches);
    const key = keyOf(target), filed = review.messages.filter(message => message.spot === key);
    const own = noteOf(edits, key);
    const flagged = spot?.kind === 'flagged', mine = target.kind === 'added', clear = target.kind === 'stretch';
    const view = shown?.viewId ? views.get(shown.viewId)! : plainView;
    const outlines = view ? data.findings.filter(f => f.viewId === view.id) : [];
    return <>
      <Back onClick={home} label={w.back} />
      <h2 className="ri-title">{name}</h2>
      <p className="ri-row-meta">{mine && <em>{editWords.addedBy}</em>}{fix && <em>{editWords.fixedOn(recordDate(fix.at, lang))}</em>}{gone && <em>{w.removed}</em>}{clear && w.clearHere}{spot?.kind === 'no-photos' && t.noPhotos}</p>
      {view && <PhotoWithMarks view={view} photo={photos.get(view.photoId)} asset={asset} lang={lang} marks={outlines} lead={shown} t={t}
        pager={evidence.length > 1 ? { at: Math.min(page, evidence.length - 1), total: evidence.length, go: setPage } : null} />}
      {shown?.osm && !shown.viewId && <p className="ri-row-meta">{fromRecord(shown.label, lang)} · {t.mapRecord}</p>}
      {view && outlines.length > 0 && <ul className="ri-legend">{[...new Map([...outlines].sort((a, b) => Number(b.barrier) - Number(a.barrier)).map(f => [f.concept, f])).values()].map(f => <li key={f.concept}><span className={`ri-swatch${f.barrier ? '' : ' is-quiet'}`} aria-hidden="true" />{fromRecord(f.label, lang)}</li>)}<li className="ri-meta">{w.suggestion}</li></ul>}
      <h2 className="ri-heading">{w.visitors(filed.length)}</h2>
      {filed.length > 0 && <ul className="ri-list">{filed.map(message => <li key={message.id}><button className="ri-row" onClick={() => void read(message.id, message.text, message.language)}><span className="ri-lang">{message.language.toUpperCase()}</span><span className="ri-row-main"><span className="ri-excerpt" lang={message.language === 'other' ? undefined : message.language}>{message.text}</span></span></button></li>)}</ul>}
      {own?.text && editing !== 'note' && <p className="ri-own"><span className="ri-meta">{editWords.yourNote}</span> {own.text}</p>}
      {editing === 'add' && clear ? <AddSpot words={editWords} where={locate(target.index).landmark} range={{ from: Math.round(data.stretches[target.index].from), to: Math.round(data.stretches[target.index].to) }} guess={noteLanguage}
          onAdd={(kind, text) => { const next = addSpot(latestEdits.current, target.index, kind, text); edit(() => next); setEditing(null); const id = next.added[next.added.length - 1]?.id; if (id) openSpot({ kind: 'added', id }, false); }} onCancel={() => setEditing(null)} />
        : editing === 'fix' ? <MarkFixed words={editWords} spot={name} date={recordDate(new Date().toISOString(), lang)} guess={noteLanguage} onFix={text => { edit(edits => markFixed(edits, stretches, text)); setEditing(null); }} onCancel={() => setEditing(null)} />
        : editing === 'note' ? <OwnNoteEditor words={editWords} value={own ?? undefined} guess={noteLanguage} onSave={text => { edit(edits => setNote(edits, key, text)); setEditing(null); }} onCancel={() => setEditing(null)} />
        : <div className="ri-tools">
          {clear && <button className="ri-text" onClick={() => setEditing('add')}>+ {w.addHere}</button>}
          {(flagged || mine) && !fix && !gone && <button className="ri-text" onClick={() => setEditing('fix')}>{editWords.fix}</button>}
          {fix && <button className="ri-text ri-muted" onClick={() => edit(edits => clearFixed(edits, stretches))}>{editWords.undoFix}</button>}
          {!clear && <button className="ri-text" onClick={() => setEditing('note')}>{editWords.yourNote}</button>}
          {flagged && !fix && <button className="ri-text ri-muted" onClick={() => commit(review => decide(review, stretches, gone ? null : 'not-barrier'))}>{gone ? w.restore : w.remove}</button>}
        </div>}
    </>;
  })();

  const content = pane.kind === 'paste' ? pastePane : pane.kind === 'message' ? messagePane : pane.kind === 'spot' ? spotPane : inbox;
  useLayoutEffect(() => {
    const element = sheet.current, canvas = root.current;
    if (!element || !canvas) return;
    const measure = () => { setSheetHeight(narrow ? element.offsetHeight : 0); canvas.style.setProperty('--sheet', narrow ? `${element.offsetHeight}px` : '0px'); };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, [narrow]);
  const insets = mapInsets(narrow, sheetHeight);

  const shownPlace: MenuPlace | undefined = data.id === 'cusco-qorikancha' ? data.id : undefined;
  return <main ref={root} className="route-inbox route-canvas" data-pane={pane.kind} data-peek={peeking || undefined} style={{ '--peek': `${PEEK}px` } as CSSProperties} aria-label={t.workspace} lang={lang} onKeyDown={event => { if (event.key === 'Escape' && pane.kind !== 'inbox') home(); }}>
    <header className="ri-bar">
      <div className="ri-place"><h1>{DESTINATIONS[data.id].name}</h1><p>{t.walk(walk.start?.name ?? data.title, Math.round(data.lengthMetres))}</p></div>
      <Menu onHome={onHome} current={shownPlace} onPlace={place => { if (place !== shownPlace) (onPlace ?? onHome)(place); }} />
    </header>
    <aside className="ri-panel" ref={sheet} aria-label={pane.kind === 'inbox' ? w.messages : undefined}
      onPointerDown={event => { swiped.current = false; swipe.current = narrow && pane.kind === 'inbox' ? { id: event.pointerId, y: event.clientY, handle: !!(event.target as HTMLElement).closest('.ri-handle') } : null; }}
      onPointerMove={event => {
        const start = swipe.current; if (!start || start.id !== event.pointerId) return;
        const dy = event.clientY - start.y;
        if ((peeking && dy < -24) || (!peeking && start.handle && dy > 24)) { swipe.current = null; swiped.current = true; lift(peeking); }
      }}
      onPointerUp={() => { swipe.current = null; }} onPointerCancel={() => { swipe.current = null; }}
      onClickCapture={event => { if (swiped.current) { swiped.current = false; event.stopPropagation(); event.preventDefault(); } }}
      onFocus={event => { if (peeking && (event.target as HTMLElement).matches(':focus-visible')) lift(true); }}>
      {narrow && pane.kind === 'inbox' && <button className="ri-handle" aria-label={w.messages} aria-expanded={!peeking} onClick={() => lift(peeking)} />}
      {content}
      {problem && <p className="ri-problem" role="alert">{problem}</p>}
    </aside>
    <div className="ri-map">
      <RouteMap ref={map} settled={settled} data={data} photoView={shownView} walk={walk} markers={markers} labels={labels} insets={insets} highlight={highlight}
        onMarker={id => { const target = markerTarget(id); if (target) tapTarget(target); }} onMap={tapMap} onPhoto={pane.kind === 'message' ? undefined : tapPhoto} words={t.map} clearBottom={narrow ? sheetHeight + 12 : 24} ariaLabel={data.title} />
    </div>
  </main>;
}

function CopyIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" /></svg>;
}

function Back({ onClick, label }: { onClick: () => void; label: string }) {
  return <button className="ri-back" onClick={onClick}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>{label}</button>;
}

/** The model's voice where it acts: a small mark and one line. */
function Assistant({ text, working }: { text: string; working: boolean }) {
  return <p className="ri-assistant" role="status" aria-live="polite"><span className="ri-spark" data-working={working || undefined} aria-hidden="true" />{text}</p>;
}

function KindIcon({ kind }: { kind: 'problem' | 'praise' | 'question' | null }) {
  const path = kind === 'problem' ? 'M12 4 21 20H3Z M12 10v4 M12 17h.01' : kind === 'praise' ? 'm12 4 2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.3 6.9 19l1.2-5.6L4 9.6l5.6-.6Z' : kind === 'question' ? 'M9.2 9a3 3 0 1 1 4.3 2.7c-.9.4-1.5 1.2-1.5 2.1V15 M12 18h.01' : 'M5 12h.01 M12 12h.01 M19 12h.01';
  return <svg className="ri-kind" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
}

function KindMark({ kind }: { kind: Subject | 'noPhotos' }) {
  return <span className={`ri-dot is-${kind}`} aria-hidden="true" />;
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

/** A recorded photo with every mark the model drew on it: barriers in clay, the rest quiet. */
function PhotoWithMarks({ view, photo, asset, lang, marks, lead, pager, t }: { view: View; photo: Photo | undefined; asset: (file: string) => string; lang: UiLang; marks: readonly Finding[]; lead: Finding | null;
  pager: { at: number; total: number; go: (page: number) => void } | null; t: (typeof COPY)[keyof typeof COPY] }) {
  const [failed, setFailed] = useState(false);
  const [whole, setWhole] = useState(false);
  const zoom = zoomOn(view, lead);
  const date = photo?.capturedAt ? new Date(photo.capturedAt).toLocaleDateString(lang === 'es' ? 'es-PE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const drawn = [...marks].filter(f => f.outline.length > 2).sort((a, b) => Number(a.barrier) - Number(b.barrier));
  const image = <div className="ri-photo-image" style={{ transform: zoom && !whole ? zoom : undefined }}>
    {failed ? <span className="ri-photo-missing" /> : <img src={asset(view.file)} alt={lead ? fromRecord(lead.label, lang) : ''} onError={() => setFailed(true)} />}
    {!failed && drawn.length > 0 && <svg viewBox={`0 0 ${view.width} ${view.height}`} preserveAspectRatio="none" aria-hidden="true">
      {drawn.map(f => <polygon key={f.id} className={f.barrier ? 'ri-outline' : 'ri-outline is-quiet'} points={f.outline.map(p => p.join(',')).join(' ')} />)}
    </svg>}
  </div>;
  return <figure className="ri-photo" style={{ '--ratio': view.height / view.width } as CSSProperties}>
    <div className="ri-photo-box">
      {zoom ? <button className="ri-photo-frame" aria-pressed={whole} onClick={() => setWhole(value => !value)} aria-label={whole ? t.closer : t.whole}>{image}</button> : <div className="ri-photo-frame">{image}</div>}
      {pager && <div className="ri-pager">
        <button className="ri-icon" aria-label={t.previous} onClick={() => pager.go((pager.at + pager.total - 1) % pager.total)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg></button>
        <span>{t.photoOf(pager.at + 1, pager.total)}</span>
        <button className="ri-icon" aria-label={t.next} onClick={() => pager.go((pager.at + 1) % pager.total)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></button>
      </div>}
    </div>
    {photo && <figcaption>{photo.creator}{date ? `, ${date}` : ''}. CC BY-SA 4.0 · {photo.link ? <a href={photo.link} target="_blank" rel="noreferrer">Mapillary</a> : 'Mapillary'}</figcaption>}
  </figure>;
}


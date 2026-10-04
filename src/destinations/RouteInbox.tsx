import { useEffect, useId, useMemo, useRef, useState, useLayoutEffect, type CSSProperties } from 'react';
import { decide, loadReview, logMessage, saveReview, startOver, updateMessage, verdictOf, type LoggedMessage, type ModelAnswer, type Review } from '../decisions/store';
import { addSpot, clearEdits, clearFixed, isFixed, loadEdits, markFixed, noteOf, saveEdits, setNote, type EditKind, type Edits } from '../edits/store';
import { addedFeature, fixedLine, ownNoteLines, withEdits, type Locate } from '../edits/place';
import { KIND_WORDS, recordDate } from '../edits/words';
import { forgetPlace, modelDownloadBytes, modelState, modelStored, prepareModel, prepareSite, remember, understand, type ModelState } from '../language/understand';
import { ROUTE_PLACES } from '../site/registry';
import type { RoutePlace } from '../site/route';
import { useLanguage } from '../i18n';
import { useEditWords } from '../i18n/edit';
import { fromRecord } from '../i18n/records';
import Menu, { type MenuPlace } from '../home/Menu';
import { COPY, NOTE, REPLY, SUBJECTS, guessLanguage, where, type Subject, type UiLang, type VisitorLang, type Where } from './copy';
import { DESTINATIONS, type Coordinate, type Destination, type Finding, type Photo, type View } from './data';
import { EXAMPLES } from './examples';
import { spotState } from './markers';
import RouteMap, { type Insets, type MapHandle, type Marker } from './RouteMap';
import { buildWalk, midpoint, nearestStretch, type Point, type Spot } from './walk';
import { iconFor } from '../ui/icons';
import AddSpot from './edit/AddSpot';
import MarkFixed from './edit/MarkFixed';
import OwnNoteEditor from './edit/OwnNote';
import { Callout, IconButton, Legend, List, Panel, PrimaryAction, Quote, Row, Section, Segmented, Select, Tag, TextArea, TextButton, VisitorAvatar, markOf, MARK_ORDER, type LegendItem } from '../ui';
import { BackIcon, ChevronIcon, CloseIcon, CopyIcon, DownloadIcon, FixedIcon, KerbIcon, MessageIcon, MoreIcon, NoPhotosIcon, NoteIcon, PathIcon, PinIcon, PlusIcon, PointerIcon, PraiseIcon, ProblemIcon, QuestionIcon, RemoveIcon, RotateIcon, StepsIcon, UndoIcon, AddedIcon } from '../ui/icons';
import Swap from '../fx/Swap';
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
/** Whether the model can read a message at all: it knows Latin and Hangul letters only. */
const readable = (text: string) => /[\p{Script=Latin}\p{Script=Hangul}]/u.test(text);
const replyLanguage = (language: string): VisitorLang => language === 'es' || language === 'ko' ? language : language === 'qu' ? 'es' : 'en';
const noteLanguage = (text: string) => guessLanguage(text);
const VISITOR_LANGS: { id: VisitorLang; label: string }[] = [{ id: 'en', label: 'English' }, { id: 'es', label: 'Español' }, { id: 'ko', label: '한국어' }];
const MESSAGE_LANGS = [...VISITOR_LANGS, { id: 'qu', label: 'Runasimi' }, { id: 'other', label: 'Other' }];

/** The screen's safe-area insets (status bar, home indicator, notch), read from CSS and kept until the window changes size. */
let safe: Insets | null = null;
function safeArea(): Insets {
  if (safe) return safe;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  safe = { top: parseFloat(style.paddingTop) || 0, right: parseFloat(style.paddingRight) || 0, bottom: parseFloat(style.paddingBottom) || 0, left: parseFloat(style.paddingLeft) || 0 };
  probe.remove();
  return safe;
}
if (typeof window !== 'undefined') addEventListener('resize', () => { safe = null; });

/**
 * Where the walk is framed: clear of the panel on wide screens and of the sheet on phones, inside the safe area.
 * The first fit uses no sheet height. The reveal frames with the same function, so the two stay matched on any device.
 */
export const mapInsets = (narrow: boolean, sheetHeight = 0): Insets => {
  const inset = safeArea();
  return narrow ? { top: 110 + inset.top, right: 20 + inset.right, bottom: Math.max(180 + inset.bottom, sheetHeight + 20), left: 20 + inset.left }
    : { top: 100 + inset.top, right: 430 + inset.right, bottom: 50 + inset.bottom, left: 50 + inset.left };
};

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
export default function RouteInbox({ data, asset, onHome, onPlace, settled = false, spots, caption }: { data: Destination; asset: (file: string) => string; onHome: () => void; onPlace?: (place: MenuPlace) => void; settled?: boolean;
  /** The spots of a walk built on this device, which the registry does not list. Keep the same object between renders. */
  spots?: RoutePlace;
  /** One plain line under the walk, such as where its findings came from. */
  caption?: string }) {
  const { lang } = useLanguage();
  const editWords = useEditWords();
  const t = COPY[lang], w = t.inbox;
  const narrow = useNarrow();
  const walk = useMemo(() => buildWalk(data), [data]);
  const authored = spots ?? ROUTE_PLACES[data.id] ?? null;
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
  const [downloadBytes, setDownloadBytes] = useState<number | null | undefined>(undefined);
  /** Why a download she started gave no model: every byte arrived but this device did not keep them (private browsing, low storage), or it stopped. */
  const [unkept, setUnkept] = useState<'not-kept' | 'stopped' | null>(null);
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
      ko: spot.from === 0 && walk.start ? routeSpots.find(item => !item.stretches.length && item.landmark === walk.start!.name)?.aliases.ko?.[0] ?? where(walk.start, names).ko : landmark?.aliases.ko?.[0] ?? fallback.ko,
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
  /** Every mark the scan outlined on a photo; a package without a scan has only its findings. */
  const findingLabels = useMemo(() => new Map(data.findings.map(f => [f.id, f.label])), [data.findings]);
  const marksOn = (viewId: string): PhotoMark[] => {
    // A mark that is one of the place's findings keeps the finding's own words.
    const scanned = data.marks.filter(mark => mark.viewId === viewId && mark.outline.length > 2).map(mark => ({ ...mark, label: (mark.finding && findingLabels.get(mark.finding)) || mark.label, named: !!mark.finding }));
    return scanned.length ? scanned : data.findings.filter(f => f.viewId === viewId).map(f => ({ ...f, flagged: f.barrier, named: true }));
  };

  // Panels and camera
  const [pane, setPane] = useState<Pane>({ kind: 'inbox' });
  const paneNow = useRef(pane);
  paneNow.current = pane;
  // On a phone behind the reveal, the sheet starts low and the map keeps the reveal's framing; a swipe or a tap lifts it.
  const [peek, setPeek] = useState(settled);
  const peeking = narrow && peek && pane.kind === 'inbox';
  useEffect(() => { if (pane.kind !== 'inbox') setPeek(false); }, [pane.kind]);
  // Once the sheet has moved, the walk is framed again in the map left above it.
  function lift(open: boolean) {
    setPeek(!open); aim({ kind: 'fit' });
    if (!open) sheet.current?.scrollTo({ top: 0 });
  }
  const swipe = useRef<{ id: number; y: number; handle: boolean } | null>(null);
  const swiped = useRef(false);
  // Hover: a marker under a fine pointer or at keyboard focus, or the marker a row in the panel points at.
  // On a wide screen a marker hovered on the map previews its spot in the panel; a click pins it.
  const [hover, setHover] = useState<{ id: string; from: 'map' | 'row' } | null>(null);
  const leave = useRef(0);
  function hoverFrom(from: 'map' | 'row', id: string | null) {
    clearTimeout(leave.current);
    if (id) setHover({ id, from });
    // Sliding from one marker to the next crosses the map, so the panel waits a beat before it comes back.
    else leave.current = window.setTimeout(() => setHover(now => now?.from === from ? null : now), from === 'map' ? 90 : 0);
  }
  useEffect(() => () => clearTimeout(leave.current), []);
  // A marker that slides under a still pointer while the camera moves is not hovered: only a pointer that moved, or keyboard focus, counts.
  const moved = useRef(0), still = useRef(0);
  useEffect(() => {
    let last: [number, number] | null = null;
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || (last && Math.abs(event.clientX - last[0]) + Math.abs(event.clientY - last[1]) < 1)) return;
      last = [event.clientX, event.clientY]; moved.current = performance.now();
    };
    addEventListener('pointermove', move, { passive: true });
    return () => removeEventListener('pointermove', move);
  }, []);
  const entering = useRef<string | null>(null);
  function hoverMap(id: string | null) {
    if (restoring.current) return;
    entering.current = id;
    if (!id || document.activeElement?.matches('.route-marker:focus-visible')) { hoverFrom('map', id); return; }
    // The move that brings the pointer onto a marker is dispatched after the marker hears it enter, so decide on the next frame.
    requestAnimationFrame(() => {
      const now = performance.now();
      if (entering.current === id && now - moved.current < 150 && now >= still.current) hoverFrom('map', id);
    });
  }
  const pointAt = (target: Target | null) => ({
    onPointerEnter: (event: { pointerType: string }) => { if (target && event.pointerType !== 'touch') hoverFrom('row', markerIdOf(target)); },
    onPointerLeave: () => hoverFrom('row', null),
    onFocus: (event: { currentTarget: HTMLElement }) => { if (target && event.currentTarget.matches(':focus-visible')) hoverFrom('row', markerIdOf(target)); },
    onBlur: () => hoverFrom('row', null),
  });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Editing>(null);
  const [line, setLine] = useState('');
  const [draft, setDraft] = useState('');
  const [draftLang, setDraftLang] = useState('en');
  const [replyLang, setReplyLang] = useState<VisitorLang | null>(null);
  const [noteLang, setNoteLang] = useState<VisitorLang>(lang);
  useEffect(() => setNoteLang(lang), [lang]);
  const [said, setSaid] = useState('');
  const [clearing, setClearing] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [marksOpen, setMarksOpen] = useState(false), marksId = useId();
  const [sheetHeight, setSheetHeight] = useState(0);
  // What the map shows for the open pane: the whole walk, or the spots an answer points to. On a phone it waits until the sheet has
  // settled, since a new pane or an answer easing in changes its height, then frames them in the map the sheet leaves free, and
  // follows the sheet for a moment longer; a tap or wheel on the map, or a flight to one spot, lets it go.
  type Aim = { kind: 'fit' } | { kind: 'frame'; points: Point[] };
  const aiming = useRef<{ aim: Aim; until: number } | null>(null), aimTimer = useRef(0);
  function aim(next: Aim | null) {
    aiming.current = next && { aim: next, until: performance.now() + 1200 };
    clearTimeout(aimTimer.current);
    if (next) aimTimer.current = window.setTimeout(applyAim, narrow ? 140 : 0);
  }
  function applyAim() {
    const now = aiming.current?.aim;
    if (!now || !map.current) return;
    if (now.kind === 'fit') { map.current.fit(true); return; }
    const inset = safeArea();
    map.current.frame(now.points, narrow ? { top: 130 + inset.top, right: 30 + inset.right, bottom: (sheet.current?.offsetHeight ?? 300) + 20 + inset.bottom, left: 30 + inset.left }
      : { top: 110 + inset.top, right: 440 + inset.right, bottom: 60 + inset.bottom, left: 60 + inset.left });
  }
  useEffect(() => {
    if (!aiming.current || performance.now() > aiming.current.until) return;
    clearTimeout(aimTimer.current);
    aimTimer.current = window.setTimeout(applyAim, narrow ? 140 : 0);
  }, [sheetHeight]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const letGo = (event: Event) => { if ((event.target as Element | null)?.closest?.('.ri-map')) aiming.current = null; };
    addEventListener('pointerdown', letGo, true);
    addEventListener('wheel', letGo, { capture: true, passive: true });
    return () => { removeEventListener('pointerdown', letGo, true); removeEventListener('wheel', letGo, true); clearTimeout(aimTimer.current); };
  }, []);
  function fly(target: Target | null) {
    const at = target && pointOf(target);
    if (!at || !map.current) return;
    aim(null);
    const { width, height, fitK } = map.current.size();
    const screen: Point = narrow ? [width / 2, Math.max(150, (height - sheetHeight) * 0.55)] : [Math.max(260, (width - 400) * 0.5), height * 0.5];
    map.current.focus(at, screen, fitK * 1.8);
  }
  /** The spots an answer points to, framed together; without any, the whole walk. */
  function frameAll(keys: readonly string[]) {
    const points = keys.map(targetOf).filter((target): target is Target => !!target).map(pointOf).filter((point): point is Point => !!point);
    aim(points.length ? { kind: 'frame', points } : { kind: 'fit' });
  }
  function openSpot(target: Target, move = true) {
    setPane({ kind: 'spot', target }); setPage(0); setEditing(null); setSaid('');
    if (move) fly(target);
  }
  function home() { setPane({ kind: 'inbox' }); setEditing(null); setSaid(''); setLine(''); aim({ kind: 'fit' }); }
  // An editor opened low in the panel scrolls into view, so a phone shows it above the fold, and stays in view as it grows
  // (typing adds the row for the note's language).
  useEffect(() => {
    const editor = editing ? sheet.current?.querySelector('section[class*=edit]') : null;
    if (!editor) return;
    const show = () => editor.scrollIntoView({ block: 'nearest', behavior: quiet() ? 'auto' : 'smooth' });
    const observer = new ResizeObserver(show);
    observer.observe(editor);
    return () => observer.disconnect();
  }, [editing]);
  // Focus follows the panel: into a pane when it opens, back to the row or the marker that opened it on return.
  const lastRow = useRef<string | null>(null);
  const opener = useRef<string | null>(null), restoring = useRef(false);
  useEffect(() => {
    const panel = sheet.current; if (!panel) return;
    if (pane.kind !== 'inbox') { panel.querySelector<HTMLElement>('.ri-back')?.focus({ preventScroll: true }); return; }
    const row = lastRow.current && panel.querySelector<HTMLElement>(`[data-row="${CSS.escape(lastRow.current)}"]`);
    const label = !row && opener.current ? markers.find(marker => marker.id === opener.current)?.label : null;
    const marker = label ? root.current?.querySelector<HTMLElement>(`.route-marker[aria-label="${CSS.escape(label)}"]`) : null;
    // Back on a marker, focus does not preview its spot again: she has just left it.
    if (row) row.focus({ preventScroll: true }); else if (marker) { restoring.current = true; marker.focus({ preventScroll: true }); restoring.current = false; }
    lastRow.current = null; opener.current = null;
  }, [pane.kind]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setPending({ id, text, language }); setLine(''); aim({ kind: 'fit' });
  }
  // A new message is read once the model is ready or found stored on this device, while its pane is open.
  useEffect(() => {
    if (!ai || !pending || pane.kind !== 'message' || pane.id !== pending.id || reading.current === pending.id) return;
    void run(pending.id, pending.text, pending.language);
  }, [ai, pending, pane]); // eslint-disable-line react-hooks/exhaustive-deps
  function show(message: LoggedMessage) {
    setPending(null);
    const answer = message.answer;
    setLine(!answer ? message.spot ? w.line.linked : w.line.manual : lineFor(answer, message.spot, message.text));
    const target = message.spot ? targetOf(message.spot) : null;
    if (target) fly(target); else frameAll(answer?.candidates ?? []);
  }
  function lineFor(answer: ModelAnswer, spot: string | null, text: string) {
    // Placed by her tap, anywhere but where a sure answer filed itself: the line says it is placed.
    if (spot && !(answer.status === 'ready' && spot === answer.candidates[0])) return w.line.linked;
    if (!readable(text)) return w.line.unreadable;
    if (answer.remembered) return w.line.remembered;
    if (answer.status === 'unavailable') return w.line.manual;
    if (!answer.candidates.length) return answer.kind ? w.line.noSpot : w.line.none;
    if (answer.status === 'ready' && spot) return w.line.ready;
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
    // The model reads Latin and Hangul letters only: for any other script its spots are noise, so none is offered.
    const candidates = readable(text) ? result.candidates.filter(key => targetOf(key)).slice(0, 3) : [];
    const answer: ModelAnswer = { status: result.status, kind: result.kind, category: result.category, candidates, model: result.model ? `${result.model.id}@${result.model.revision}` : null, ...(result.reason === 'remembered' ? { remembered: true as const } : {}) };
    // A sure answer files itself on the first spot; she can move it with one tap.
    const spot = answer.status === 'ready' && candidates[0] ? candidates[0] : null;
    commit(review => review.messages.some(message => message.id === id) ? updateMessage(review, id, { answer, spot }) : logMessage(review, { text, language, answer, spot }, id));
    setPending(null); setReadNow(id);
    setLine(lineFor(answer, spot, text));
    // The camera follows the answer only while its message is still open.
    if (paneNow.current.kind !== 'message' || paneNow.current.id !== id) return;
    if (spot) fly(targetOf(spot)); else frameAll(candidates);
  }
  function withoutAi(id: string, text: string, language: string) {
    commit(review => logMessage(review, { text, language, answer: null, spot: null }, id));
    setPending(null); setLine(w.line.manual); aim({ kind: 'fit' });
  }
  async function download() {
    if (!place || busy) return;
    setBusy('download'); setUnkept(null);
    let arrived = false;
    const next = await prepareModel(state => { if (state.status === 'downloading' && state.loadedBytes >= state.totalBytes) arrived = true; setModel(state); });
    setModel(next); setBusy(null);
    if (next.status === 'ready') { setStored(true); void prepareSite(place); }
    // Offering the same download again would only repeat it: say why there is no model, and leave Try again as a choice.
    else setUnkept(arrived ? 'not-kept' : 'stopped');
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
  const pointed = hover?.from === 'row' ? markerTarget(hover.id) : null;
  const extra: Target[] = [...ranked.map(targetOf), selected, pointed].filter((target): target is Target => !!target && (target.kind === 'landmark' || target.kind === 'stretch'));
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
  function markerIdOf(target: Target) {
    return target.kind === 'spot' ? target.id : target.kind === 'added' ? `added:${target.id}` : target.kind === 'landmark' ? `landmark:${target.id}` : `stretch:${target.index}`;
  }
  // What the panel previews: a marker hovered on the map, on a wide screen, unless she is typing or already looking at it.
  const previewing = (() => {
    if (narrow || hover?.from !== 'map' || pane.kind === 'paste' || editing) return null;
    const target = markerTarget(hover.id);
    return target && !(pane.kind === 'spot' && same(pane.target, target)) ? target : null;
  })();
  /** A spot at a glance, laid out as its pane: what it is, its photo with every mark, and the latest of what visitors said there. */
  function previewOf(target: Target) {
    const stretches = stretchesOf(target), spot = target.kind === 'spot' ? walk.spots.find(item => item.id === target.id) ?? null : null;
    const lead = spot?.findings.find(f => f.viewId && views.has(f.viewId)) ?? null;
    const view = lead?.viewId ? views.get(lead.viewId) ?? null : stretches.length ? data.stretches[stretches[0]]?.views.map(id => views.get(id)).find(Boolean) ?? null : null;
    const filed = review.messages.filter(message => message.spot === keyOf(target)), latest = filed[0], said = latest?.language === 'other' ? undefined : latest?.language;
    const fix = stretches.length ? isFixed(edits, stretches) : null, gone = spot?.kind === 'flagged' && removed(stretches);
    const kind = spot ? spot.kind === 'no-photos' ? t.noPhotos : w.kinds[subjectOf(spot.findings)] : target.kind === 'added' ? editWords.kinds[added(target.id)?.kind ?? 'other'] : target.kind === 'stretch' ? w.clearHere : null;
    return <>
      <h2 className="ri-title">{nameOf(target)}</h2>
      <p className="ri-row-meta">{kind}{target.kind === 'added' && <Tag><AddedIcon />{editWords.addedBy}</Tag>}{fix && <Tag tone="route"><FixedIcon />{editWords.fixedOn(recordDate(fix.at, lang))}</Tag>}{gone && <Tag tone="unknown">{w.removed}</Tag>}</p>
      {view && <PhotoWithMarks still view={view} photo={photos.get(view.photoId)} asset={asset} lang={lang} marks={marksOn(view.id)} lead={lead} t={t} />}
      <Section heading="h2" title={w.visitors(filed.length)}>
        {latest && <List inset><Row static icon={<VisitorAvatar id={latest.id} still />} label={<span lang={said}>{latest.text}</span>} meta={<Tag tone="solid" lang={said}>{latest.language.toUpperCase()}</Tag>} /></List>}
      </Section>
    </>;
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
    return [...(walk.start ? [{ name: endName(walk.start.name), at: walk.start.at, dy: 20 }] : []), { name: endName(walk.target.name), at: walk.target.at, dy: 22 }, ...walk.landmarks.filter(l => l.kind === 'building' || l.kind === 'street').map(l => ({ name: routeSpots.find(spot => !spot.stretches.length && spot.landmark === l.name)?.name[lang] ?? (l.kind === 'street' && !/^calle /i.test(l.name) ? `Calle ${l.name}` : l.name), at: l.at }))];
  }, [walk, lang, routeSpots]);
  const shownView = (() => {
    if (pane.kind !== 'spot') return '';
    const target = pane.target;
    if (target.kind === 'spot') { const spot = walk.spots.find(item => item.id === target.id); const evidence = spot ? spot.findings.filter(f => (f.viewId && views.has(f.viewId)) || f.osm) : []; return evidence[Math.min(page, evidence.length - 1)]?.viewId ?? ''; }
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
    const at = spot ? whereOf(spot) : nearOf(stretches[0]), from = spot ? spot.from : data.stretches[stretches[0]].from;
    if (fix) return `${REPLY.check[language]().split('.')[0]}. ${fixedLine(spot ? kindOfSubject(subject) : added(target.id)!.kind, at, from, fix.at, language)}`;
    if (removed(stretches)) return REPLY[data.photos.length ? 'not-barrier' : 'not-barrier-mapped'][language]();
    // What the photos show at a flagged spot; her own words at a spot she added.
    return REPLY.barrier[language]((spot ? SUBJECTS[subject] : KIND_WORDS[added(target.id)?.kind ?? 'other'])[language], at);
  }
  /** Where a spot she added is, by the landmark nearest its stretch, in each visitor language. */
  function nearOf(stretch: number): Where {
    const near = locate(stretch).landmark;
    return near ? { en: `near ${near}`, es: `cerca de ${near}`, ko: near } : where(null, names);
  }
  function noteText(language: VisitorLang) {
    const lines: string[] = [];
    let steps = false;
    for (const spot of walk.spots.filter(item => item.kind === 'flagged')) {
      const fix = isFixed(edits, spot.stretches), subject = subjectOf(spot.findings);
      if (fix) lines.push(fixedLine(kindOfSubject(subject), whereOf(spot), spot.from, fix.at, language));
      else if (!removed(spot.stretches)) { lines.push((spot.findings.some(f => f.viewId) ? NOTE.barrier : NOTE.mapped)[language](subject, whereOf(spot), Math.round(spot.from))); steps ||= subject === 'steps'; }
      const own = noteOf(edits, routeSpotFor(spot.stretches)?.id ?? spot.id); if (own) lines.push(...ownNoteLines(own, language));
    }
    for (const spot of edits.added) {
      const fix = isFixed(edits, [spot.stretch]), stretch = data.stretches[spot.stretch], here = nearOf(spot.stretch);
      if (fix) lines.push(fixedLine(spot.kind, here, stretch.from, fix.at, language));
      else { lines.push(NOTE.added[language](spot.kind, here, Math.round(stretch.from))); steps ||= spot.kind === 'steps'; }
      lines.push(...ownNoteLines(spot.note, language));
    }
    if (!lines.length) return '';
    const end = (name: string) => { const spot = routeSpots.find(item => !item.stretches.length && item.landmark === name); return !spot ? name : language === 'ko' ? spot.aliases.ko?.[0] ?? spot.name.en : spot.name[language]; };
    const head = walk.start ? NOTE.title[language](end(walk.start.name), end(walk.target.name), Math.round(data.lengthMetres)) : data.title;
    return [head, ...lines, ...(steps ? [NOTE.steps[language]] : []), (data.photos.length ? NOTE.basis : NOTE.basisMapped)[language]].join('\n');
  }
  function copy(text: string) { navigator.clipboard.writeText(text).then(() => setSaid(w.copied), () => setSaid(t.copyFailed)); }

  // Panels
  /** Every kind the model marked in the photos within a few metres of the walk, possible barriers first. */
  const scanned: LegendItem[] = [...(data.scan?.kinds ?? [])].filter(kind => kind.nearRoute > 0)
    .sort((a, b) => order(a.concept) - order(b.concept))
    .map(kind => { const Icon = iconFor(kind.concept); return { mark: markOf(kind.concept) ?? undefined, barrier: kind.barrier, icon: Icon ? <Icon size={15} /> : undefined, label: `${fromRecord(kind.label, lang)} ${kind.nearRoute}` }; });
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

  const summary = <>
    <Section heading="h2" title={w.found} label={w.found} className="ri-summary">
      <span className="ri-meta">{w.flaggedSpots}</span>
      <div className="ri-counts">{(['steps', 'kerb', 'path', 'noPhotos'] as const).filter(kind => counts[kind]).map(kind => <Tag key={kind} tone={kind === 'noPhotos' ? 'unknown' : 'barrier'}><KindMark kind={kind} />{w.kinds[kind]} <b>{counts[kind]}</b></Tag>)}</div>
      {/* What the model marked near the walk is there to look into, not to read first: one line until it is opened. */}
      {scanned.length > 0 && <div className="ri-scan">
        <button type="button" className="ri-scan-toggle" aria-expanded={marksOpen} aria-controls={marksId} onClick={() => setMarksOpen(open => !open)}>
          <span>{w.scanned} · {w.scannedKinds(scanned.length)}</span><ChevronIcon size={14} />
        </button>
        <div id={marksId} hidden={!marksOpen}><Legend items={scanned} /></div>
      </div>}
      {raised.length > 0 && <p className="ri-raised"><span className="ri-meta">{w.raised}</span> {raised.map(([key, n]) => `${nameOfKey(key)} (${n})`).join(' · ')}</p>}
      {note && <div className="ri-note">
        <span>{w.note}</span>
        <Segmented label={w.note} value={noteLang} onChange={setNoteLang} options={VISITOR_LANGS.map(item => ({ value: item.id, label: item.id.toUpperCase(), lang: item.id }))} />
        {/* Two lines to read before copying; a tap shows the whole note. */}
        <button type="button" className="ui-callout ri-note-text" lang={noteLang} aria-expanded={noteOpen} onClick={() => setNoteOpen(open => !open)}><Swap value={`${noteOpen} ${note}`} lang={noteLang} className="ri-note-lines">{noteOpen ? note : note.split('\n').slice(0, 2).map((text, i) => <span key={i} className="ri-note-line">{text}</span>)}</Swap></button>
        <TextButton icon={<CopyIcon />} onClick={() => copy(note)}>{w.copy}</TextButton>
      </div>}
    </Section>
  </>;
  const messageList = <>
    <Section heading="h2" title={w.messages}>
      <List inset>{rows.map(row => {
        const message = messageOf(row.id), answer = message?.answer, said = row.language === 'other' ? undefined : row.language;
        return <Row key={row.id} className="ri-row" data-row={row.id} onClick={() => void read(row.id, row.text, row.language)} {...pointAt(message?.spot ? targetOf(message.spot) : null)}
          icon={<VisitorAvatar id={row.id} still />} label={<span lang={said}>{row.text}</span>}
          detail={message ? message.spot ? nameOfKey(message.spot) : w.notFiled : w.unread} meta={<><Tag tone="solid" lang={said}>{row.language.toUpperCase()}</Tag>{row.example && <Tag tone="example">{w.example}</Tag>}</>}
          trailing={answer?.kind && answer.status === 'ready' ? <KindIcon kind={answer.kind} /> : message ? <KindIcon kind={null} /> : null} />;
      })}</List>
    </Section>
    <div className="ri-foot">
      <TextButton icon={<PlusIcon />} onClick={() => setPane({ kind: 'paste' })}>{w.add}</TextButton>
      {(review.messages.length > 0 || Object.keys(review.decisions).length > 0 || edits.added.length > 0 || Object.keys(edits.fixed).length > 0) && (clearing
        ? <span className="ri-confirm">{w.startOverAsk} <TextButton muted icon={<RotateIcon />} onClick={() => { commit(startOver); edit(clearEdits); if (place) void forgetPlace(place.id); setClearing(false); }}>{w.clear}</TextButton><TextButton muted icon={<CloseIcon />} onClick={() => setClearing(false)}>{w.keep}</TextButton></span>
        : <TextButton muted icon={<RotateIcon />} onClick={() => setClearing(true)}>{w.startOver}</TextButton>)}
    </div>
  </>;
  // The messages come first, since they are her work, and the summary of the walk follows them, in one order on every screen.
  const inbox = <>
    <p className="ri-guide">{data.photos.length ? w.guide : w.guideMapOnly}</p>
    {messageList}{summary}
  </>;

  const pastePane = <>
    <Back onClick={home} label={w.back} />
    <p className="ri-lead">{w.paste}</p>
    <TextArea className="ri-input" value={draft} maxLength={500} placeholder={t.messagePlaceholder} aria-label={t.message} onChange={event => { setDraft(event.target.value); setDraftLang(guessLanguage(event.target.value)); }} />
    <div className="ri-actions">
      <Select className="ri-select" value={draftLang} aria-label={t.language} onChange={event => setDraftLang(event.target.value)}>{MESSAGE_LANGS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
      <PrimaryAction icon={<MessageIcon />} shortcut="mod+enter" disabled={!draft.trim()} onClick={paste}>{w.read}</PrimaryAction>
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
      <p className="ri-row-meta">{isExample && <Tag tone="example">{w.example}</Tag>}{examples.find(example => example.id === shown.id)?.translated && <Tag tone="example">{w.translated}</Tag>}<Tag tone="solid">{language.toUpperCase()}</Tag>{w.languages[language] ?? language}{answer?.kind && <> · {answer.status === 'ready' ? t.kinds[answer.kind] : t.maybe(t.kinds[answer.kind])}</>}{earlier && <> · {w.readEarlier}</>}</p>
      <Quote className="ri-quote" lang={language === 'other' ? undefined : language}>{shown.text}</Quote>
      {!message && !ai && (unkept || downloadBytes === null || model.status === 'failed') && <p className="ri-meta ri-no-model">{unkept === 'not-kept' ? t.notKept : unkept === 'stopped' ? t.stopped : t.noModel}</p>}
      {!message && !ai && <div className="ri-actions">
        {unkept ? <TextButton icon={<RotateIcon />} disabled={!!busy} onClick={() => void download()}>{t.tryAgain}</TextButton> : (downloadBytes || model.status === 'downloading') ? <PrimaryAction icon={<DownloadIcon />} disabled={!!busy} onClick={() => void download()}>{model.status === 'downloading' ? t.downloadProgress(Math.round(model.loadedBytes / 1e6), Math.round(model.totalBytes / 1e6)) : t.download(Math.max(1, Math.round(downloadBytes! / 1e6)))}</PrimaryAction> : null}
        <TextButton icon={<PointerIcon />} onClick={() => withoutAi(shown.id, shown.text, language)}>{t.withoutAi}</TextButton>
      </div>}
      {line && <Assistant working={busy === 'reading' || busy === 'download'} text={busy === 'download' ? t.downloading : line} />}
      {answer && answer.candidates.length > 0 && <Section heading="h2" title={w.about}>
        <List ordered className="ri-about">{answer.candidates.map((key, index) => { const target = targetOf(key); return target && <Row key={key} className="ri-row" selected={message?.spot === key} onClick={() => message?.spot === key ? openSpot(target) : file(shown.id, target)} {...pointAt(target)}
          icon={<span className="ri-rank">{index + 1}</span>} label={<span className="ri-row-main">{nameOf(target)}</span>} meta={message?.spot === key ? <span className="ri-filed">{w.placed}</span> : null} />; })}</List>
      </Section>}
      {message?.spot && !answer?.candidates.includes(message.spot) && <p className="ri-filedline"><TextButton icon={<PinIcon />} onClick={() => { const target = targetOf(message.spot!); if (target) openSpot(target); }}>{w.filed(nameOfKey(message.spot))}</TextButton></p>}
      {message && <Section heading="h2" title={w.reply}>
        <Segmented label={w.reply} value={replyIn} onChange={setReplyLang} options={VISITOR_LANGS.map(item => ({ value: item.id, label: item.label, lang: item.id }))} />
        <Callout className="ri-reply" lang={replyIn}><Swap value={replyText(message, replyIn)} lang={replyIn} /></Callout>
        <div className="ri-actions ri-copy"><PrimaryAction icon={<CopyIcon />} shortcut="mod+enter" onClick={() => copy(replyText(message, replyIn))}>{w.copyReply}</PrimaryAction>{said && <span className="ri-said" role="status">{said}</span>}</div>
      </Section>}
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
    const outlines = view ? marksOn(view.id) : [];
    return <>
      <Back onClick={home} label={w.back} />
      <h2 className="ri-title">{name}</h2>
      <p className="ri-row-meta">{mine && <Tag><AddedIcon />{editWords.addedBy}</Tag>}{fix && <Tag tone="route"><FixedIcon />{editWords.fixedOn(recordDate(fix.at, lang))}</Tag>}{gone && <Tag tone="unknown">{w.removed}</Tag>}{clear && w.clearHere}{spot?.kind === 'no-photos' && t.noPhotos}</p>
      {view && <PhotoWithMarks view={view} photo={photos.get(view.photoId)} asset={asset} lang={lang} marks={outlines} lead={shown} t={t} />}
      {shown?.osm && !shown.viewId && <p className="ri-row-meta">{fromRecord(shown.label, lang)} · {t.mapRecord}</p>}
      {evidence.length > 1 && <Pager at={Math.min(page, evidence.length - 1)} total={evidence.length} go={setPage} t={t} />}
      {view && outlines.length > 0 && <div className="ri-legend"><Legend items={legendOf(outlines, lang)} /><span className="ri-meta">{w.suggestion}</span></div>}
      <Section heading="h2" title={w.visitors(filed.length)}>
        {filed.length > 0 && <List inset>{filed.map(message => { const said = message.language === 'other' ? undefined : message.language; return <Row key={message.id} className="ri-row" onClick={() => void read(message.id, message.text, message.language)}
          icon={<VisitorAvatar id={message.id} still />} label={<span lang={said}>{message.text}</span>} meta={<Tag tone="solid" lang={said}>{message.language.toUpperCase()}</Tag>} />; })}</List>}
      </Section>
      {own?.text && editing !== 'note' && <p className="ri-own"><span className="ri-meta">{editWords.yourNote}</span> {own.text}</p>}
      {editing === 'add' && clear ? <AddSpot words={editWords} where={locate(target.index).landmark} range={{ from: Math.round(data.stretches[target.index].from), to: Math.round(data.stretches[target.index].to) }} guess={noteLanguage}
          onAdd={(kind, text) => { const next = addSpot(latestEdits.current, target.index, kind, text); edit(() => next); setEditing(null); const id = next.added[next.added.length - 1]?.id; if (id) openSpot({ kind: 'added', id }, false); }} onCancel={() => setEditing(null)} />
        : editing === 'fix' ? <MarkFixed words={editWords} spot={name} date={recordDate(new Date().toISOString(), lang)} guess={noteLanguage} onFix={text => { edit(edits => markFixed(edits, stretches, text)); setEditing(null); }} onCancel={() => setEditing(null)} />
        : editing === 'note' ? <OwnNoteEditor words={editWords} value={own ?? undefined} guess={noteLanguage} onSave={text => { edit(edits => setNote(edits, key, text)); setEditing(null); }} onCancel={() => setEditing(null)} />
        : <div className="ri-tools">
          {clear && <TextButton icon={<PlusIcon />} onClick={() => setEditing('add')}>{w.addHere}</TextButton>}
          {(flagged || mine) && !fix && !gone && <TextButton icon={<FixedIcon />} onClick={() => setEditing('fix')}>{editWords.fix}</TextButton>}
          {fix && <TextButton muted icon={<UndoIcon />} onClick={() => edit(edits => clearFixed(edits, stretches))}>{editWords.undoFix}</TextButton>}
          {!clear && <TextButton icon={<NoteIcon />} onClick={() => setEditing('note')}>{editWords.yourNote}</TextButton>}
          {flagged && !fix && <TextButton muted icon={gone ? <UndoIcon /> : <RemoveIcon />} onClick={() => commit(review => decide(review, stretches, gone ? null : 'not-barrier'))}>{gone ? w.restore : w.remove}</TextButton>}
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
      <div className="ri-place"><h1>{DESTINATIONS[data.id]?.name ?? data.target.name}</h1><p>{t.walk(walk.start ? routeSpots.find(spot => !spot.stretches.length && spot.landmark === walk.start!.name)?.name[lang] ?? walk.start.name : data.title, Math.round(data.lengthMetres))}</p>{caption && <p className="ri-caption">{caption}</p>}</div>
      <Menu onHome={onHome} current={shownPlace} onPlace={place => { if (place !== shownPlace) (onPlace ?? onHome)(place); }} />
    </header>
    <Panel as="aside" phone="sheet" scroll className="ri-panel" ref={sheet} aria-label={pane.kind === 'inbox' ? w.messages : undefined} data-preview={previewing ? '' : undefined}
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
      <div key={pane.kind === 'message' ? `message ${pane.id}` : pane.kind === 'spot' ? `spot ${keyOf(pane.target)}` : pane.kind} className="ri-pane">{content}</div>
      {problem && <p className="ri-problem" role="alert">{problem}</p>}
      {previewing && <div className="ri-preview" inert style={{ top: sheet.current?.scrollTop ?? 0 }}>{previewOf(previewing)}</div>}
    </Panel>
    <div className="ri-map">
      <RouteMap ref={map} settled={settled} data={data} photoView={shownView} walk={walk} markers={markers} labels={labels} insets={insets} highlight={highlight}
        onMarker={id => { clearTimeout(leave.current); setHover(null); still.current = performance.now() + 650; opener.current = id; const target = markerTarget(id); if (target) tapTarget(target); }} onMap={tapMap}
        onHover={hoverMap} hovered={hover?.id ?? null} onPhoto={pane.kind === 'message' ? undefined : tapPhoto} words={t.map} clearBottom={narrow ? sheetHeight + 12 : 24} ariaLabel={data.title} />
    </div>
  </main>;
}

function Back({ onClick, label }: { onClick: () => void; label: string }) {
  return <TextButton className="ri-back" muted icon={<BackIcon />} onClick={onClick}>{label}</TextButton>;
}

/** The model's voice where it acts: a small mark and one line. */
function Assistant({ text, working }: { text: string; working: boolean }) {
  return <p className="ri-assistant" role="status" aria-live="polite"><span className="ri-spark" data-working={working || undefined} aria-hidden="true" />{text}</p>;
}

function KindIcon({ kind }: { kind: 'problem' | 'praise' | 'question' | null }) {
  const Icon = kind === 'problem' ? ProblemIcon : kind === 'praise' ? PraiseIcon : kind === 'question' ? QuestionIcon : MoreIcon;
  return <Icon className="ri-kind" size={16} />;
}

function KindMark({ kind }: { kind: Subject | 'noPhotos' }) {
  const Icon = kind === 'steps' ? StepsIcon : kind === 'kerb' ? KerbIcon : kind === 'path' ? PathIcon : NoPhotosIcon;
  return <Icon size={14} />;
}

/** A mark drawn on a photo: from the scan, or a finding. barrier: its kind can be a barrier; flagged: one of the walk's possible barriers. */
export type PhotoMark = { id: string; concept: string; label: string; outline: Coordinate[]; barrier: boolean; flagged: boolean; named?: boolean };
const SURFACES: ReadonlySet<string> = new Set(['footway', 'cobblestones', 'road', 'crossing']);
/** Kinds in the order the legend and the summary list them: possible barriers, then the ground. */
const order = (concept: string) => { const kind = markOf(concept); const at = kind ? MARK_ORDER.indexOf(kind) : -1; return at < 0 ? MARK_ORDER.length : at; };
/** Drawing order: the ground first and quiet, kinds that can be barriers above it, the walk's possible barriers on top. */
const layer = (mark: PhotoMark) => mark.flagged ? 3 : mark.barrier ? 2 : SURFACES.has(markOf(mark.concept) ?? '') ? 0 : 1;

/** One legend entry per kind on the photo, possible barriers first, each with its hue and icon. */
export function legendOf(marks: readonly PhotoMark[], lang: UiLang): LegendItem[] {
  // One entry per kind, worded by a finding where the kind has one.
  const kinds = new Map<string, PhotoMark>();
  for (const mark of [...marks].sort((a, b) => order(a.concept) - order(b.concept) || Number(!!b.named) - Number(!!a.named))) { const kind = markOf(mark.concept) ?? mark.concept; if (!kinds.has(kind)) kinds.set(kind, mark); }
  return [...kinds.values()].map(mark => { const Icon = iconFor(mark.concept); return { mark: markOf(mark.concept) ?? undefined, barrier: mark.barrier, icon: Icon ? <Icon size={15} /> : undefined, label: fromRecord(mark.label, lang) }; });
}

/** Pages through a spot's evidence: its photos, and any map record. */
export function Pager({ at, total, go, t }: { at: number; total: number; go: (page: number) => void; t: (typeof COPY)[keyof typeof COPY] }) {
  return <div className="ri-pager">
    <IconButton label={t.previous} onClick={() => go((at + total - 1) % total)}><BackIcon size={16} /></IconButton>
    <span>{t.pageOf(at + 1, total)}</span>
    <IconButton label={t.next} onClick={() => go((at + 1) % total)}><ChevronIcon size={16} /></IconButton>
  </div>;
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
export function PhotoWithMarks({ view, photo, asset, lang, marks, lead, t, still = false }: { view: View; photo: Photo | undefined; asset: (file: string) => string; lang: UiLang; marks: readonly PhotoMark[]; lead: Finding | null;
  t: (typeof COPY)[keyof typeof COPY]; still?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [whole, setWhole] = useState(false);
  const zoom = zoomOn(view, lead);
  const date = photo?.capturedAt ? recordDate(photo.capturedAt, lang) || null : null;
  const drawn = [...marks].filter(mark => mark.outline.length > 2).sort((a, b) => layer(a) - layer(b));
  const image = <div className="ri-photo-image" style={{ transform: zoom && !whole ? zoom : undefined }}>
    {failed ? <span className="ri-photo-missing" /> : <img src={asset(view.file)} alt={lead ? fromRecord(lead.label, lang) : ''} onError={() => setFailed(true)} />}
    {!failed && drawn.length > 0 && <svg viewBox={`0 0 ${view.width} ${view.height}`} preserveAspectRatio="none" aria-hidden="true">
      {drawn.map(f => { const points = f.outline.map(p => p.join(',')).join(' '), barrier = f.flagged || undefined; return <g key={f.id}><polygon className="ui-mark-halo" data-barrier={barrier} points={points} /><polygon className="ui-mark" data-mark={markOf(f.concept) ?? undefined} data-barrier={barrier} points={points} /></g>; })}
    </svg>}
  </div>;
  return <figure className="ri-photo" style={{ '--ratio': view.height / view.width } as CSSProperties}>
    <div className="ri-photo-box">
      {zoom && !still ? <button className="ri-photo-frame" aria-pressed={whole} onClick={() => setWhole(value => !value)} aria-label={whole ? t.closer : t.whole}>{image}</button> : <div className="ri-photo-frame">{image}</div>}
    </div>
    {photo && <figcaption>{photo.creator}{date ? `, ${date}` : ''}. CC BY-SA 4.0 · {photo.link ? <a href={photo.link} target="_blank" rel="noreferrer">Mapillary</a> : 'Mapillary'}</figcaption>}
  </figure>;
}


import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { decide, loadReview, logMessage, saveReview, startOver, updateMessage, verdictOf, type LoggedMessage, type ModelAnswer, type Review } from '../decisions/store';
import { EDIT_KINDS, addSpot, answerOf, clearEdits, clearFixed, isFixed, loadEdits, markFixed, noteLangOf, noteOf, ownNote, saveEdits, setAnswer, setNote, type EditKind, type Edits } from '../edits/store';
import { addedFeature, fixedLine, ownNoteLines, withEdits, type Locate } from '../edits/place';
import { KIND_WORDS } from '../edits/words';
import { forgetPlace, modelDownloadBytes, modelState, modelStored, prepareModel, prepareSite, remember, understand, type ModelState } from '../language/understand';
import { looksSupported } from '../language/policy';
import { ROUTE_PLACES } from '../site/registry';
import type { RoutePlace } from '../site/route';
import { useLanguage } from '../i18n';
import { fromRecord } from '../i18n/records';
import Menu, { type MenuPlace } from '../home/Menu';
import { ANSWER_NOTE, AROUND_NOTE, COPY, KIND_NOTE, NOTE, REPLY, REPLY_MORE, STILL_NOTE, SUBJECTS, THING, THROUGH_NOTE, enPlace, esPlace, guessLanguage, where, type Subject, type VisitorLang, type Where } from '../destinations/copy';
import { DESTINATIONS, type Destination } from '../destinations/data';
import { EXAMPLES } from '../destinations/examples';
import RouteMap, { type MapHandle, type Marker, type MarkerState } from '../destinations/RouteMap';
import type { Lens } from '../destinations/lens';
import { addStreet, buildStreet, loadLines, mapPaths, saveLines, setCheck, wayAroundOf, type NewStreet } from '../routes/lines';
import { RouteTrouble } from '../routes/valhalla';
import type { LonLat } from '../routes/shape';
import { buildWalk, midpoint, nearestStretch, type Point, type Spot } from '../destinations/walk';
import { ChevronIcon, NoteIcon, iconFor } from '../ui/icons';
import { Composer, CopyBox, Dialogue, GlassButton, MARK_ORDER, Segmented, Tag, kindOf, markOf, type MarkKind } from '../ui';
import { LabelledPhoto, photoOf } from '../photo';
import { PhotoOr3D } from '../space3d';
import Swap from '../fx/Swap';
import { QUESTIONS, QUESTION_OF, SCRIPT, TAP_ANSWERS, about, type AccessKind, type Answer, type ItemSlots, type QuestionId, type WalkSlots } from './script';
import { Bot, Options, type Chip } from './Say';
import './guide.css';
import './guide-screen.css';

/** A place on the walk the conversation can be about: a spot of the walk, a plain stretch, a named landmark, or a spot she added. */
type Target = { kind: 'spot'; id: string } | { kind: 'stretch'; index: number } | { kind: 'landmark'; id: string } | { kind: 'added'; id: string };
/** One item of the walk check: a flagged spot, a stretch no photo shows, or another kind a model marked near the walk. */
type Item = { key: string; access: AccessKind; spot: Spot } | { key: string; access: AccessKind; mark: MarkKind; count: number; points: Point[]; viewId: string | null };
/** An edit the guide offers from her words or her tap; nothing changes on her map until she confirms it. */
type Proposal = { mode: 'add' | 'note'; text: string; target: Target; kind: EditKind; from: Step };
type Step =
  | { id: 'hello' }
  /** tapping: an answer that needs her tap on the map; kind: she said something else is there, and picks what. */
  | { id: 'check'; at: number; tapping?: Answer; kind?: true }
  | { id: 'checkEnd' }
  | { id: 'message'; at: number; another?: boolean }
  /** ask: nobody could place the message, so the reply asks the visitor where it was. */
  | { id: 'reply'; at: number; ask?: true }
  | { id: 'insights' }
  | { id: 'missed'; here?: Target }
  | { id: 'propose'; proposal: Proposal }
  /** The way around a flight of steps that OpenStreetMap suggests, shown on the map, for her to say whether it works. */
  | { id: 'around'; at: number }
  /** Another street she adds: she taps its start and end, and it is routed on foot. It is map only: no street photo was read on it. */
  | { id: 'street'; from?: LonLat; to?: LonLat; found?: NewStreet; trouble?: string }
  | { id: 'note'; clearing?: boolean }
  /** What she wants to change, from the Edit pill on any step: a spot to add (a tap or her words), a spot to change (a tap), or her own note. */
  | { id: 'edit'; mode?: 'add' | 'change' | 'note' };

/** Where her own note for the whole walk is kept among her notes on spots. */
const WALK_NOTE = 'walk';
const same = (a: Target | null, b: Target | null) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
const bare = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '');
/** A thing's words from the script with the definite article, such as "a kerb" to "the kerb" or "escalones" to "los escalones". */
function definite(words: string, lang: 'en' | 'es'): string {
  if (lang === 'en') return /^something /.test(words) ? `what’s ${words.slice(10)}` : words.replace(/^(an?|the) /, '').replace(/^/, 'the ');
  if (/^(algo|lo) que /.test(words)) return words.replace(/^algo/, 'lo');
  const plain = words.replace(/^(una?|el|la|los|las) /, '');
  const article = /^una /.test(words) ? 'la' : /^un /.test(words) ? 'el' : /^(escalones|baños|bordillos)\b/.test(plain) ? 'los' : /^obras\b/.test(plain) ? 'las' : /^acera\b/.test(plain) ? 'la' : 'el';
  return `${article} ${plain}`;
}
const subjectOf = (spot: Spot): Subject => spot.findings.some(f => /steps/.test(f.concept)) ? 'steps' : spot.findings.some(f => f.concept === 'kerb') ? 'kerb' : 'path';
const subjectOfKind = (kind: EditKind): Subject => kind === 'steps' ? 'steps' : kind === 'kerb' ? 'kerb' : 'path';
const kindOfSubject = (subject: Subject): EditKind => subject === 'steps' ? 'steps' : subject === 'kerb' ? 'kerb' : 'other';
/** What a flagged spot is, for the guide's question about it. */
function accessOfSpot(spot: Spot): AccessKind {
  if (spot.kind === 'no-photos') return 'unseen';
  const kind = spot.findings.map(f => markOf(f.concept)).find(Boolean);
  return kind === 'steps' ? 'steps' : kind === 'kerb' ? 'kerb' : kind === 'broken' ? 'broken' : kind === 'bollard' ? 'bollard' : kind === 'cobblestones' ? 'uneven' : 'obstacle';
}
const ACCESS_OF_MARK: Partial<Record<MarkKind, AccessKind>> = { steps: 'steps', kerb: 'kerb', broken: 'broken', crossing: 'crossing', bollard: 'bollard', cobblestones: 'uneven' };
/** Kinds near the walk the check goes through after the flagged spots, in the order a person would. Kerbs beside the walk are context, not a question. */
const CHECK_KINDS: readonly MarkKind[] = MARK_ORDER.filter(kind => ACCESS_OF_MARK[kind] && kind !== 'kerb');
/** What a model's issue type suggests she would call it; she can change it before it goes on her map. */
const kindOfCategory = (category: string | null): EditKind => category === 'steps-or-slope' ? 'steps' : category === 'path-blocked' ? 'narrow' : 'other';
/** The route-note line for her answer about one thing: a line, null when nothing goes in the note, undefined when the table has none. */
function answerLine(question: string, answer: string, access: AccessKind, at: Where, m: number, language: VisitorLang): string | null | undefined {
  const table = (ANSWER_NOTE as Record<string, Record<string, Record<VisitorLang, (w: Where, m: number) => string> | null> | undefined>)[question];
  if (table && answer in table) { const line = table[answer]; return line ? line[language](at, m) : null; }
  if (question === 'through' && THING[access] && (answer === 'yes' || answer === 'no' || answer === 'unknown')) return THROUGH_NOTE[answer][language](access, at, m);
  if ((question === 'temporary' || question === 'helpful') && THING[access]) return answer === 'still' ? STILL_NOTE[language](access, at, m) : answer === 'gone' ? null : undefined;
  return undefined;
}

/** Whether the model can read a message at all: it knows Latin and Hangul letters only. */
const readable = (text: string) => /[\p{Script=Latin}\p{Script=Hangul}]/u.test(text);
const replyLanguage = (language: string): VisitorLang => language === 'es' || language === 'ko' ? language : language === 'qu' ? 'es' : 'en';
const VISITOR_LANGS: { id: VisitorLang; label: string }[] = [{ id: 'en', label: 'EN' }, { id: 'es', label: 'ES' }, { id: 'ko', label: 'KO' }];
/** How her answer shows on the map: taken off, fixed, or kept as she says it is. */
const stateOfAnswer = (answer: string): MarkerState | null => answer === 'notThere' || answer === 'gone' ? 'not-barrier' : answer === 'repaired' ? 'fixed' : answer === 'unknown' ? null : 'barrier';

let safe: { top: number; right: number; bottom: number; left: number } | null = null;
function safeArea() {
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

/** The walk as the guide's greeting and the reveal speak of it, in the interface language. */
export function walkSlotsOf(data: Destination, lang: 'en' | 'es', spots: RoutePlace | null = ROUTE_PLACES[data.id] ?? null): WalkSlots {
  const walk = buildWalk(data);
  const name = (landmark: string) => spots?.features.find(spot => !spot.stretches.length && spot.landmark === landmark)?.name[lang] ?? fromRecord(landmark, lang);
  const prose = (text: string) => lang === 'es' ? esPlace(text) : enPlace(text);
  return {
    place: DESTINATIONS[data.id]?.name ?? data.target.name, start: prose(name(walk.start?.name ?? data.title)), target: prose(name(walk.target.name)),
    metres: Math.round(data.lengthMetres), photos: data.photos.length, marks: data.marks.filter(mark => mark.position).length,
    barriers: data.findings.filter(f => f.barrier).length, spots: walk.spots.filter(spot => spot.kind === 'flagged').length,
    messages: (EXAMPLES[data.id] ?? []).length, osm: data.findings.filter(f => f.osm).length,
  };
}

/**
 * The route screen as a conversation with the guide, docked at the bottom with the map above it. It greets her with the walk,
 * goes through what the photos showed thing by thing with a question that fits each, brings each visitor's message with the
 * model's spot and a reply, says what visitors keep raising, takes what the photos missed, and ends with the route note.
 * Every change to her map is a choice she taps; her own words only make a proposal.
 */
export default function GuideScreen({ data, asset, onHome, onPlace, settled = false, spots, caption }: { data: Destination; asset: (file: string) => string; onHome: () => void; onPlace?: (place: MenuPlace) => void; settled?: boolean;
  /** The spots of a walk built on this device, which the registry does not list. Keep the same object between renders. */
  spots?: RoutePlace;
  /** One plain line under the walk, such as where its findings came from. */
  caption?: string }) {
  const { lang } = useLanguage();
  const s = SCRIPT[lang], t = COPY[lang];
  const narrow = useNarrow();
  const walk = useMemo(() => buildWalk(data), [data]);
  const authored = spots ?? ROUTE_PLACES[data.id] ?? null;
  const views = useMemo(() => new Map(data.views.map(view => [view.id, view])), [data.views]);
  const photos = useMemo(() => new Map(data.photos.map(photo => [photo.id, photo])), [data.photos]);
  const map = useRef<MapHandle>(null);
  const dock = useRef<HTMLDivElement>(null);
  const bot = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLElement>(null);

  // What she keeps on this device: her decisions and messages, and her own edits and answers.
  const [review, setReview] = useState(() => loadReview(data.id).review);
  const latest = useRef(review);
  const [edits, setEdits] = useState(() => loadEdits(data.id).edits);
  const latestEdits = useRef(edits);
  const [ways, setWays] = useState(() => loadLines(data.id).lines);
  const around = wayAroundOf(data, ways);
  const [problem, setProblem] = useState('');
  // Before shows the walk as the data has it; Now with every change she made. The switch appears once there is a change.
  const [view, setView] = useState<'before' | 'now'>('now');
  const blankEdits = useMemo<Edits>(() => ({ ...edits, added: [], fixed: {}, notes: {}, answers: {} }), [edits]);
  const changed = Object.keys(review.decisions).length > 0 || edits.added.length > 0 || Object.keys(edits.fixed).length > 0 || Object.keys(edits.notes).length > 0
    || Object.keys(edits.answers).length > 0 || ways.streets.length > 0 || !!ways.check;
  const before = view === 'before' && changed;
  function commit(change: (review: Review) => Review) {
    const next = change(latest.current); latest.current = next; setReview(next);
    if (!saveReview(next)) setProblem(s.notSaved);
  }
  const locate: Locate = stretch => {
    const line = data.stretches[stretch], at = midpoint(line.line.map(walk.project));
    const near = [...walk.landmarks].sort((a, b) => Math.hypot(a.at[0] - at[0], a.at[1] - at[1]) - Math.hypot(b.at[0] - at[0], b.at[1] - at[1]))[0];
    return { from: line.from, to: line.to, landmark: near?.name ?? '' };
  };
  const place = useMemo(() => authored ? withEdits(authored, edits, locate) : null, [authored, edits]); // eslint-disable-line react-hooks/exhaustive-deps
  function edit(change: (edits: Edits) => Edits): Edits {
    const next = change(latestEdits.current); latestEdits.current = next; setEdits(next);
    if (!saveEdits(next)) setProblem(s.notSaved);
    if (authored) void prepareSite(withEdits(authored, next, locate));
    return next;
  }

  // The model: a stored one warms up on its own; nothing downloads without her tap.
  const [model, setModel] = useState<ModelState>(() => modelState());
  const [stored, setStored] = useState(false);
  const [busy, setBusy] = useState<'download' | 'warm' | 'reading' | null>(null);
  const [downloadBytes, setDownloadBytes] = useState<number | null | undefined>(undefined);
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
  async function download() {
    if (!place || busy) return;
    setBusy('download'); setUnkept(null);
    let arrived = false;
    const next = await prepareModel(state => { if (state.status === 'downloading' && state.loadedBytes >= state.totalBytes) arrived = true; setModel(state); });
    setModel(next); setBusy(null);
    if (next.status === 'ready') { setStored(true); void prepareSite(place); }
    else setUnkept(arrived ? 'not-kept' : 'stopped');
  }

  // Names and positions
  const routeSpots = place?.features ?? [];
  const routeSpotFor = (stretches: readonly number[]) => routeSpots.find(spot => spot.stretches.length && spot.stretches[0] === stretches[0] && !spot.id.startsWith('added-'));
  const names = { start: walk.start?.name ?? '', target: walk.target.name };
  function whereOf(spot: Spot): Where {
    const fallback = where(spot.near, names), named = routeSpotFor(spot.stretches);
    if (!named) return fallback;
    const landmark = routeSpots.find(item => !item.stretches.length && item.landmark === named.landmark);
    return {
      en: bare(named.name.en).match(/\b(at|near|on|by)\b.*$/)?.[0].replace(/^(at|near|on|by) (?!the )(.+)$/, (_, by: string, name: string) => `${by} ${enPlace(name)}`) ?? fallback.en,
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
  const spotById = (id: string) => walk.spots.find(spot => spot.id === id) ?? null;
  function targetOf(key: string): Target | null {
    if (added(key)) return { kind: 'added', id: key };
    const named = routeSpots.find(spot => spot.id === key);
    const index = named ? named.stretches[0] : /^stretch-\d+$/.test(key) ? Number(key.slice(8)) : undefined;
    if (index !== undefined) { const spot = spotOf(index); return spot ? { kind: 'spot', id: spot.id } : { kind: 'stretch', index }; }
    return named ? { kind: 'landmark', id: named.id } : null;
  }
  function stretchesOf(target: Target): number[] {
    if (target.kind === 'spot') return spotById(target.id)?.stretches ?? [];
    if (target.kind === 'stretch') return [target.index];
    if (target.kind === 'added') { const spot = added(target.id); return spot ? [spot.stretch] : []; }
    return [];
  }
  function keyOf(target: Target): string {
    if (target.kind === 'landmark' || target.kind === 'added') return target.id;
    return routeSpotFor(stretchesOf(target))?.id ?? (target.kind === 'spot' ? target.id : `stretch-${target.index}`);
  }
  function pointOf(target: Target): Point | null {
    if (target.kind === 'spot') return spotById(target.id)?.at ?? null;
    if (target.kind === 'stretch' || target.kind === 'added') { const index = stretchesOf(target)[0]; return index === undefined ? null : midpoint(data.stretches[index].line.map(walk.project)); }
    const named = routeSpots.find(spot => spot.id === target.id);
    return named ? walk.locate(named.landmark) : null;
  }
  function nameOf(target: Target): string {
    if (target.kind === 'spot') return spotName(spotById(target.id)!);
    if (target.kind === 'added') return addedName(target.id);
    if (target.kind === 'landmark') return bare(routeSpots.find(spot => spot.id === target.id)?.name[lang] ?? target.id);
    const stretch = data.stretches[target.index];
    return t.range(Math.round(stretch.from), Math.round(stretch.to));
  }
  /** A spot as words inside a line, with its article and never a range of metres: "the steps on Calle Loreto", "the Qorikancha ticket booth". */
  function spotWords(target: Target): string {
    const spot = target.kind === 'spot' ? spotById(target.id) : null;
    if (spot) return `${definite(s.words.access[accessOfSpot(spot)], lang)} ${whereOf(spot)[lang]}`;
    if (target.kind === 'added') { const one = added(target.id); if (one) return `${definite(s.words.added[one.kind], lang)} ${nearOf(one.stretch)[lang]}`; }
    if (target.kind === 'landmark') { const name = nameOf(target); return lang === 'es' ? esPlace(name) : enPlace(name); }
    return target.kind === 'stretch' ? `${lang === 'es' ? 'el recorrido' : 'the walk'} ${nearOf(target.index)[lang]}` : nameOf(target);
  }
  /** What a choice or a marker calls a spot: its kind and how far along, as on the map, or a landmark's name. */
  function tagOf(target: Target): string {
    const spot = target.kind === 'spot' ? spotById(target.id) : null;
    if (spot) return `${spot.kind === 'no-photos' ? t.inbox.kinds.noPhotos : t.inbox.kinds[subjectOf(spot)]} · ${along(spot.from)}`;
    const one = target.kind === 'added' ? added(target.id) : null;
    return one ? `${s.words.kinds[one.kind]} · ${along(data.stretches[one.stretch].from)}` : nameOf(target);
  }
  function nearOf(stretch: number): Where {
    const near = locate(stretch).landmark;
    return near ? { en: `near ${near}`, es: `cerca de ${near}`, ko: near } : where(null, names);
  }
  function whereWords(target: Target): string {
    const spot = target.kind === 'spot' ? spotById(target.id) : null;
    if (spot) return whereOf(spot)[lang];
    const index = stretchesOf(target)[0];
    return index === undefined ? nameOf(target) : nearOf(index)[lang];
  }
  /** The stretch an edit lands on: the first of a spot, the nearest one to a landmark. */
  function stretchFor(target: Target): number | null {
    const index = stretchesOf(target)[0];
    if (index !== undefined) return index;
    const at = pointOf(target);
    return at ? nearestStretch(data, walk, at) : null;
  }
  const along = (from: number) => Math.round(from) === 0 ? t.inbox.start : `${Math.round(from)} m`;
  const removed = (stretches: readonly number[]) => verdictOf(review, stretches) === 'not-barrier';
  const monthOf = (iso: string | null | undefined) => { const date = iso ? new Date(iso) : null; return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(lang === 'es' ? 'es-PE' : 'en-GB', { month: 'long', year: 'numeric' }).format(date) : ''; };

  // The walk check: flagged spots first, then stretches no photo shows, then the other kinds a model marked near the walk.
  const items = useMemo<Item[]>(() => {
    const spotItems = [...walk.spots.filter(spot => spot.kind === 'flagged'), ...walk.spots.filter(spot => spot.kind === 'no-photos')].map(spot => ({ key: spot.id, access: accessOfSpot(spot), spot }));
    const near = data.marks.filter(mark => mark.position && mark.stretches.length && !mark.flagged);
    const kinds = CHECK_KINDS.flatMap(kind => {
      const marks = near.filter(mark => markOf(mark.concept) === kind);
      if (!marks.length) return [];
      const perView = new Map<string, number>();
      for (const mark of marks) if (views.has(mark.viewId)) perView.set(mark.viewId, (perView.get(mark.viewId) ?? 0) + 1);
      const viewId = [...perView].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return [{ key: `marks:${kind}`, access: ACCESS_OF_MARK[kind]!, mark: kind, count: marks.length, points: marks.map(mark => walk.project(mark.position!)), viewId }];
    });
    return [...spotItems, ...kinds];
  }, [walk, data.marks, views]);
  /** A spot's question fits its kind; a kind along much of the walk asks whether the note mentions it, but cobblestones ask for a smoother way. */
  const questionOf = (item: Item): QuestionId => 'spot' in item ? QUESTION_OF[item.access] : item.mark === 'cobblestones' ? 'smoother' : 'mention';
  const itemOfTarget = (target: Target) => target.kind === 'spot' ? items.findIndex(item => 'spot' in item && item.spot.id === target.id) : -1;
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  function slotsOf(item: Item, at: number): ItemSlots {
    if (!('spot' in item)) return { n: at + 1, total: items.length, what: s.words.marks[item.mark](item.count), where: '', metres: 0, photos: item.viewId ? 1 : 0, when: '', osm: '' };
    const spot = item.spot, shown = spot.findings.filter(f => f.viewId && views.has(f.viewId));
    const newest = shown.map(f => photos.get(views.get(f.viewId!)!.photoId)?.capturedAt ?? '').sort().at(-1);
    // What OpenStreetMap records at the spot, said beside what the photos show: never checked by a person, like the photos.
    const mapped = spot.findings.find(f => f.osm && f.label)?.label;
    return { n: at + 1, total: items.length, what: s.words.access[item.access], where: whereOf(spot)[lang], metres: Math.round(spot.from), photos: shown.length, when: monthOf(newest), osm: mapped ? fromRecord(mapped, lang) : '' };
  }
  /** Her answer about one thing, on her map at once and said back on the way to the next. A place she names is a tap on the map. */
  function answer(at: number, question: QuestionId, choice: Answer, stretch?: number) {
    const item = items[at];
    if (TAP_ANSWERS.has(choice) && stretch === undefined) { setStep({ id: 'check', at, tapping: choice }); setAck(''); return; }
    if (question === 'unseen' && choice === 'something') { setStep({ id: 'check', at, kind: true }); setAck(''); return; }
    if ('spot' in item) {
      const stretches = item.spot.stretches;
      if (choice === 'repaired') edit(edits => markFixed(edits, stretches));
      else if (isFixed(latestEdits.current, stretches)) edit(edits => clearFixed(edits, stretches));
      commit(review => decide(review, stretches, choice === 'notThere' || choice === 'gone' ? 'not-barrier' : null));
    }
    edit(edits => setAnswer(edits, item.key, { question, answer: choice, stretch }));
    const said = (s.check.said[question] as Record<string, (slots: ItemSlots) => string>)[choice];
    go(nextCheck(at), said(slotsOf(item, at)));
  }
  /** Something else is on a stretch no photo shows, or where a model outlined something: her own spot, of the kind she picks. */
  function somethingThere(at: number, kind: EditKind) {
    const item = items[at];
    if (!('spot' in item)) return;
    const target: Target = { kind: 'spot', id: item.spot.id };
    edit(edits => setAnswer(addSpot(edits, item.spot.stretches[0], kind), item.key, { question: QUESTION_OF[item.access], answer: 'something' }));
    go(nextCheck(at), s.missed.added({ kind: s.words.added[kind], where: whereWords(target) }));
  }

  // Messages: hers first, newest first, then the examples, each brought by the guide.
  const examples = EXAMPLES[data.id] ?? [];
  const rows = [...review.messages.filter(message => !message.id.startsWith('example-')).map(message => ({ id: message.id, text: message.text, language: message.language, example: false, translated: false })),
    ...examples.map(example => ({ ...example, example: true, translated: !!example.translated }))];
  const messageOf = (id: string) => review.messages.find(message => message.id === id) ?? null;

  // The conversation
  const [step, setStep] = useState<Step>({ id: 'hello' });
  const [ack, setAck] = useState('');
  const history = useRef<Step[]>([]);
  const [said, setSaid] = useState('');
  function go(next: Step, line = '') { setView('now'); history.current.push(step); setStep(next); setAck(line); setSaid(''); }
  // The Edit pill pauses whatever step she is on; "Back to where I was" returns to it.
  const [resume, setResume] = useState<Step | null>(null);
  function openEdit() {
    if (step.id !== 'edit') { setResume(paused => paused ?? step); go({ id: 'edit' }); return; }
    if (resume) { const paused = resume; setResume(null); history.current.push(step); setStep(paused); setAck(''); }
  }
  function back() { const previous = history.current.pop(); if (previous) { setStep(previous); setAck(''); setSaid(''); } }
  const nextCheck = (at: number): Step => at + 1 < items.length ? { id: 'check', at: at + 1 } : { id: 'checkEnd' };
  const nextMessage = (at: number): Step => at + 1 < rows.length ? { id: 'message', at: at + 1 } : { id: 'insights' };

  // Reading: a visitor's message through the model on this device.
  const [reading, setReading] = useState<string | null>(null);
  async function read(id: string, text: string, language: string) {
    if (!place) return;
    const mine = ++ticket.current;
    setReading(id); setBusy('reading');
    let result;
    try { result = await understand(text, place); } catch { result = { status: 'unavailable' as const, kind: null, category: null, candidates: [] as string[], reason: 'model-failed' as const }; }
    if (mine !== ticket.current) return;
    setReading(null); setBusy(null);
    // The model reads Latin and Hangul letters only: for any other script its spots are noise, so none is offered.
    const candidates = result.status === 'invalid' || !readable(text) ? [] : result.candidates.filter(key => targetOf(key)).slice(0, 3);
    const answer: ModelAnswer = { status: result.status === 'invalid' ? 'unavailable' : result.status, kind: result.kind, category: result.category, candidates, model: result.model ? `${result.model.id}@${result.model.revision}` : null, ...(result.reason === 'remembered' ? { remembered: true as const } : {}) };
    // The model's spot is only offered: she confirms it before the message is filed.
    commit(review => review.messages.some(message => message.id === id) ? updateMessage(review, id, { answer }) : logMessage(review, { text, language, answer, spot: null }, id));
  }
  const shownRow = step.id === 'message' ? rows[step.at] ?? null : null;
  useEffect(() => {
    if (!shownRow || !ai || reading === shownRow.id) return;
    const known = messageOf(shownRow.id);
    if (known && (known.spot || known.answer)) return;
    void read(shownRow.id, shownRow.text, shownRow.language);
  }, [shownRow?.id, ai]); // eslint-disable-line react-hooks/exhaustive-deps
  function withoutAi(row: { id: string; text: string; language: string }) {
    if (!messageOf(row.id)) commit(review => logMessage(review, { text: row.text, language: row.language, answer: null, spot: null }, row.id));
    if (step.id === 'message') setStep({ ...step, another: true });
  }
  /** Her tap files the message on a spot; the model learns from it when the spot is one it can suggest. */
  function file(at: number, target: Target | null, ask?: true) {
    const row = rows[at]; if (!row) return;
    const key = target ? keyOf(target) : null;
    if (!messageOf(row.id)) commit(review => logMessage(review, { text: row.text, language: row.language, answer: null, spot: key }, row.id));
    else commit(review => updateMessage(review, row.id, { spot: key }));
    const learns = !!key && !!place?.features.some(feature => feature.id === key);
    if (learns && place) void remember(row.text, place, key!);
    setReplyLang(null);
    // The model recalls her filing only for messages that fail its language check (docs/language.md), so only those are promised.
    const recalls = learns && !looksSupported(row.text);
    go({ id: 'reply', at, ...(ask ? { ask } : {}) }, target ? `${s.messages.filed({ spot: spotWords(target) })}${recalls ? ` ${s.messages.learned}` : ''}` : '');
  }
  const [replyLang, setReplyLang] = useState<VisitorLang | null>(null);
  const [noteLang, setNoteLang] = useState<VisitorLang>(lang);
  useEffect(() => setNoteLang(lang), [lang]);

  /** Her own words: the model finds the spot and what kind of thing it is, and the guide offers the edit back. */
  const pendingWords = useRef('');
  async function hear(text: string) {
    const from = step;
    const current = step.id === 'check' ? items[step.at] : null;
    const here: Target | null = current && 'spot' in current ? { kind: 'spot', id: current.spot.id } : step.id === 'missed' ? step.here ?? null : null;
    let found: Target | null = here, kind: EditKind = 'other';
    if (ai && place) {
      setBusy('reading');
      try {
        const result = await understand(text, place);
        const first = result.candidates.map(targetOf).find((target): target is Target => !!target) ?? null;
        kind = kindOfCategory(result.category);
        if (first && step.id !== 'check') found = first;
        else if (!found) found = first;
      } catch { /* she can still tap the spot */ }
      setBusy(null);
    }
    if (!found) { pendingWords.current = text; go({ id: 'missed' }, s.missed.notFound); return; }
    const mode = step.id === 'check' && same(found, here) ? 'note' : 'add';
    go({ id: 'propose', proposal: { mode, text, target: found, kind, from } });
  }
  function confirm(proposal: Proposal) {
    const language = noteLangOf(guessLanguage(proposal.text));
    if (proposal.mode === 'note') {
      const key = keyOf(proposal.target);
      edit(edits => setNote(edits, key, ownNote(proposal.text, language)));
      if (place?.features.some(feature => feature.id === key)) void remember(proposal.text, place, key);
      history.current.push(step); setStep(proposal.from); setAck(s.check.noted({ spot: spotWords(proposal.target) }));
      return;
    }
    const stretch = stretchFor(proposal.target);
    if (stretch === null) return;
    const next = edit(edits => addSpot(edits, stretch, proposal.kind, ownNote(proposal.text, language)));
    const id = next.added[next.added.length - 1]?.id;
    if (id && proposal.text && authored) void remember(proposal.text, withEdits(authored, next, locate), id);
    history.current.push(step);
    setStep(proposal.from.id === 'propose' ? { id: 'missed' } : proposal.from);
    setAck(s.missed.added({ kind: s.words.added[proposal.kind], where: whereWords(proposal.target) }));
  }

  /** Natural selection: a spot tapped on the map, or a photo's place, becomes what the conversation is about. */
  function select(target: Target) {
    if (step.id === 'message') { file(step.at, target); return; }
    if (step.id === 'check' && step.tapping) { const stretch = stretchFor(target); if (stretch !== null) answer(step.at, questionOf(items[step.at]), step.tapping, stretch); return; }
    if (step.id === 'propose') { setStep({ id: 'propose', proposal: { ...step.proposal, target } }); return; }
    if (step.id === 'edit' && step.mode === 'add') { go({ id: 'missed', here: target }); return; }
    const at = itemOfTarget(target);
    if (at >= 0) { go({ id: 'check', at }); return; }
    const words = pendingWords.current; pendingWords.current = '';
    if (words) { go({ id: 'propose', proposal: { mode: 'add', text: words, target, kind: 'other', from: { id: 'missed' } } }); return; }
    go({ id: 'missed', here: target });
  }
  const routing = useRef<AbortController | null>(null);
  function streetTap(lonLat: LonLat) {
    if (step.id !== 'street' || step.found || (step.from && step.to)) return;
    if (!step.from) { setStep({ id: 'street', from: lonLat }); return; }
    const from = step.from, controller = new AbortController();
    routing.current?.abort(); routing.current = controller;
    setStep({ id: 'street', from, to: lonLat }); setBusy('reading');
    buildStreet(from, lonLat, data.line, { signal: controller.signal }).then(found => {
      if (controller.signal.aborted) return;
      setBusy(null); setStep({ id: 'street', from, to: lonLat, found });
    }, (error: unknown) => {
      if (controller.signal.aborted) return;
      setBusy(null); setStep({ id: 'street', trouble: error instanceof RouteTrouble ? error.kind : 'failed' });
    });
  }
  function tapMap(at: Point, k: number, lonLat?: LonLat) {
    if (step.id === 'street') { if (lonLat) streetTap(lonLat); return; }
    const index = nearestStretch(data, walk, at), stretch = index === null ? null : data.stretches[index];
    const distance = stretch ? Math.min(...stretch.line.map(walk.project).map(p => Math.hypot(p[0] - at[0], p[1] - at[1]))) : Infinity;
    if (!stretch || distance * k > 28) return;
    const spot = spotOf(stretch.index), addedHere = edits.added.find(item => item.stretch === stretch.index);
    // An answer that names a place takes the stretch she tapped, whatever is on it.
    if (step.id === 'check' && step.tapping) { select({ kind: 'stretch', index: stretch.index }); return; }
    select(spot ? { kind: 'spot', id: spot.id } : addedHere ? { kind: 'added', id: addedHere.id } : { kind: 'stretch', index: stretch.index });
  }
  function tapPhoto(viewId: string) {
    const stretch = data.stretches.find(item => item.views.includes(viewId)); if (!stretch) return;
    const spot = spotOf(stretch.index);
    select(spot ? { kind: 'spot', id: spot.id } : { kind: 'stretch', index: stretch.index });
  }

  // Visitor-facing text, from fixed templates and her own records only
  function replyText(message: LoggedMessage, language: VisitorLang, ask?: boolean) {
    if (ask) return REPLY_MORE.askWhere[language];
    const answer = message.answer;
    if (answer?.status === 'ready' && answer.kind === 'praise') return REPLY.praise[language]();
    if (answer?.status === 'ready' && answer.kind === 'question') return REPLY.question[language]();
    const target = message.spot ? targetOf(message.spot) : null;
    if (!target) return answer?.kind === 'problem' || !answer ? REPLY_MORE.askWhere[language] : REPLY.open[language]();
    if (target.kind === 'landmark' || target.kind === 'stretch') return REPLY.open[language]();
    const stretches = stretchesOf(target), fix = isFixed(edits, stretches);
    const spot = target.kind === 'spot' ? spotById(target.id) : null;
    if (spot?.kind === 'no-photos') return REPLY.open[language]();
    const subject = spot ? subjectOf(spot) : subjectOfKind(added(target.id)?.kind ?? 'other');
    const at = spot ? whereOf(spot) : nearOf(stretches[0]), from = spot ? spot.from : data.stretches[stretches[0]].from;
    if (fix) return `${REPLY.check[language]().split('.')[0]}. ${fixedLine(spot ? kindOfSubject(subject) : added(target.id)!.kind, at, from, fix.at, language)}`;
    if (removed(stretches)) return REPLY[data.photos.length ? 'not-barrier' : 'not-barrier-mapped'][language]();
    const text = REPLY.barrier[language]((spot ? SUBJECTS[subject] : KIND_WORDS[added(target.id)?.kind ?? 'other'])[language], at);
    const clause = spot ? (REPLY_MORE.answer as Record<string, Record<VisitorLang, string>>)[answerOf(edits, spot.id)?.answer ?? ''] : undefined;
    return clause ? text.replace(NOTE.steps[language], clause[language]) : text;
  }
  /** The route note now, or as it read before any of her changes: the data alone. */
  function noteText(language: VisitorLang, before = false) {
    const mine = before ? blankEdits : edits, gone = (stretches: readonly number[]) => !before && removed(stretches);
    const lines: string[] = [];
    let steps = false;
    for (const spot of walk.spots) {
      const fix = isFixed(mine, spot.stretches), subject = subjectOf(spot), said = answerOf(mine, spot.id), at = whereOf(spot), m = Math.round(spot.from);
      // Her answer says what is there now; a spot she has not answered keeps what the photos or OpenStreetMap show.
      const line = said ? answerLine(said.question, said.answer, accessOfSpot(spot), at, m, language) : undefined;
      if (fix) lines.push(fixedLine(kindOfSubject(subject), at, spot.from, fix.at, language));
      else if (gone(spot.stretches) || line === null) { /* off her map, or nothing for the note */ }
      else if (line) lines.push(line);
      else if (spot.kind === 'flagged') { lines.push((spot.findings.some(f => f.viewId) ? NOTE.barrier : NOTE.mapped)[language](subject, at, m)); steps ||= subject === 'steps'; }
      const own = noteOf(mine, routeSpotFor(spot.stretches)?.id ?? spot.id); if (own) lines.push(...ownNoteLines(own, language));
    }
    // A kind along much of the walk, in the note when she says so; cobblestones whenever she answered for them.
    for (const one of items) if (!('spot' in one) && KIND_NOTE[one.mark as keyof typeof KIND_NOTE]) {
      const said = answerOf(mine, one.key)?.answer;
      if (said === 'yes' || (one.mark === 'cobblestones' && said && said !== 'unknown')) lines.push(KIND_NOTE[one.mark as keyof typeof KIND_NOTE][language]);
    }
    if (around?.status === 'found' && !before && ways.check?.works) {
      const avoided = walk.spots.find(spot => around.avoids.some(steps => steps.stretches.some(index => spot.stretches.includes(index))));
      if (avoided) lines.push(AROUND_NOTE[language](whereOf(avoided), Math.max(0, Math.round(((around.lengthMetres ?? around.walkMetres) - around.walkMetres) / 10) * 10)));
    }
    for (const spot of mine.added) {
      const fix = isFixed(mine, [spot.stretch]), stretch = data.stretches[spot.stretch], here = nearOf(spot.stretch);
      if (fix) lines.push(fixedLine(spot.kind, here, stretch.from, fix.at, language));
      else { lines.push(NOTE.added[language](spot.kind, here, Math.round(stretch.from))); steps ||= spot.kind === 'steps'; }
      lines.push(...ownNoteLines(spot.note, language));
    }
    const walkNote = noteOf(mine, WALK_NOTE); if (walkNote) lines.push(...ownNoteLines(walkNote, language));
    if (!lines.length) return '';
    const end = (name: string) => { const spot = routeSpots.find(item => !item.stretches.length && item.landmark === name); return !spot ? name : language === 'ko' ? spot.aliases.ko?.[0] ?? spot.name.en : spot.name[language]; };
    const head = walk.start ? NOTE.title[language](end(walk.start.name), end(walk.target.name), about(data.lengthMetres)) : data.title;
    return [head, ...lines, ...(steps ? [NOTE.steps[language]] : []), (!data.photos.length ? NOTE.basisMapped : Object.values(mine.answers).some(said => said.answer !== 'unknown') ? NOTE.basisChecked : NOTE.basis)[language]].join('\n');
  }
  function copy(text: string, done: string) { navigator.clipboard.writeText(text).then(() => setSaid(done), () => setSaid(t.copyFailed)); }

  // What visitors keep raising: the model's reading of each filed message, counted per spot and kind of message.
  const insights = useMemo(() => {
    const groups = new Map<string, { key: string; kind: 'problem' | 'praise' | 'question'; count: number }>();
    for (const message of review.messages) {
      if (!message.spot) continue;
      const kind = message.answer?.kind ?? 'problem', id = `${message.spot} ${kind}`;
      const group = groups.get(id) ?? { key: message.spot, kind, count: 0 };
      group.count++; groups.set(id, group);
    }
    return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  }, [review.messages]);
  const walkSlots = useMemo(() => ({ ...walkSlotsOf(data, lang, authored), messages: rows.length }), [data, lang, authored, rows.length]);

  // What the map shows for the step: the thing it is about, ranked suggestions, and how the camera frames them.
  const current = step.id === 'message' || step.id === 'reply' ? messageOf(rows[step.at]?.id ?? '') : null;
  const ranked = step.id === 'message' && !current?.spot ? current?.answer?.candidates ?? [] : [];
  const rankOf = (target: Target) => { const rank = ranked.findIndex(key => same(targetOf(key), target)) + 1; return rank || undefined; };
  const item = step.id === 'check' ? items[step.at] ?? null : null;
  const selected: Target | null = item && 'spot' in item ? { kind: 'spot', id: item.spot.id }
    : (step.id === 'message' || step.id === 'reply') && current?.spot ? targetOf(current.spot)
    : step.id === 'missed' ? step.here ?? null : step.id === 'propose' ? step.proposal.target : null;
  const filedCounts = new Map<string, number>();
  for (const message of review.messages) if (message.spot) filedCounts.set(message.spot, (filedCounts.get(message.spot) ?? 0) + 1);
  // Each spot as the data has it and as her edits leave it; a spot whose two differ, or that she answered for, is ringed in both views.
  const markers: Marker[] = walk.spots.map(spot => {
    const target: Target = { kind: 'spot', id: spot.id }, fixNow = isFixed(edits, spot.stretches), fix = !before && fixNow, count = filedCounts.get(keyOf(target)) ?? 0;
    const saidNow = answerOf(edits, spot.id), said = before ? null : saidNow, fromAnswer = said ? stateOfAnswer(said.answer) : null;
    const recorded: MarkerState = spot.kind === 'no-photos' ? 'no-photos' : 'open';
    const state: MarkerState = fix ? 'fixed' : !before && removed(spot.stretches) ? 'not-barrier' : fromAnswer ?? recorded;
    const subject = subjectOf(spot), tag = tagOf(target);
    const icon = state === 'fixed' ? 'fixed' : state === 'not-barrier' ? 'dismissed' : state === 'no-photos' ? 'no-photos' : subject === 'path' ? iconFor(spot.findings[0]?.concept ?? '') ?? 'path' : subject;
    return { id: spot.id, at: spot.at, state, selected: same(selected, target), rank: rankOf(target), count, tag, icon, kind: kindOf(spot.findings[0]?.concept ?? '') ?? undefined, label: [spotName(spot), ...(count ? [t.inbox.visitors(count)] : [])].join(', '),
      changed: !!fixNow || !!saidNow || removed(spot.stretches) };
  });
  // A spot she added lifts away before her changes and drops back in with them.
  for (const spot of edits.added) {
    const target: Target = { kind: 'added', id: spot.id }, at = pointOf(target), fix = isFixed(edits, [spot.stretch]), count = filedCounts.get(spot.id) ?? 0;
    if (at) markers.push({ id: `added:${spot.id}`, at, state: before ? 'added' : fix ? 'fixed' : 'barrier', selected: !before && same(selected, target), rank: rankOf(target), count,
      tag: tagOf(target), icon: fix ? 'fixed' : 'added', label: addedName(spot.id), changed: true, gone: before });
  }
  const extra = [...ranked.map(targetOf), selected].filter((target): target is Target => !!target && (target.kind === 'landmark' || target.kind === 'stretch'));
  for (const target of extra) {
    const id = target.kind === 'landmark' ? `landmark:${target.id}` : `stretch:${(target as { index: number }).index}`, at = pointOf(target);
    if (!at || markers.some(marker => marker.id === id)) continue;
    markers.push({ id, at, state: target.kind === 'landmark' ? 'landmark' : 'clear', selected: same(selected, target), rank: rankOf(target), label: nameOf(target) });
  }
  const tapMarker = (id: string) => { const target = markerTarget(id); if (target) select(target); };
  function markerTarget(id: string): Target | null {
    if (id.startsWith('landmark:')) return { kind: 'landmark', id: id.slice(9) };
    if (id.startsWith('stretch:')) return { kind: 'stretch', index: Number(id.slice(8)) };
    if (id.startsWith('added:')) return { kind: 'added', id: id.slice(6) };
    return spotById(id) ? { kind: 'spot', id } : null;
  }
  const highlight = selected?.kind === 'spot' ? spotById(selected.id)?.path ?? null
    : selected && (selected.kind === 'stretch' || selected.kind === 'added') ? stretchesOf(selected).flatMap(index => data.stretches[index].line.map(walk.project)) : null;
  const labels = useMemo(() => {
    const name = (landmark: string) => routeSpots.find(spot => !spot.stretches.length && spot.landmark === landmark)?.name[lang] ?? fromRecord(landmark, lang);
    return [...(walk.start ? [{ name: name(walk.start.name), at: walk.start.at, dy: 20 }] : []), { name: name(walk.target.name), at: walk.target.at, dy: 22 }, ...walk.landmarks.filter(l => l.kind === 'building' || l.kind === 'street').map(l => ({ name: routeSpots.find(spot => !spot.stretches.length && spot.landmark === l.name)?.name[lang] ?? (l.kind === 'street' && !/^calle /i.test(l.name) ? `Calle ${l.name}` : l.name), at: l.at }))];
  }, [walk, lang, routeSpots]);

  // The map keeps clear of the dialogue docked below it, and frames what the step is about once the dialogue has settled.
  // On a wide screen the card sits at the left edge and her choices at the right, so the map frames its subject in the free middle.
  const [frame, setFrame] = useState({ dock: 0, below: 0, left: 0, right: 0 });
  const dockHeight = frame.dock;
  useLayoutEffect(() => {
    const host = screen.current, work = dock.current;
    if (!host || !work) return;
    // The line is a new element with each turn, so its size is watched afresh after every render.
    const measure = () => {
      const line = host.querySelector<HTMLElement>('.ui-dialogue'), below = line?.offsetHeight ?? 0, above = work.offsetHeight, box = host.getBoundingClientRect();
      host.style.setProperty('--dialogue', `${below}px`);
      const wide = box.width >= 1024, content = wide ? work.querySelector('.gs-content')?.getBoundingClientRect() : undefined, actions = wide ? work.querySelector('.gs-actions')?.getBoundingClientRect() : undefined;
      const next = { dock: below + (above ? above + 12 : 0), below, left: content ? Math.round(content.right - box.left) : 0, right: actions ? Math.round(box.right - actions.left) : 0 };
      setFrame(last => last.dock === next.dock && last.below === next.below && last.left === next.left && last.right === next.right ? last : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(work);
    const line = host.querySelector('.ui-dialogue'); if (line) observer.observe(line);
    return () => observer.disconnect();
  });
  const inset = safeArea();
  // The map always keeps some room above the dialogue, however tall the dialogue grows, so the walk can still be framed.
  const top = (narrow ? 64 : 76) + inset.top, under = (height: number) => Math.max(120, Math.min(height + 16, innerHeight - top - 180));
  const sides = frame.left > 0 || frame.right > 0;
  const insets = { top, right: Math.max(24 + inset.right, sides ? frame.right + 24 : 0), bottom: under(sides ? frame.below : dockHeight), left: Math.max(24 + inset.left, sides ? frame.left + 24 : 0) };
  const aimFor = (): { kind: 'fit' } | { kind: 'frame'; points: Point[] } => {
    if (step.id === 'around' && around) return { kind: 'frame', points: around.line.map(point => walk.project(point as [number, number])) };
    if (step.id === 'street' && step.found) return { kind: 'frame', points: step.found.line.map(point => walk.project(point as [number, number])) };
    if (item && !('spot' in item)) return item.points.length ? { kind: 'frame', points: item.points } : { kind: 'fit' };
    if (item) return { kind: 'frame', points: item.spot.path.length ? item.spot.path : [item.spot.at] };
    if (ranked.length) { const points = ranked.map(targetOf).filter((target): target is Target => !!target).map(pointOf).filter((point): point is Point => !!point); if (points.length) return { kind: 'frame', points }; }
    const at = selected && pointOf(selected);
    return at ? { kind: 'frame', points: [at] } : { kind: 'fit' };
  };
  const aimKey = JSON.stringify([step.id, 'at' in step ? step.at : null, selected, ranked, step.id === 'street' && !!step.found]);
  const aimTimer = useRef(0), settledDock = [insets.left, insets.right, insets.bottom].map(value => Math.round(value / 24)).join();
  useEffect(() => {
    clearTimeout(aimTimer.current);
    aimTimer.current = window.setTimeout(() => {
      const aim = aimFor(), handle = map.current;
      if (!handle) return;
      handle.show(aim.kind === 'fit' ? { kind: 'route' } : { kind: 'points', points: aim.points }, insets);
    }, 220);
    return () => clearTimeout(aimTimer.current);
  }, [aimKey, narrow, settledDock]); // eslint-disable-line react-hooks/exhaustive-deps

  // The step: what the guide says, what opens above the dialogue, her choices, and whether she can answer in her own words.
  const lines: string[] = ack ? [ack] : [];
  let above: ReactNode = null, chips: Chip[] = [], words: ((text: string) => void) | null = null, progress = '';
  const kindChips = (pick: (kind: EditKind) => void, pressed?: EditKind): Chip[] => EDIT_KINDS.map(kind => ({ id: `kind-${kind}`, label: s.words.kinds[kind], pressed: pressed === undefined ? undefined : pressed === kind, onClick: () => pick(kind) }));
  const helloChips: Chip[] = [
    ...(items.length ? [{ id: 'check', label: s.hello.chips.check, primary: step.id === 'hello', onClick: () => go({ id: 'check', at: 0 }) }] : []),
    ...(rows.length ? [{ id: 'messages', label: s.hello.chips.messages, primary: step.id === 'checkEnd', onClick: () => go({ id: 'message', at: 0 }) }] : []),
    { id: 'missed', label: s.hello.chips.missed, onClick: () => go({ id: 'missed' }) },
    { id: 'note', label: s.hello.chips.note, onClick: () => go({ id: 'note' }) },
  ];

  if (step.id === 'hello') {
    lines.push(...(settled ? [] : [s.hello.greet(walkSlots)]), data.views.length ? s.hello.walk(walkSlots) : s.hello.mapOnly(walkSlots));
    chips = helloChips;
    words = hear;
  } else if (step.id === 'check' && item) {
    const slots = slotsOf(item, step.at), question = questionOf(item), chosen = answerOf(edits, item.key);
    if (step.tapping) {
      lines.push(s.check.tapWhere(slots));
      chips = [{ id: 'cancel', label: s.back, onClick: () => setStep({ id: 'check', at: step.at }) }];
    } else if (step.kind) {
      lines.push(s.check.said.unseen.something(slots));
      chips = [...kindChips(kind => somethingThere(step.at, kind)), { id: 'cancel', label: s.back, onClick: () => setStep({ id: 'check', at: step.at }) }];
    } else {
      const about = !('spot' in item) ? s.check.kind({ n: slots.n, total: slots.total, what: slots.what, count: item.count })
        : item.access === 'unseen' ? s.check.noPhotos(slots) : !data.views.length ? s.check.osm(slots) : slots.when ? s.check.sawWhen(slots) : s.check.saw(slots);
      lines.push(about, ...(slots.osm ? [s.check.osmToo(slots)] : []), s.check.ask[question](slots));
      chips = (QUESTIONS[question] as readonly Answer[]).map(choice => ({ id: choice, label: (s.check.answers[question] as Record<string, string>)[choice], pressed: chosen ? chosen.answer === choice : undefined, onClick: () => answer(step.at, question, choice) }));
      if (around?.status === 'found' && 'spot' in item && around.avoids.some(steps => steps.stretches.some(index => item.spot.stretches.includes(index))))
        chips.push({ id: 'around', label: s.around.chips.show, onClick: () => go({ id: 'around', at: step.at }) });
      chips.push({ id: 'skip', label: s.check.chips.skip, onClick: () => { setSkipped(list => new Set(list).add(item.key)); go(nextCheck(step.at)); } });
    }
    words = hear;
    above = <CheckCard key={item.key} data={data} progress={s.check.progress({ n: step.at + 1, total: items.length })} title={'spot' in item ? tagOf({ kind: 'spot', id: item.spot.id }) : ''} affects={s.words.affects[item.access]}
      empty={data.views.length ? t.noPhotos : s.check.noStreetPhotos} evidence={'spot' in item ? item.spot.findings.filter(f => f.viewId && views.has(f.viewId)) : []} viewId={'spot' in item ? null : item.viewId}
      stretches={'spot' in item ? item.spot.stretches : []} markers={markers} onMarker={tapMarker} onPick={id => pickFinding(step.at, id)} height={narrow ? Math.round(Math.min(150, innerHeight * 0.18)) : undefined} lang={lang} words={{ photo: s.check.photo, previous: t.previous, next: t.next }} />;
  } else if (step.id === 'checkEnd') {
    const tally = { total: items.length, answered: 0, unknown: 0, skipped: 0 };
    for (const one of items) { const chosen = answerOf(edits, one.key)?.answer; if (!chosen) tally.skipped++; else if (chosen === 'unknown') tally.unknown++; else tally.answered++; }
    lines.push(s.check.end(tally));
    chips = helloChips.filter(chip => chip.id !== 'check');
    words = hear;
  } else if (step.id === 'message' || step.id === 'reply') {
    const row = rows[step.at];
    if (!row) { lines.push(s.messages.none); chips = helloChips.filter(chip => chip.id !== 'messages'); }
    else if (step.id === 'message') {
      const message = current, answer = message?.answer ?? null, language = s.words.languages[row.language] ?? row.language;
      if (step.at === 0 && !ack) lines.push(s.messages.intro({ total: rows.length }));
      lines.push(s.messages.arrived({ n: step.at + 1, total: rows.length, language }));
      const first = answer?.candidates.map(targetOf).find((target): target is Target => !!target) ?? null;
      if (busy === 'download') { if (model.status === 'downloading') progress = s.model.downloading({ done: Math.round(model.loadedBytes / 1e6), total: Math.round(model.totalBytes / 1e6) }); else lines.push(s.model.reading); }
      else if (reading === row.id || (!message && ai)) lines.push(s.model.reading);
      else if (!message && !ai) {
        lines.push(unkept === 'not-kept' ? s.model.notKept : unkept === 'stopped' ? s.model.stopped : downloadBytes === null || model.status === 'failed' ? s.model.failed : s.model.download({ mb: Math.max(1, Math.round((downloadBytes ?? 0) / 1e6)) }));
        chips = [
          ...(unkept ? [{ id: 'retry', label: s.model.tryAgain, onClick: () => void download() }] : downloadBytes ? [{ id: 'download', label: s.model.downloadChip({ mb: Math.max(1, Math.round(downloadBytes / 1e6)) }), primary: true, disabled: !!busy, onClick: () => void download() }] : []),
          { id: 'without', label: s.model.withoutChip, onClick: () => withoutAi(row) },
        ];
      } else if (message?.spot) { const target = targetOf(message.spot); lines.push(s.messages.filed({ spot: target ? spotWords(target) : message.spot })); }
      else if (!readable(row.text) && !message?.spot) lines.push(s.messages.unreadable);
      else if (step.another || !answer) lines.push(s.messages.tap);
      else if (first && answer.remembered) lines.push(s.messages.remembered({ spot: spotWords(first) }));
      else if (first && answer.status === 'ready') lines.push(s.messages.spot({ spot: spotWords(first) }));
      else if (first) lines.push(s.messages.unsure);
      else lines.push(answer.kind ? s.messages.noSpot : s.messages.unplaced);
      if (message && !chips.length) {
        if (message.spot) chips.push({ id: 'reply', label: s.reply.copy, primary: true, onClick: () => go({ id: 'reply', at: step.at }) });
        else {
          // Asking the visitor where is always offered when the spot is uncertain, and comes first when nobody could place it.
          const ask: Chip = { id: 'askWhere', label: s.messages.chips.askWhere, onClick: () => file(step.at, null, true) };
          const sure = !!first && (answer?.status === 'ready' || !!answer?.remembered);
          if (!first || step.another) chips.push({ ...ask, primary: true });
          if (first && (answer?.status === 'ready' || answer?.remembered) && !step.another) chips.push({ id: 'yes', label: s.messages.chips.yes, primary: true, onClick: () => file(step.at, first) });
          else if (first && !step.another) for (const [i, key] of answer!.candidates.entries()) { const target = targetOf(key); if (target) chips.push({ id: `c${i}`, label: tagOf(target), onClick: () => file(step.at, target) }); }
          if (first && !step.another) chips.push({ id: 'another', label: s.messages.chips.another, onClick: () => setStep({ ...step, another: true }) }, ...(sure ? [] : [ask]));
          chips.push({ id: 'noSpot', label: s.messages.chips.noSpot, onClick: () => file(step.at, null) });
        }
      }
      chips.push({ id: 'skip', label: s.messages.chips.skip, onClick: () => go(nextMessage(step.at)) });
      above = <section className="gs-card gs-quote" data-tone="dark" aria-label={language}>
        <p className="gs-card-meta"><Tag tone="solid" lang={row.language === 'other' ? undefined : row.language}>{row.language.toUpperCase()}</Tag>{row.example && <Tag tone="example">{s.messages.example}</Tag>}{row.translated && <Tag tone="example">{s.messages.translated}</Tag>}<span>{t.pageOf(step.at + 1, rows.length)}</span></p>
        <blockquote lang={row.language === 'other' ? undefined : row.language}>{row.text}</blockquote>
      </section>;
    } else {
      const message = current, replyIn = replyLang ?? replyLanguage(row.language);
      lines.push(s.reply.say({ n: step.at + 1, total: rows.length, language: s.words.languages[replyIn] ?? replyIn }));
      if (message) { const text = replyText(message, replyIn, step.ask); above = <TextBox text={text} lang={replyIn} onLang={setReplyLang} copyLabel={s.reply.copy} copiedLabel={s.reply.copied} />; }
      chips = [{ id: 'next', label: step.at + 1 < rows.length ? s.messages.chips.next : s.check.chips.next, primary: true, onClick: () => go(nextMessage(step.at)) }];
    }
  } else if (step.id === 'insights') {
    lines.push(insights.length ? s.insights.intro : s.insights.none);
    if (insights.length) above = <ul className="gs-card gs-insights" data-tone="dark">{insights.map(group => {
      const target = targetOf(group.key); if (!target) return null;
      const spot = target.kind === 'spot' ? spotById(target.id) : null;
      const kind = spot?.kind === 'flagged' ? s.words.access[accessOfSpot(spot)] : target.kind === 'added' ? s.words.added[added(target.id)?.kind ?? 'other'] : '';
      return <li key={`${group.key} ${group.kind}`}><span>{s.insights[group.kind]({ spot: spotWords(target), count: group.count, kind })}</span><button type="button" className="gs-inline" onClick={() => select(target)}>{s.insights.chips.open}</button></li>;
    })}</ul>;
    chips = [{ id: 'next', label: s.insights.chips.next, primary: true, onClick: () => go({ id: 'missed' }) }];
  } else if (step.id === 'street') {
    const trouble = step.trouble === 'busy' ? s.street.busy : step.trouble === 'too-far' ? s.street.tooFar : step.trouble === 'too-long' ? s.street.tooLong : step.trouble === 'offline' ? s.street.offline : step.trouble ? s.street.failed : null;
    const cancel: Chip = { id: 'cancel', label: s.street.chips.cancel, onClick: () => { routing.current?.abort(); setBusy(null); back(); } };
    if (trouble) { lines.push(trouble); chips = [{ id: 'again', label: s.street.chips.again, primary: true, onClick: () => setStep({ id: 'street' }) }, cancel]; }
    else if (step.found) {
      const found = step.found;
      lines.push(s.street.found({ metres: Math.round(found.lengthMetres), osm: found.findings.length }));
      chips = [{ id: 'keep', label: s.street.chips.keep, primary: true, onClick: () => {
        const next = addStreet(ways, found); setWays(next); if (!saveLines(next)) setProblem(s.notSaved);
        go({ id: 'missed' }, s.street.kept({ street: found.name ?? found.streets[0] ?? s.street.chips.add }));
      } }, { id: 'again', label: s.street.chips.again, onClick: () => setStep({ id: 'street' }) }, cancel];
    } else if (step.from && step.to) { lines.push(s.street.routing); chips = [cancel]; }
    else { lines.push(...(step.from ? [s.street.end] : [s.street.offer, s.street.start])); chips = [cancel]; }
  } else if (step.id === 'missed') {
    if (step.here) {
      const here = step.here;
      lines.push(s.missed.here({ spot: spotWords(here) }));
      chips = kindChips(kind => go({ id: 'propose', proposal: { mode: 'add', text: '', target: here, kind, from: { id: 'missed' } } }));
    } else {
      lines.push(s.missed.ask);
      chips = [{ id: 'done', label: s.missed.chips.done, primary: true, onClick: () => go({ id: 'note' }) }, { id: 'street', label: s.street.chips.add, onClick: () => go({ id: 'street' }) }];
    }
    words = hear;
  } else if (step.id === 'around' && around) {
    // Her answer is her record of the way, never a measurement; nothing about it is claimed until she says it works.
    const said = (works: boolean | null, line: string) => () => { const next = setCheck(ways, works); setWays(next); if (!saveLines(next)) setProblem(s.notSaved); go(nextCheck(step.at), line); };
    lines.push(s.around.offer({ metres: Math.max(0, Math.round((around.lengthMetres ?? around.walkMetres) - around.walkMetres)) }), s.around.show, s.around.ask);
    chips = [{ id: 'works', label: s.around.chips.works, primary: true, onClick: said(true, s.around.kept) }, { id: 'notWorks', label: s.around.chips.notWorks, onClick: said(false, s.around.dropped) },
      { id: 'unknown', label: s.around.chips.unknown, onClick: said(null, s.around.unchecked) }, { id: 'notNow', label: s.around.chips.notNow, onClick: back }];
  } else if (step.id === 'propose') {
    const proposal = step.proposal;
    if (proposal.mode === 'note') lines.push(s.check.words({ spot: spotWords(proposal.target) }));
    else { lines.push(s.missed.propose({ kind: s.words.added[proposal.kind], where: whereWords(proposal.target) })); chips = kindChips(kind => setStep({ id: 'propose', proposal: { ...proposal, kind } }), proposal.kind); }
    chips = [{ id: 'yes', label: s.missed.chips.yes, primary: true, onClick: () => confirm(proposal) }, ...chips, { id: 'no', label: s.missed.chips.no, onClick: back }];
    if (proposal.text) above = <section className="gs-card gs-quote" data-tone="dark"><blockquote>{proposal.text}</blockquote></section>;
  } else if (step.id === 'edit') {
    lines.push(step.mode === 'add' ? s.edit.addSpot : step.mode === 'change' ? s.edit.changeSpot : step.mode === 'note' ? s.edit.note : s.edit.ask);
    if (!step.mode) chips = [{ id: 'add', label: s.edit.chips.addSpot, onClick: () => go({ id: 'edit', mode: 'add' }) }, { id: 'change', label: s.edit.chips.changeSpot, onClick: () => go({ id: 'edit', mode: 'change' }) },
      { id: 'street', label: s.edit.chips.addStreet, onClick: () => go({ id: 'street' }) }, { id: 'note', label: s.edit.chips.note, onClick: () => go({ id: 'edit', mode: 'note' }) }];
    // Her note for the whole walk is her own words, kept as she wrote them; anything else she says proposes a spot.
    if (step.mode === 'add') words = hear;
    if (step.mode === 'note') words = text => { edit(edits => setNote(edits, WALK_NOTE, ownNote(text, noteLangOf(guessLanguage(text))))); go({ id: 'note' }, s.edit.noteSaved); };
  } else if (step.id === 'note') {
    const text = noteText(noteLang, before);
    if (step.clearing) {
      lines.push(s.restart.ask);
      chips = [{ id: 'yes', label: s.restart.yes, onClick: () => { commit(startOver); edit(clearEdits); if (place) void forgetPlace(place.id); setSkipped(new Set()); setResume(null); history.current = []; setStep({ id: 'hello' }); setAck(''); } },
        { id: 'no', label: s.restart.no, primary: true, onClick: () => setStep({ id: 'note' }) }];
    } else {
      lines.push(text ? s.note.say : s.note.empty);
      chips = [...helloChips.filter(chip => chip.id === 'check' || chip.id === 'messages').map(chip => ({ ...chip, primary: false })),
        ...(review.messages.length || Object.keys(review.decisions).length || edits.added.length || Object.keys(edits.fixed).length || Object.keys(edits.notes).length || Object.keys(edits.answers).length ? [{ id: 'restart', label: s.restart.chip, onClick: () => setStep({ id: 'note', clearing: true }) }] : [])];
    }
    if (text) above = <TextBox text={text} lang={noteLang} onLang={setNoteLang} copyLabel={s.note.copy} copiedLabel={s.note.copied} />;
  }

  // While a step waits behind an edit, going back to it is always one choice away.
  if (resume && !(step.id === 'note' && step.clearing)) chips = [...chips, { id: 'resume', label: s.edit.chips.back, onClick: () => { const paused = resume; setResume(null); history.current.push(step); setStep(paused); setAck(''); } }];

  /** A tap on an outline in the photo moves the check to the spot it belongs to. */
  function pickFinding(at: number, id: string) {
    const spot = walk.spots.find(one => one.findings.some(f => f.id === id));
    const there = spot ? items.findIndex(one => 'spot' in one && one.spot.id === spot.id) : -1;
    if (there >= 0 && there !== at) go({ id: 'check', at: there });
  }

  const working = busy === 'reading' || busy === 'download';
  const shownPlace: MenuPlace | undefined = data.id === 'cusco-qorikancha' ? data.id : undefined;
  const turn = `${JSON.stringify(step)} ${ack}`;

  // The bot is out in the map on every step: beside the spot the conversation is about, on the side away from its caption, and
  // travelling with the camera; with no spot it waits at the free map's lower left, just above the dialogue.
  const lens = useRef<Lens | null>(null);
  const focusTarget = selected ?? (ranked.length ? targetOf(ranked[0]) : null);
  const botAim = useRef({ focus: null as Point | null, insets });
  botAim.current = { focus: focusTarget ? pointOf(focusTarget) : null, insets };
  const placeBot = useCallback(() => {
    const element = bot.current, host = screen.current;
    if (!element || !host) return;
    const box = host.getBoundingClientRect(), size = element.offsetWidth || 52, { focus, insets: free } = botAim.current;
    const at = focus && lens.current ? lens.current.at(focus) : null;
    const away = host.querySelector<HTMLElement>('.route-marker[aria-pressed="true"], .route-marker[data-rank="1"]')?.dataset.side === 'left' ? 1 : -1;
    const [x, y] = at ? [at[0] + away * (size / 2 + 20) - size / 2, at[1] - size - 20] : [free.left + 24, box.height - free.bottom - 24 - size];
    const right = box.width - free.right - size, bottom = box.height - free.bottom - size;
    element.style.transform = `translate(${Math.round(Math.max(free.left - 12, Math.min(right + 12, x)))}px, ${Math.round(Math.max(free.top, Math.min(bottom, y)))}px)`;
    element.dataset.placed = '';
  }, []);
  const onLens = useCallback((next: Lens) => { lens.current = next; placeBot(); }, [placeBot]);
  useLayoutEffect(() => { placeBot(); });
  useEffect(() => { addEventListener('resize', placeBot); return () => removeEventListener('resize', placeBot); }, [placeBot]);
  // A number key picks that choice, as in a game, unless she is typing.
  const choicesNow = useRef(chips); choicesNow.current = chips;
  const talk = useRef<((talking: boolean) => void) | null>(null);
  const sayKey = lines.join('\n');
  useLayoutEffect(() => { screen.current?.toggleAttribute('data-ready', !sayKey || working); }, [sayKey, working]);
  useEffect(() => {
    const pick = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || (event.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')) return;
      const n = Number(event.key);
      const chip = Number.isInteger(n) && n >= 1 && n <= 9 && screen.current?.hasAttribute('data-ready') ? choicesNow.current[n - 1] : undefined;
      if (chip && !chip.disabled) { event.preventDefault(); chip.onClick(); }
    };
    addEventListener('keydown', pick);
    return () => removeEventListener('keydown', pick);
  }, []);

  return <main ref={screen} className="guide-screen route-canvas" data-step={step.id} aria-label={t.workspace} lang={lang} style={{ '--dock': `${dockHeight}px` } as CSSProperties}
    onKeyDown={event => { if (event.key === 'Escape' && history.current.length) back(); }}>
    <header className="gs-bar">
      <div className="gs-place"><h1>{DESTINATIONS[data.id]?.name ?? data.target.name}</h1><p>{t.walk(walk.start ? routeSpots.find(spot => !spot.stretches.length && spot.landmark === walk.start!.name)?.name[lang] ?? walk.start.name : data.title, Math.round(data.lengthMetres))}</p>{caption && <p>{caption}</p>}</div>
      <div className="gs-edits">
        <GlassButton className="gs-edit" icon={<NoteIcon />} pressed={step.id === 'edit'} onClick={openEdit}>{s.edit.chip}</GlassButton>
        {changed && <Segmented className="gs-compare" surface="glass" label={s.compare.label} value={before ? 'before' : 'now'} options={[{ value: 'before', label: s.compare.before }, { value: 'now', label: s.compare.now }]}
          onChange={next => { setView(next); setAck(next === 'before' ? s.compare.saidBefore : s.compare.saidNow); }} />}
      </div>
      <Menu onHome={onHome} current={shownPlace} onPlace={next => { if (next !== shownPlace) (onPlace ?? onHome)(next); }} />
    </header>
    <div className="gs-map">
      <RouteMap ref={map} settled={settled} data={data} photoView="" walk={walk} markers={markers} labels={labels} insets={insets} highlight={highlight}
        onMarker={tapMarker} onMap={tapMap} onPhoto={tapPhoto} onLens={onLens}
        picking={step.id === 'street' && !step.found ? 'free' : (step.id === 'check' && !!step.tapping) || step.id === 'missed' || (step.id === 'message' && !!step.another) || (step.id === 'edit' && (step.mode === 'add' || step.mode === 'change')) || undefined}
        paths={before ? [] : [...mapPaths(step.id === 'around' || ways.check?.works ? around : null, ways.streets), ...(step.id === 'street' && step.found ? [{ id: 'new', kind: 'street' as const, line: step.found.line.map(point => [point[0], point[1]] as [number, number]) }] : [])]}
        words={t.map} clearBottom={dockHeight + 12} ariaLabel={data.title} />
    </div>
    <Bot ref={bot} working={working} talk={talk} />
    <div className="gs-work" ref={dock} data-content={above ? '' : undefined}>
      <div key={turn} className="gs-turn">
        {above && <div className="gs-content">{above}</div>}
        {(chips.length > 0 || history.current.length > 0) && <div className="gs-actions">
          <Options chips={chips} />
          {history.current.length > 0 && <button type="button" className="gs-back" onClick={back}>{s.back}</button>}
        </div>}
      </div>
    </div>
    <Dialogue key={`line ${turn}`} say={lines} onTalking={value => talk.current?.(value)} onDone={() => screen.current?.setAttribute('data-ready', '')} continueLabel={s.more} advanceAfter={1400} label={t.workspace} lang={lang}
      working={busy === 'reading'} workingLabel={s.model.reading}
      composer={words ? <Composer label={s.input.placeholder} sendLabel={s.input.send} onSend={text => void words!(text)} disabled={busy === 'reading'} lang={lang} maxLength={300} /> : undefined}>
      {progress && <p className="gs-progress">{progress}</p>}
      {problem && <p className="gs-problem" role="alert">{problem}</p>}
    </Dialogue>
  </main>;
}

/**
 * The photo for one item of the check, with every outline named on the photo itself, where it is and who it affects. Where the walk
 * has 3D, she can turn to it and tap spots there as on the map. It lives outside the screen so a new line never rebuilds the photo.
 */
function CheckCard({ data, progress, title, affects, empty, evidence, viewId, stretches, markers, onMarker, onPick, height, lang, words }: {
  data: Destination; progress: string; title: string; affects: string; empty: string;
  /** The findings a photo shows, one page each; none for another kind near the walk, which shows viewId instead. */
  evidence: readonly { id: string; viewId?: string | null }[]; viewId: string | null;
  stretches: readonly number[]; markers: Marker[]; onMarker: (id: string) => void; onPick: (findingId: string) => void;
  /** The photo's height on a phone, which leaves a strip of map above the card; a wide screen shows the whole photo. */
  height?: number; lang: 'en' | 'es'; words: { photo: (s: { n: number; total: number }) => string; previous: string; next: string } }) {
  const [page, setPage] = useState(0);
  const at = Math.min(page, Math.max(0, evidence.length - 1)), lead = evidence[at] ?? null;
  const turn = (by: number) => setPage(Math.max(0, Math.min(evidence.length - 1, at + by)));
  // A sideways swipe on the photo turns it on a phone; the tap that ends a swipe never picks an outline.
  const swipe = useRef<{ x: number; y: number } | null>(null), swiped = useRef(false);
  const shown = photoOf(data, evidence.length ? lead?.viewId : viewId);
  return <section className="gs-card gs-photo" data-tone="dark" aria-label={progress}>
    <p className="gs-card-meta"><span>{progress}</span>{title && <span>{title}</span>}{evidence.length > 1 && <span className="gs-pager">
      <button type="button" className="gs-turn-photo" aria-label={words.previous} disabled={at === 0} onClick={() => turn(-1)}><ChevronIcon size={18} style={{ transform: 'scaleX(-1)' }} /></button>
      <span aria-live="polite">{words.photo({ n: at + 1, total: evidence.length })}</span>
      <button type="button" className="gs-turn-photo" aria-label={words.next} disabled={at === evidence.length - 1} onClick={() => turn(1)}><ChevronIcon size={18} /></button></span>}</p>
    {shown ? <PhotoOr3D data={data} stretches={stretches} markers={markers} onMarker={onMarker} height={height}>
      <div className="gs-swipe" onPointerDown={event => { swipe.current = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY }; }}
        onPointerUp={event => { const from = swipe.current; swipe.current = null; if (!from || evidence.length < 2) return; const dx = event.clientX - from.x;
          if (Math.abs(dx) > 48 && Math.abs(dx) > 2 * Math.abs(event.clientY - from.y)) { swiped.current = true; turn(dx < 0 ? 1 : -1); } }}
        onClickCapture={event => { if (swiped.current) { swiped.current = false; event.stopPropagation(); event.preventDefault(); } }}>
        <LabelledPhoto {...shown} selected={lead?.id ?? null} onSelect={onPick} lang={lang} height={height} fit={height ? 'cover' : 'contain'} />
      </div>
    </PhotoOr3D>
      : <p className="gs-empty">{empty}</p>}
    <p className="gs-affects">{affects}</p>
  </section>;
}

/** Text she copies for someone else, the whole of it, with its language and Copy inside the box. */
function TextBox({ text, lang, onLang, copyLabel, copiedLabel }: { text: string; lang: VisitorLang; onLang: (lang: VisitorLang) => void; copyLabel: string; copiedLabel: string }) {
  return <CopyBox className="gs-copybox" text={text} lang={lang} lead copyLabel={copyLabel} copiedLabel={copiedLabel}
    meta={<span className="gs-langs" role="group">{VISITOR_LANGS.map(item => <button key={item.id} type="button" className="gs-lang" aria-pressed={lang === item.id} lang={item.id} onClick={() => onLang(item.id)}>{item.label}</button>)}</span>}>
    <Swap value={text} lang={lang} />
  </CopyBox>;
}

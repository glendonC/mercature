import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import DestinationWorkspace from '../destinations/DestinationWorkspace';
import RecordedPreview from './RecordedPreview';
import GeographicMap, { MAP_VIEWBOX, captureOrder, routeFrame } from '../destinations/GeographicMap';
import { hasRouteCanvas } from '../destinations/RouteCanvas';
import { PEEK, mapInsets } from '../destinations/RouteInbox';
import RouteMap from '../destinations/RouteMap';
import type { MapWords } from '../destinations/GeographicMap';
import type { MenuPlace } from '../home/Menu';
import type { Lens } from '../destinations/lens';
import { buildWalk, type Walk } from '../destinations/walk';
import { DESTINATIONS, assetUrl, decodeCloud, fetchLocal, loadDestination, metres, type Cloud, type Coordinate, type Destination, type DestinationId, type Finding, type Photo, type View } from '../destinations/data';
import { useLanguage } from '../i18n';
import { fromRecord, possibleFromRecord } from '../i18n/records';
import { walkMarks, type Mark } from './marks';
import RevealFx from '../fx/RevealFx';
import { photosShown, type Beats } from '../fx/build';
import { TextButton, markOf } from '../ui';
import { SkipIcon } from '../ui/icons';
import './reveal.css';

/** Milliseconds after the records are read. Every element shown is a retained record, replayed in the order the place was built. */
const BUILD_FROM = 300, PHOTOS_FOR = 1800, WALK_FOR = 800, BARRIERS_FOR = 700, TICK_GAP = 12, MARK_GAP = 10, POINT_GAP = 95;
/** Photo cards follow the build, then the hand-off; retained 3D areas, read only on this device, may hold it back a little. */
const CARD_GAP = 300, CARD_SETTLE = 1150, HANDOFF_WAIT = 1300, MAX_CARDS = 4;
/** The landing on the inspection map, then the fade that uncovers it; on a leaned route map the replay only fades, since the canvas behind shares its framing. */
const LAND_FOR = 720, FADE_FOR = 220, FADE_LEANED = 380;
/** The point layer covers the map view plus a margin, at this many pixels per map unit. */
const LAYER = { x: -100, y: -100, width: 1000, height: 700, density: 1.5 } as const;
/** Card footprints in pixels, width by height, used until the cards themselves can be measured. */
const CARD = { wide: [196, 190], phone: [148, 162] } as const;

type Card = { view: View; findings: Finding[]; position: Coordinate; photo: Photo };
type Placed = { left: number; top: number; x: number; y: number; w: number; h: number };
type StepId = 'photos' | 'areas' | 'walk' | 'stretches' | 'marks' | 'barriers';
type Step = { id: StepId; at: number; until: number };

/** The build in order: photos, retained 3D areas where this device has them, the walk, its stretches, the marks, then the possible barriers. A step with nothing to show is left out. */
function schedule(data: Destination, marks: readonly Mark[]): Step[] {
  const order: [StepId, number][] = [['photos', PHOTOS_FOR]];
  if (data.pieces.length) order.push(['areas', data.pieces.length * POINT_GAP + 300]);
  order.push(['walk', WALK_FOR]);
  if (data.stretches.length) order.push(['stretches', (data.stretches.length + 1) * TICK_GAP + 200]);
  if (marks.length) order.push(['marks', marks.length * MARK_GAP + 300]);
  if (marks.some(mark => mark.barrier)) order.push(['barriers', BARRIERS_FOR]);
  let at = BUILD_FROM;
  return order.map(([id, length]) => { const step = { id, at, until: at + length }; at += length; return step; });
}

/** Draws one retained area in grey, sampled to bound device work; coordinates are not altered. */
function paint(image: ImageData, cloud: Cloud, toMap: (east: number, north: number) => Coordinate) {
  const stride = Math.max(1, Math.ceil(cloud.points / 14000)), { data, width, height } = image;
  for (let i = 0; i < cloud.points; i += stride) {
    const [vx, vy] = toMap(cloud.positions[i * 3], cloud.positions[i * 3 + 1]);
    const px = Math.round((vx - LAYER.x) * LAYER.density), py = Math.round((vy - LAYER.y) * LAYER.density);
    if (px < 0 || py < 0 || px >= width || py >= height) continue;
    const at = (py * width + px) * 4, grey = Math.round(36 + (.3 * cloud.colours[i * 3] + .59 * cloud.colours[i * 3 + 1] + .11 * cloud.colours[i * 3 + 2]) * .46);
    for (const offset of [at, at + 4, at + width * 4, at + width * 4 + 4]) {
      if (offset >= data.length || (data[offset + 3] && data[offset] <= grey)) continue;
      data[offset] = data[offset + 1] = data[offset + 2] = grey; data[offset + 3] = 215;
    }
  }
}

/** Frames the route and its cameras in the space left between the banner and the line that names each step. */
function fitView(data: Destination, width: number, height: number, top: number): number[] {
  const { project } = routeFrame(data);
  const points = [...data.line, data.target.position, ...data.photos.filter(photo => data.views.some(view => view.photoId === photo.id)).map(photo => photo.position)].map(project);
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]), pad = 24;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  const bottom = height - 116, scale = Math.min((width - 32) / (maxX - minX), (bottom - top) / (maxY - minY));
  return [(minX + maxX) / 2 - width / 2 / scale, (minY + maxY) / 2 - (top + (bottom - top) / 2) / scale, width / scale, height / scale];
}

const year = (iso: string | null) => iso?.slice(0, 4) ?? '';

/** Up to four photos with model outlines, barriers first, spread along the route from start to end. */
function chooseCards(data: Destination): Card[] {
  const origin: Coordinate = [data.origin[0], data.origin[1]];
  const line = data.line.map(point => metres(point, origin));
  const along = (position: Coordinate) => { const p = metres(position, origin); let best = 0, distance = Infinity; line.forEach((q, i) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < distance) { distance = d; best = i; } }); return best / Math.max(1, line.length - 1); };
  const candidates = data.views.flatMap(view => {
    const findings = data.findings.filter(finding => finding.viewId === view.id && finding.outline.length > 2);
    const photo = data.photos.find(item => item.id === view.photoId);
    return findings.length && photo ? [{ view, findings, photo, position: photo.position, at: along(photo.position), barrier: findings.some(f => f.barrier) }] : [];
  });
  const picked: typeof candidates = [];
  for (let slot = 0; slot < MAX_CARDS; slot++) {
    const inSlot = candidates.filter(c => !picked.includes(c) && c.at >= slot / MAX_CARDS && c.at <= (slot + 1) / MAX_CARDS);
    const choice = inSlot.find(c => c.barrier) ?? inSlot[0];
    if (choice) picked.push(choice);
  }
  for (const c of candidates) if (picked.length < MAX_CARDS && !picked.includes(c) && c.barrier) picked.push(c);
  return picked.sort((a, b) => a.at - b.at).map(({ view, findings, position, photo }) => ({ view, findings, position, photo }));
}

/** Replays how a recorded place was built, step by step, then opens its inspection on the same map. */
export default function RecordedReveal({ id, onHome, onOpen, onPlace }: { id: DestinationId; onHome: () => void; onOpen: (id: DestinationId) => void; onPlace?: (place: MenuPlace) => void }) {
  const { t, rich, lang, locale } = useLanguage();
  const [data, setData] = useState<Destination | null>(null);
  const [failed, setFailed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  /** When the replay began, on the performance.now() clock the build layer animates by. */
  const [began, setBegan] = useState(0);
  const [phase, setPhase] = useState<'play' | 'handoff' | 'done'>('play');
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [layer, setLayer] = useState<{ url: string; areas: number } | null>(null);
  const [pointsDone, setPointsDone] = useState(false);
  const [view, setView] = useState<number[] | null>(null);
  const [lens, setLens] = useState<Lens | null>(null);
  const narrow = useNarrow();
  const quiet = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const root = useRef<HTMLDivElement>(null), mapBox = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), cardBoxes = useRef<(HTMLElement | null)[]>([]);

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    loadDestination(id, controller.signal).then(setData).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [id, attempt]);

  const ordered = useMemo(() => data ? captureOrder(data.photos) : [], [data]);
  // Every mark comes with the records, so the replay starts with its whole schedule known.
  const marks = useMemo<Mark[]>(() => data ? walkMarks(data) : [], [data]);
  // A place with a route canvas replays on that canvas's own leaned map, so the hand-off is only a fade.
  const leaned = !!data && hasRouteCanvas(data);
  const walk = useMemo(() => data && leaned ? buildWalk(data) : null, [data, leaned]);
  // The route screen opens behind the replay with its phone sheet at this peek, so both frame the walk alike.
  const insets = useMemo(() => mapInsets(narrow, PEEK), [narrow]);
  const mapWords = useMemo<MapWords>(() => ({ zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut'), fit: t('map.fit'), credit: t('map.credit') }), [t]);
  const cards = useMemo(() => data ? chooseCards(data) : [], [data]);

  useEffect(() => {
    for (const card of cards) {
      const image = new Image();
      image.onload = () => setLoaded(previous => new Set(previous).add(card.view.id));
      image.src = assetUrl(data!, card.view.file);
    }
  }, [cards, id]);

  useEffect(() => {
    if (!data || phase !== 'play') return;
    const begin = performance.now();
    setBegan(begin);
    const timer = window.setInterval(() => setElapsed(performance.now() - begin), 80);
    return () => clearInterval(timer);
  }, [data, phase]);

  const steps = useMemo(() => data ? schedule(data, marks) : [], [data, marks]);
  const stepOf = (id: StepId) => steps.find(item => item.id === id);
  /** The build layer's beats, on its clock. */
  const beats = useMemo<Beats>(() => {
    const window = (id: StepId) => { const step = steps.find(item => item.id === id); return step && [began + step.at, step.until - step.at] as const; };
    return { photos: window('photos'), walk: window('walk'), stretches: window('stretches'), marks: window('marks'), flags: window('barriers') };
  }, [steps, began]);
  const startPoints = !!data && (quiet || phase !== 'play' || elapsed >= (stepOf('areas')?.at ?? 0));
  useEffect(() => {
    if (!data || !startPoints) return;
    if (!data.pieces.length) return setPointsDone(true);
    const controller = new AbortController(), urls: string[] = [];
    const canvas = document.createElement('canvas');
    canvas.width = LAYER.width * LAYER.density; canvas.height = LAYER.height * LAYER.density;
    const context = canvas.getContext('2d');
    if (!context) return setPointsDone(true);
    const image = context.createImageData(canvas.width, canvas.height), { fromMetres, origin } = routeFrame(data);
    const line = data.line.map(point => metres(point, origin));
    const along = (center: Coordinate) => { const p = metres(center, origin); return line.reduce((best, q, i) => Math.hypot(p[0] - q[0], p[1] - q[1]) < Math.hypot(p[0] - line[best][0], p[1] - line[best][1]) ? i : best, 0); };
    const pieces = [...data.pieces].sort((a, b) => along(a.center) - along(b.center));
    (async () => {
      for (const [index, piece] of pieces.entries()) {
        const began = performance.now();
        paint(image, decodeCloud(await fetchLocal(id, piece.file, 12000000, controller.signal), piece), fromMetres);
        context.putImageData(image, 0, 0);
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve));
        if (controller.signal.aborted || !blob) return;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        setLayer({ url, areas: index + 1 });
        const wait = POINT_GAP - (performance.now() - began);
        if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      }
      setPointsDone(true);
    })().catch(() => { if (!controller.signal.aborted) setPointsDone(true); });
    return () => { controller.abort(); setTimeout(() => urls.forEach(url => URL.revokeObjectURL(url)), 2000); };
  }, [data, startPoints, id]);

  const total = ordered.length, photos = stepOf('photos');
  const shown = phase !== 'play' || quiet || !photos ? total : leaned && beats.photos ? photosShown(total, beats.photos, began + elapsed) : Math.max(0, Math.min(total, Math.round((elapsed - photos.at) / (photos.until - photos.at) * total)));
  const step = steps.filter(item => quiet || phase !== 'play' || elapsed >= item.at).at(-1);
  const cardsFrom = steps.at(-1)?.until ?? BUILD_FROM;
  const handoffAt = cardsFrom + (cards.length ? (cards.length - 1) * CARD_GAP + CARD_SETTLE : 400);
  // Only cards whose turn came during the replay; a skip fades those out and never flashes the rest.
  const surfaced = cards.filter((card, i) => loaded.has(card.view.id) && (quiet || elapsed >= cardsFrom + i * CARD_GAP));

  useEffect(() => { if (phase === 'play' && data && elapsed >= handoffAt && (pointsDone || elapsed >= handoffAt + HANDOFF_WAIT)) setPhase('handoff'); }, [phase, data, elapsed, pointsDone, handoffAt]);
  useEffect(() => {
    if (phase !== 'play' || !data) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' || event.key === ' ') { event.preventDefault(); setPhase('handoff'); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [phase, data]);

  useLayoutEffect(() => {
    if (!data || leaned) return;
    const fit = () => setView(fitView(data, innerWidth, innerHeight, (root.current?.querySelector('.reveal-banner')?.getBoundingClientRect().bottom ?? 110) + 12));
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, [data, leaned]);

  /** Card corners in screen space, kept clear of the banner, the hint line and each other. Every card is measured before it shows, since a caption can wrap. */
  useLayoutEffect(() => {
    const element = svg.current;
    if (!data || (leaned ? !lens || !walk : !element)) return;
    let live = true;
    const place = () => {
      const matrix = leaned ? null : element?.getScreenCTM();
      if ((!leaned && !matrix) || !live) return;
      const { project } = routeFrame(data);
      const screen = (position: Coordinate) => { if (lens && walk && leaned) return lens.at(walk.project(position)); const [vx, vy] = project(position); return [matrix!.a * vx + matrix!.c * vy + matrix!.e, matrix!.b * vx + matrix!.d * vy + matrix!.f]; };
      const phone = innerWidth < 640, [fw, fh] = phone ? CARD.phone : CARD.wide, gap = phone ? 18 : 30;
      const top = (document.querySelector('.reveal-banner')?.getBoundingClientRect().bottom ?? 120) + 16, bottom = (document.querySelector('.reveal-say')?.getBoundingClientRect().top ?? innerHeight - 110) - 10, taken: { left: number; top: number; w: number; h: number }[] = [];
      let crowded = false;
      const spots = cards.map((card, i) => {
        const box = cardBoxes.current[i], w = box?.offsetWidth || fw, h = box?.offsetHeight || fh;
        const [x, y] = screen(card.position);
        const clamp = ([l, t]: number[]) => [Math.min(Math.max(12, l), innerWidth - w - 12), Math.min(Math.max(top, t), bottom - h)];
        const clear = ([l, t]: number[]) => taken.every(o => l + w + 8 < o.left || l > o.left + o.w + 8 || t + h + 8 < o.top || t > o.top + o.h + 8);
        // Nearest free spot to the camera: the four corners first, then the same corners pushed outward.
        const options = [1, 2, 3, 4].flatMap(k => [[x + gap, y - gap - h], [x - gap - w, y - gap - h], [x + gap, y + gap], [x - gap - w, y + gap]].map(([l, t]) => clamp([l + Math.sign(l - x + 1) * (k - 1) * (w * .6), t + Math.sign(t - y + 1) * (k - 1) * (h * .55)])));
        // On a short screen nothing near the camera may be free: then the nearest free place between the banner and the hint line.
        const free: number[][] = [];
        if (!options.some(clear)) for (let t = top; t <= bottom - h; t += 12) for (let l = 12; l <= innerWidth - w - 12; l += 12) if (clear([l, t])) free.push([l, t]);
        const near = ([l, t]: number[]) => Math.hypot(l + w / 2 - x, t + h / 2 - y);
        const spot = options.find(clear) ?? free.sort((a, b) => near(a) - near(b))[0];
        if (!spot) crowded = true;
        const [left, cardTop] = spot ?? options[0];
        taken.push({ left, top: cardTop, w, h });
        return { left, top: cardTop, x, y, w, h };
      });
      if (crowded) {
        // Still no room for every card: a tidy grid in the free band, in route order.
        const w = Math.max(...spots.map(s => s.w)), h = Math.max(...spots.map(s => s.h));
        const columns = Math.max(1, Math.min(spots.length, Math.floor((innerWidth - 16) / (w + 8)))), across = columns * (w + 8) - 8, down = Math.ceil(spots.length / columns) * (h + 8) - 8;
        spots.forEach((spot, i) => Object.assign(spot, { left: (innerWidth - across) / 2 + (i % columns) * (w + 8), top: Math.max(top, (top + bottom - down) / 2) + Math.floor(i / columns) * (h + 8) }));
      }
      setPlaced(spots);
    };
    place();
    // Captions measured before the web font arrives can wrap differently once it does.
    void document.fonts?.ready.then(place);
    addEventListener('resize', place);
    return () => { live = false; removeEventListener('resize', place); };
  }, [data, cards, view, lang, lens, walk, leaned]);

  /** Lands the replay map on the inspection map, which draws the same records in the same frame; a route canvas frames itself once measured, so wait for that, then fade to uncover it. */
  useLayoutEffect(() => {
    if (phase !== 'handoff') return;
    let frame = 0, fade = 0, waited = 0;
    if (leaned) {
      // The canvas behind opens settled on the same leaned framing; once its map has drawn a couple of frames, the replay fades off it.
      const uncover = () => {
        const ready = !!root.current?.querySelector('.route-canvas .route-map .map-route');
        if ((!ready || waited < 2) && waited++ < 40) { frame = requestAnimationFrame(uncover); return; }
        const replay = root.current?.querySelector<HTMLElement>('.reveal');
        if (!replay || quiet) return setPhase('done');
        Object.assign(replay.style, { transition: `opacity ${FADE_LEANED}ms ease`, opacity: '0' });
        fade = window.setTimeout(() => setPhase('done'), FADE_LEANED);
      };
      frame = requestAnimationFrame(uncover);
      return () => { cancelAnimationFrame(frame); clearTimeout(fade); };
    }
    const land = () => {
      const host = root.current, box = mapBox.current, map = svg.current;
      const canvas = host?.querySelector<HTMLElement>('.route-canvas .route-map');
      const framed = canvas?.querySelector('.destination-map > svg')?.getAttribute('viewBox')?.split(' ').map(Number);
      const goal = framed?.length === 4 && framed.every(Number.isFinite) && framed[2] > 1 ? framed : null;
      if (canvas && !goal && waited++ < 30) { frame = requestAnimationFrame(land); return; }
      const target = (canvas ?? host?.querySelector('.destination-workspace .destination-scene'))?.getBoundingClientRect();
      if (!target || !box || !map || quiet) return setPhase('done');
      const from = { top: 0, left: 0, width: innerWidth, height: innerHeight, radius: 0, view: (map.getAttribute('viewBox') ?? '').split(' ').map(Number) };
      const to = { top: target.top, left: target.left, width: target.width, height: target.height, radius: canvas ? 0 : 15, view: canvas ? goal ?? from.view : [...MAP_VIEWBOX] };
      const began = performance.now(), mix = (a: number, b: number, k: number) => a + (b - a) * k;
      const step = (now: number) => {
        const t = Math.min(1, (now - began) / LAND_FOR), k = 1 - Math.pow(1 - t, 3);
        Object.assign(box.style, { top: `${mix(from.top, to.top, k)}px`, left: `${mix(from.left, to.left, k)}px`, width: `${mix(from.width, to.width, k)}px`, height: `${mix(from.height, to.height, k)}px`, borderRadius: `${mix(from.radius, to.radius, k)}px` });
        if (from.view.length === 4) map.setAttribute('viewBox', from.view.map((value, i) => mix(value, to.view[i], k)).join(' '));
        if (t < 1) frame = requestAnimationFrame(step);
        else if (canvas) { Object.assign(box.style, { transition: `opacity ${FADE_FOR}ms ease`, opacity: '0' }); fade = window.setTimeout(() => setPhase('done'), FADE_FOR); }
        else setPhase('done');
      };
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(land);
    return () => { cancelAnimationFrame(frame); clearTimeout(fade); };
  }, [phase, quiet, leaned]);

  if (failed) return <RecordedPreview id={id} onHome={onHome} onOpen={onOpen} onRetry={() => setAttempt(n => n + 1)}/>;
  const name = DESTINATIONS[id].name;
  const targetName = data && (data.target.name.toLocaleLowerCase().startsWith(`${name.toLocaleLowerCase()} `) ? `the ${data.target.name.slice(name.length + 1)}` : data.target.name);
  const route = !data ? '' : id === 'cusco-qorikancha' ? t('reveal.route.qorikancha') : data.start ? t('reveal.route', { start: data.start.name, target: lang === 'en' ? targetName ?? '' : data.target.name }) : data.title;
  const spots = walk ? walk.spots.filter(spot => spot.kind === 'flagged').length : 0;
  const barriers = marks.filter(mark => mark.barrier).length, walkStep = stepOf('walk');
  const say = !data || !step ? null : {
    photos: rich(Math.max(1, shown) === 1 ? 'reveal.build.photo' : 'reveal.build.photos', { count: <strong>{Math.max(1, shown).toLocaleString(locale)}</strong> }),
    areas: rich('reveal.areas', { shown: <strong>{layer?.areas ?? 0}</strong>, total: data.pieces.length }),
    walk: rich('reveal.build.walk', { length: <strong>{t('common.metres', { m: Math.round(data.lengthMetres).toLocaleString(locale) })}</strong>, route }),
    stretches: rich('reveal.build.stretches', { count: <strong>{data.stretches.length}</strong>, length: t('common.metres', { m: Math.round((data.stretches[0]?.to ?? 0) - (data.stretches[0]?.from ?? 0)) }) }),
    marks: rich(marks.length === 1 ? 'reveal.build.mark' : 'reveal.build.marks', { count: <strong>{marks.length}</strong> }),
    barriers: barriers === 1 ? rich('reveal.build.barrier', { count: <strong>1</strong> }) : spots > 1 ? rich('reveal.build.barriersAt', { count: <strong>{barriers}</strong>, spots: <strong>{spots}</strong> }) : rich('reveal.build.barriers', { count: <strong>{barriers}</strong> }),
  }[step.id];
  return <div className="reveal-host" ref={root}>
    {data && phase !== 'play' && <DestinationWorkspace id={id} onHome={onHome} initial={data} onPlace={onPlace}/>}
    {phase !== 'done' && <div className={`reveal${quiet ? ' is-quiet' : ''}${leaned ? ' is-leaned' : ''}`} data-phase={phase} data-step={step?.id ?? 'none'} role="region" aria-label={name} style={{ ...(walkStep && { '--walk-at': `${walkStep.at}ms`, '--walk-for': `${walkStep.until - walkStep.at}ms` }), '--free-left': `${insets.left}px`, '--free-right': `${insets.right}px` } as CSSProperties}>
      {data && <>
        {leaned && walk ? <div className="reveal-map is-leaned" ref={mapBox}>
          <LeanedMap data={data} walk={walk} insets={insets} words={mapWords} name={name} onLens={setLens}/>
          {lens && (began > 0 || quiet) && <RevealFx data={data} walk={walk} marks={marks} beats={beats} done={quiet || phase !== 'play'} lens={lens}/>}
          {lens && <svg className="reveal-overlay" aria-hidden="true">
            {phase === 'play' && surfaced.map(card => { const [x, y] = lens.at(walk.project(card.position)); return <circle key={card.view.id} cx={x} cy={y} r="7" className="reveal-ring"/>; })}
          </svg>}
        </div> : <div className="reveal-map" ref={mapBox}>
          <GeographicMap data={data} selected={phase === 'play' ? '' : data.views[0]?.id ?? ''} onSelect={() => {}} hidden={false} zoom={1} setZoom={() => {}} shown={shown} svgRef={svg} className="is-revealing" viewBox={view?.join(' ')} words={{ zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut'), fit: t('map.fit'), credit: t('map.credit') }}
            underlay={layer && <image href={layer.url} x={LAYER.x} y={LAYER.y} width={LAYER.width} height={LAYER.height} preserveAspectRatio="none" className="reveal-points"/>}>
            <BuildLayer data={data} marks={marks} steps={steps} unit={view ? view[2] / innerWidth : 1}/>
            {phase === 'play' && surfaced.map(card => { const [x, y] = routeFrame(data).project(card.position); return <circle key={card.view.id} cx={x} cy={y} r="7" className="reveal-ring"/>; })}
          </GeographicMap>
        </div>}
        <div className="reveal-scan" aria-hidden="true"/>
        <header className="reveal-banner">
          <h1>{name}</h1>
          <p>{fromRecord(DESTINATIONS[id].place, lang)}</p>
        </header>
        <svg className="reveal-leaders" aria-hidden="true">{surfaced.map(card => { const spot = placed[cards.indexOf(card)]; return spot && <line key={card.view.id} x1={spot.x} y1={spot.y} x2={spot.left + (spot.left > spot.x ? 0 : spot.w)} y2={spot.top + (spot.top > spot.y ? 0 : spot.h)}/>; })}</svg>
        {cards.map((card, i) => { const spot = placed[i]; return <figure key={card.view.id} ref={box => { cardBoxes.current[i] = box; }} data-tone="dark" className={`reveal-card${spot && surfaced.includes(card) ? '' : ' is-waiting'}`} style={spot && { left: spot.left, top: spot.top }}>
          <div className="reveal-photo" style={{ aspectRatio: `${card.view.width} / ${card.view.height}` }}>
            <img src={assetUrl(data, card.view.file)} alt=""/>
            <svg viewBox={`0 0 ${card.view.width} ${card.view.height}`} preserveAspectRatio="xMidYMid slice">{[...card.findings].sort((a, b) => Number(a.barrier) - Number(b.barrier)).map(f => { const points = f.outline.map(p => p.join(',')).join(' '), barrier = f.barrier || undefined; return <g key={f.id}><polygon className="ui-mark-halo" data-barrier={barrier} points={points} pathLength={1}/><polygon className="ui-mark" data-mark={markOf(f.concept) ?? undefined} data-barrier={barrier} points={points} pathLength={1}/></g>; })}</svg>
          </div>
          <figcaption><strong>{possibleFromRecord(card.findings.find(f => f.barrier)?.label ?? card.findings[0].label, lang)}</strong><span>{card.photo.creator}{card.photo.capturedAt ? `, ${year(card.photo.capturedAt)}` : ''}</span></figcaption>
        </figure>; })}
        {phase === 'play' && step && <p className="reveal-say" key={step.id}>{GLYPHS[step.id]}<span>{say}</span></p>}
        <footer className="reveal-hints"><span className="reveal-credit-long">{t('reveal.credit')}</span><span className="reveal-credit-short">{t('reveal.creditShort')}</span><TextButton icon={<SkipIcon/>} onClick={() => setPhase('handoff')} disabled={phase !== 'play'}>{t('common.skip')}</TextButton></footer>
      </>}
      {!data && <p className="reveal-opening" role="status">{t('reveal.opening', { name })}</p>}
    </div>}
  </div>;
}

/** One small sign per step, drawn like the thing it names on the map. */
const GLYPHS: Record<StepId, ReactNode> = {
  photos: <svg viewBox="0 0 22 22" aria-hidden="true"><circle cx="5" cy="13" r="2.1" className="glyph-photo"/><circle cx="11" cy="8" r="2.1" className="glyph-photo"/><circle cx="17" cy="12" r="2.1" className="glyph-photo"/></svg>,
  areas: <svg viewBox="0 0 22 22" aria-hidden="true"><path d="M5 15h.01M8 12h.01M11 15h.01M11 9h.01M14 12h.01M17 15h.01M14 6h.01M8 6h.01" className="glyph-areas"/></svg>,
  walk: <svg viewBox="0 0 22 22" aria-hidden="true"><path d="M3 16C8 5 13 17 19 6" className="glyph-walk"/></svg>,
  stretches: <svg viewBox="0 0 22 22" aria-hidden="true"><path d="M2 11H20M4 7V15M9 7V15M14 7V15M19 7V15" className="glyph-ticks"/></svg>,
  marks: <svg viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="4" className="glyph-mark"/></svg>,
  barriers: <svg viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="5" className="glyph-barrier"/></svg>,
};

/** The walk's 10 m stretches as ticks, then every recorded mark, in order along the walk, in map units on the flat map. */
const BuildLayer = memo(function BuildLayer({ data, marks, steps, unit }: { data: Destination; marks: readonly Mark[]; steps: readonly Step[]; unit: number }) {
  const { project } = routeFrame(data);
  const ticks = data.stretches.flatMap((stretch, i) => {
    const ends = i === data.stretches.length - 1 ? [0, stretch.line.length - 1] : [0];
    return ends.map(end => {
      const a = project(stretch.line[end]), b = project(stretch.line[end === 0 ? 1 : end - 1] ?? stretch.line[end]);
      const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1, n = [-dy / length * 7 * unit, dx / length * 7 * unit];
      return [a[0] - n[0], a[1] - n[1], a[0] + n[0], a[1] + n[1]];
    });
  });
  const line = data.line.map(project);
  const along = (p: number[]) => line.reduce((best, q, i) => Math.hypot(p[0] - q[0], p[1] - q[1]) < Math.hypot(p[0] - line[best][0], p[1] - line[best][1]) ? i : best, 0);
  const placed = marks.map(mark => ({ ...mark, xy: project(mark.at) })).sort((a, b) => along(a.xy) - along(b.xy));
  const ticksAt = steps.find(step => step.id === 'stretches')?.at ?? 0, marksAt = steps.find(step => step.id === 'marks')?.at ?? 0;
  const mark = (item: typeof placed[number], i: number) => <circle key={i} cx={item.xy[0]} cy={item.xy[1]} r={(item.barrier ? 4.6 : 3.4) * unit} className={`reveal-mark${item.barrier ? ' is-barrier' : ''}`} style={{ '--at': `${marksAt + i * MARK_GAP}ms` } as CSSProperties}/>;
  return <g className="reveal-build" aria-hidden="true">
    <g className="reveal-ticks">{ticks.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="reveal-tick" style={{ animationDelay: `${ticksAt + i * TICK_GAP}ms` }}/>)}</g>
    <g className="reveal-marks">{placed.map((item, i) => item.barrier ? null : mark(item, i))}</g>
    <g className="reveal-barriers">{placed.map((item, i) => item.barrier ? mark(item, i) : null)}</g>
  </g>;
});

/** The canvas's own map, still and settled, so the replay shares its framing; it holds still while the replay's clock ticks. */
const NONE: never[] = [];
const ignore = () => {};
const LeanedMap = memo(function LeanedMap({ data, walk, insets, words, name, onLens }: { data: Destination; walk: Walk; insets: ReturnType<typeof mapInsets>; words: MapWords; name: string; onLens: (lens: Lens) => void }) {
  return <RouteMap still settled riseIn data={data} walk={walk} photoView="" markers={NONE} labels={NONE} insets={insets} highlight={null} onMarker={ignore} onMap={ignore} clearBottom={0} words={words} ariaLabel={name} onLens={onLens}/>;
});

/** The phone layout of the route screen starts at this width, and its map insets with it. */
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

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import DestinationWorkspace from '../destinations/DestinationWorkspace';
import RecordedPreview from './RecordedPreview';
import GeographicMap, { MAP_VIEWBOX, captureOrder, routeFrame } from '../destinations/GeographicMap';
import { hasRouteCanvas } from '../destinations/RouteCanvas';
import { DESTINATIONS, assetUrl, decodeCloud, fetchLocal, loadDestination, metres, type Cloud, type Coordinate, type Destination, type DestinationId, type Finding, type Photo, type View } from '../destinations/data';
import { useLanguage } from '../i18n';
import { fromRecord } from '../i18n/records';
import './reveal.css';

/** Milliseconds after the records are read. Every element shown is a retained record. */
const CAMERAS_FROM = 1900, CAMERAS_FOR = 2800, POINTS_FROM = 4800, POINT_GAP = 95, CARDS_FROM = 7000, CARD_GAP = 550, HANDOFF_AT = 9900, HANDOFF_LATEST = 11200, MAX_CARDS = 4;
/** Without point areas the cards follow the photos directly, and the hand-off follows the last card. */
const PHOTO_CARDS_FROM = CAMERAS_FROM + CAMERAS_FOR + 400, HANDOFF_AFTER_CARDS = 1250;
/** The landing on the inspection map, then the fade that uncovers it. */
const LAND_FOR = 720, FADE_FOR = 220;
/** The point layer covers the map view plus a margin, at this many pixels per map unit. */
const LAYER = { x: -100, y: -100, width: 1000, height: 700, density: 1.5 } as const;
/** Card footprints in pixels, width by height, matching reveal.css. */
const CARD = { wide: [232, 224], phone: [164, 170] } as const;

type Card = { view: View; findings: Finding[]; position: Coordinate; photo: Photo };
type Placed = { left: number; top: number; x: number; y: number };

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

/** Frames the route and its cameras in the space left between the banner and the hint line. */
function fitView(data: Destination, width: number, height: number, top: number): number[] {
  const { project } = routeFrame(data);
  const points = [...data.line, data.target.position, ...data.photos.filter(photo => data.views.some(view => view.photoId === photo.id)).map(photo => photo.position)].map(project);
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]), pad = 24;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  const bottom = height - 56, scale = Math.min((width - 32) / (maxX - minX), (bottom - top) / (maxY - minY));
  return [(minX + maxX) / 2 - width / 2 / scale, (minY + maxY) / 2 - (top + (bottom - top) / 2) / scale, width / scale, height / scale];
}

const month = (iso: string | null, locale: string) => iso ? new Date(iso).toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
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

/** Plays the retained preparation of a recorded place, then opens its inspection on the same map. */
export default function RecordedReveal({ id, onHome, onOpen }: { id: DestinationId; onHome: () => void; onOpen: (id: DestinationId) => void }) {
  const { t, rich, lang, locale } = useLanguage();
  const [data, setData] = useState<Destination | null>(null);
  const [failed, setFailed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<'play' | 'handoff' | 'done'>('play');
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [layer, setLayer] = useState<{ url: string; areas: number } | null>(null);
  const [pointsDone, setPointsDone] = useState(false);
  const [view, setView] = useState<number[] | null>(null);
  const quiet = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const root = useRef<HTMLDivElement>(null), mapBox = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null);

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    loadDestination(id, controller.signal).then(setData).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [id, attempt]);

  const ordered = useMemo(() => data ? captureOrder(data.photos) : [], [data]);
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
    const timer = window.setInterval(() => setElapsed(performance.now() - begin), 80);
    return () => clearInterval(timer);
  }, [data, phase]);

  const startPoints = !!data && (quiet || phase !== 'play' || elapsed >= POINTS_FROM);
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

  const total = ordered.length;
  const shown = phase !== 'play' || quiet ? total : Math.max(0, Math.min(total, Math.round((elapsed - CAMERAS_FROM) / CAMERAS_FOR * total)));
  const areas = !!data?.pieces.length;
  const cardsFrom = areas ? CARDS_FROM : PHOTO_CARDS_FROM;
  const handoffAt = areas ? HANDOFF_AT : cardsFrom + Math.max(0, cards.length - 1) * CARD_GAP + HANDOFF_AFTER_CARDS;
  const surfaced = cards.filter((card, i) => loaded.has(card.view.id) && (quiet || phase !== 'play' || elapsed >= cardsFrom + i * CARD_GAP));

  useEffect(() => { if (phase === 'play' && data && elapsed >= handoffAt && (pointsDone || elapsed >= HANDOFF_LATEST)) setPhase('handoff'); }, [phase, data, elapsed, pointsDone, handoffAt]);
  useEffect(() => {
    if (phase !== 'play' || !data) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' || event.key === ' ') { event.preventDefault(); setPhase('handoff'); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [phase, data]);

  useLayoutEffect(() => {
    if (!data) return;
    const fit = () => setView(fitView(data, innerWidth, innerHeight, (root.current?.querySelector('.reveal-banner')?.getBoundingClientRect().bottom ?? 110) + 12));
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, [data]);

  /** Card corners in screen space, kept clear of the banner, the hint line and each other. */
  useLayoutEffect(() => {
    const element = svg.current;
    if (!element || !data) return;
    const place = () => {
      const matrix = element.getScreenCTM();
      if (!matrix) return;
      const { project } = routeFrame(data);
      const phone = innerWidth < 640, w = phone ? CARD.phone[0] : CARD.wide[0], h = phone ? CARD.phone[1] : CARD.wide[1], gap = phone ? 18 : 30;
      const top = (element.ownerDocument.querySelector('.reveal-banner')?.getBoundingClientRect().bottom ?? 120) + 16, bottom = innerHeight - 60, taken: { left: number; top: number }[] = [];
      setPlaced(cards.map(card => {
        const [vx, vy] = project(card.position), x = matrix.a * vx + matrix.c * vy + matrix.e, y = matrix.b * vx + matrix.d * vy + matrix.f;
        const clamp = ([l, t]: number[]) => [Math.min(Math.max(12, l), innerWidth - w - 12), Math.min(Math.max(top, t), bottom - h)];
        const clear = ([l, t]: number[]) => taken.every(o => l + w + 8 < o.left || l > o.left + w + 8 || t + h + 8 < o.top || t > o.top + h + 8);
        // Nearest free spot to the camera: the four corners first, then the same corners pushed outward.
        const options = [1, 2, 3, 4].flatMap(k => [[x + gap, y - gap - h], [x - gap - w, y - gap - h], [x + gap, y + gap], [x - gap - w, y + gap]].map(([l, t]) => clamp([l + Math.sign(l - x + 1) * (k - 1) * (w * .6), t + Math.sign(t - y + 1) * (k - 1) * (h * .55)])));
        const [left, cardTop] = options.find(clear) ?? options[0];
        taken.push({ left, top: cardTop });
        return { left, top: cardTop, x, y };
      }));
    };
    place();
    addEventListener('resize', place);
    return () => removeEventListener('resize', place);
  }, [data, cards, view]);

  /** Lands the replay map on the inspection map, which draws the same records in the same frame; a route canvas frames itself once measured, so wait for that, then fade to uncover it. */
  useLayoutEffect(() => {
    if (phase !== 'handoff') return;
    let frame = 0, fade = 0, waited = 0;
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
  }, [phase, quiet]);

  if (failed) return <RecordedPreview id={id} onHome={onHome} onOpen={onOpen} onRetry={() => setAttempt(n => n + 1)}/>;
  const name = DESTINATIONS[id].name;
  const targetName = data && (data.target.name.toLocaleLowerCase().startsWith(`${name.toLocaleLowerCase()} `) ? `the ${data.target.name.slice(name.length + 1)}` : data.target.name);
  const last = ordered[Math.max(0, shown - 1)];
  const first = year(ordered[0]?.capturedAt ?? null), final = year(ordered.at(-1)?.capturedAt ?? null);
  const span = first && final ? first === final ? first : t('reveal.span', { from: first, to: final }) : '';
  const route = !data ? '' : id === 'cusco-qorikancha' ? t('reveal.route.qorikancha') : data.start ? t('reveal.route', { start: data.start.name, target: lang === 'en' ? targetName ?? '' : data.target.name }) : data.title;
  const toCanvas = !!data && hasRouteCanvas(data);
  return <div className="reveal-host" ref={root}>
    {data && phase !== 'play' && <DestinationWorkspace id={id} onHome={onHome} initial={data}/>}
    {phase !== 'done' && <div className={`reveal${quiet ? ' is-quiet' : ''}${toCanvas ? ' to-canvas' : ''}`} data-phase={phase} role="region" aria-label={name}>
      {data && <>
        <div className="reveal-map" ref={mapBox}>
          <GeographicMap data={data} selected={phase === 'play' || toCanvas ? '' : data.views[0]?.id ?? ''} onSelect={() => {}} hidden={false} zoom={1} setZoom={() => {}} shown={shown} svgRef={svg} className="is-revealing" viewBox={view?.join(' ')} words={{ zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut'), fit: t('map.fit'), credit: t('map.credit') }}
            underlay={layer && <image href={layer.url} x={LAYER.x} y={LAYER.y} width={LAYER.width} height={LAYER.height} preserveAspectRatio="none" className="reveal-points"/>}>
            {phase === 'play' && surfaced.map(card => { const [x, y] = routeFrame(data).project(card.position); return <circle key={card.view.id} cx={x} cy={y} r="7" className="reveal-ring"/>; })}
          </GeographicMap>
        </div>
        <div className="reveal-scan" aria-hidden="true"/>
        <header className="reveal-banner">
          <h1>{name}</h1>
          <p>{route} · {t('common.metres', { m: Math.round(data.lengthMetres).toLocaleString(locale) })}</p>
          <div className="reveal-counter">{shown < total ? <><span>{rich('reveal.photosOf', { shown: <strong>{shown}</strong>, total })}</span><span className="reveal-when">{month(last?.capturedAt ?? null, locale)}</span></> : <><span>{rich(total === 1 ? 'reveal.photo' : 'reveal.photos', { count: <strong>{total}</strong> })}{span ? `, ${span}` : ''}</span><span className="reveal-when">{layer && rich('reveal.areas', { shown: <strong>{layer.areas}</strong>, total: data.pieces.length })}</span></>}</div>
        </header>
        <svg className="reveal-leaders" aria-hidden="true">{surfaced.map(card => { const spot = placed[cards.indexOf(card)]; return spot && <line key={card.view.id} x1={spot.x} y1={spot.y} x2={spot.left + (spot.left > spot.x ? 0 : (innerWidth < 640 ? CARD.phone : CARD.wide)[0])} y2={spot.top + (spot.top > spot.y ? 0 : (innerWidth < 640 ? CARD.phone : CARD.wide)[1])}/>; })}</svg>
        {surfaced.map(card => { const spot = placed[cards.indexOf(card)]; return spot && <figure key={card.view.id} className="reveal-card" style={{ left: spot.left, top: spot.top }}>
          <div className="reveal-photo" style={{ aspectRatio: `${card.view.width} / ${card.view.height}` }}>
            <img src={assetUrl(data, card.view.file)} alt=""/>
            <svg viewBox={`0 0 ${card.view.width} ${card.view.height}`} preserveAspectRatio="xMidYMid slice">{card.findings.map(f => <polygon key={f.id} points={f.outline.map(p => p.join(',')).join(' ')} pathLength={1}/>)}</svg>
          </div>
          <figcaption><strong>{fromRecord(card.findings.find(f => f.barrier)?.label ?? card.findings[0].label, lang)}</strong><span>{card.photo.creator}{card.photo.capturedAt ? `, ${year(card.photo.capturedAt)}` : ''}</span></figcaption>
        </figure>; })}
        <footer className="reveal-hints"><span className="reveal-credit-long">{t('reveal.credit')}</span><span className="reveal-credit-short">{t('reveal.creditShort')}</span><button onClick={() => setPhase('handoff')} disabled={phase !== 'play'}>{t('common.skip')}</button></footer>
      </>}
      {!data && <p className="reveal-opening" role="status">{t('reveal.opening', { name })}</p>}
    </div>}
  </div>;
}

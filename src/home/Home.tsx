import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import qorikancha from '../covers/qorikancha.webp';
import narikala from '../covers/narikala.webp';
import swayambhu from '../covers/swayambhu.webp';
import { DESTINATIONS, PACKAGES, isDestinationId, loadDestination, type Destination } from '../destinations/data';
import RouteMap, { type Insets, type Marker } from '../destinations/RouteMap';
import RouteCanvas from '../destinations/RouteCanvas';
import { spotMarkers } from '../destinations/markers';
import { buildWalk, type Walk } from '../destinations/walk';
import { loadReview, verdictOf } from '../decisions/store';
import { isFixed, loadEdits } from '../edits/store';
import { useLanguage } from '../i18n';
import { fromRecord } from '../i18n/records';
import Menu from './Menu';
import Places from './Places';
import Search, { type Again, type GuideLine } from './Search';
import { Companion, Dialogue } from '../ui';
import { SCRIPT } from '../guide/script';
import { toDestination, type Built } from '../search/build';
import type { Prepared } from '../search/prepared';
import { listWalks, loadWalk, type SavedWalk } from '../search/store';
import './Home.css';
export const covers = [
  { id: 'cusco-qorikancha', area: 'Cusco', name: 'Qorikancha', aliases: 'Plaza de Armas Coricancha Qoricancha Korikancha Temple of the Sun Templo del Sol', image: qorikancha, author: 'Draceane', year: 2023, license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', source: 'https://commons.wikimedia.org/wiki/File:Cuzco,_Coricancha,_2023_(01).jpg' },
  { id: 'tbilisi-narikala', area: 'Tbilisi', name: 'Narikala', aliases: 'Narikala fortress Narikala castle cable car Old Tbilisi Sololaki Betlemi Ateshgah Surb Gevork Kala Georgia ნარიყალა Нарикала', image: narikala, author: 'shankar s.', year: 2016, license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', source: 'https://commons.wikimedia.org/wiki/File:Looking_towards_Narikala_Fortress_from_the_cable_car_station.jpg' },
  { id: 'kathmandu-swayambhu', area: 'Kathmandu', name: 'Swayambhu', aliases: 'Swayambhunath monkey temple stupa', image: swayambhu, author: 'Jorge Láscar', year: 2014, license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', source: 'https://commons.wikimedia.org/wiki/File:Stairs_with_365_steps_to_climb_to_Swayambhunath_(17209517714).jpg' },
];
export type SavedEntry = { id: string; title: string; kind: 'place' | 'plan' };
type Props = {
  onDestination: (id: string) => void;
  saved?: SavedEntry[];
  onOpenSaved: (entry: SavedEntry) => void;
};
/** The walk drawn behind Home, and the first place it offers. */
const HERO = 'cusco-qorikancha';
const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];
/** Places that open here: a published package on any host, a local record only where it answers on this device. */
export function useOpenable(): (id: string) => boolean {
  const [local, setLocal] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!LOOPBACK.includes(location.hostname)) return;
    const controller = new AbortController();
    for (const cover of covers) {
      if (!isDestinationId(cover.id) || PACKAGES[cover.id]) continue;
      fetch(`/routes/${cover.id}/route.json`, { signal: controller.signal, cache: 'no-store' }).then(response => {
        if (response.ok && /json/i.test(response.headers.get('content-type') ?? '')) setLocal(previous => new Set(previous).add(cover.id));
        void response.body?.cancel();
      }).catch(() => undefined);
    }
    return () => controller.abort();
  }, []);
  return id => (isDestinationId(id) && !!PACKAGES[id]) || local.has(id);
}
/** The hero walk, its spots, and how many of them still wait for a person. */
function useHero(): { data: Destination | null; walk: Walk | null; markers: Marker[]; flagged: number } {
  const [data, setData] = useState<Destination | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    loadDestination(HERO, controller.signal).then(setData).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const walk = useMemo(() => data && buildWalk(data), [data]);
  const review = useMemo(() => data && loadReview(data.id).review, [data]);
  const edits = useMemo(() => data && loadEdits(data.id).edits, [data]);
  if (!walk || !review || !edits) return { data, walk: null, markers: [], flagged: 0 };
  /** What the walk still flags, by the route screen's own rule: nothing she has removed or fixed, plus the spots she added. */
  const kept = walk.spots.filter(spot => spot.kind === 'flagged' && verdictOf(review, spot.stretches) !== 'not-barrier' && !isFixed(edits, spot.stretches));
  const mine = edits.added.filter(spot => !isFixed(edits, [spot.stretch]));
  return { data, walk, markers: spotMarkers(walk, review), flagged: kept.length + mine.length };
}
const sameInsets = (a: Insets, b: Insets) => a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
/** The part of the screen the walk may use: beside the words on a wide screen, between them on a phone. */
function useFree(words: RefObject<HTMLElement | null>, places: RefObject<HTMLElement | null>, search: RefObject<HTMLElement | null>): Insets {
  const [insets, setInsets] = useState<Insets>({ top: 96, right: 24, bottom: 220, left: 24 });
  useLayoutEffect(() => {
    const fit = () => {
      const wide = window.innerWidth >= 640, text = words.current?.getBoundingClientRect(), row = places.current?.getBoundingClientRect();
      // On a phone the walk sits below the search field and its line, not under them.
      const field = search.current?.querySelector('.home-search-row')?.getBoundingClientRect();
      const next: Insets = {
        top: wide ? 96 : Math.max(text?.bottom ?? 80, field?.bottom ?? 0) + 16,
        right: 24,
        bottom: row ? Math.max(24, window.innerHeight - row.top + 16) : 24,
        left: wide && text ? text.right + 32 : 16,
      };
      setInsets(previous => sameInsets(previous, next) ? previous : next);
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (words.current) observer.observe(words.current);
    if (search.current) observer.observe(search.current);
    if (places.current) observer.observe(places.current);
    window.addEventListener('resize', fit);
    return () => { observer.disconnect(); window.removeEventListener('resize', fit); };
  }, [words, places, search]);
  return insets;
}
/** The history entry a walk built on this device adds while it is open, so Back returns Home and a return to Home reopens it. */
const walkOf = (state: unknown): string | null => (state as { mercatureWalk?: unknown } | null)?.mercatureWalk as string ?? null;
/** Walks built on this device: the ones kept here, and the one open in the route screen. */
function useWalks() {
  const [kept, setKept] = useState<SavedWalk[]>([]);
  const [open, setOpen] = useState<{ built: Built; data: Destination; kept: boolean } | null>(null);
  const refresh = () => { void listWalks().then(setKept); };
  const show = (built: Built | null, kept = true) => {
    if (!built) { setOpen(null); return; }
    try { setOpen({ built, data: toDestination(built.place), kept }); } catch { setOpen(null); }
  };
  useEffect(() => {
    refresh();
    const reopen = () => { const id = walkOf(history.state); if (!id) show(null); else void loadWalk(id).then(show); };
    reopen();
    addEventListener('popstate', reopen);
    return () => removeEventListener('popstate', reopen);
  }, []);
  function openWalk(built: Built, kept = true) {
    if (walkOf(history.state) === built.place.id) history.replaceState({ mercatureWalk: built.place.id }, '');
    else history.pushState({ mercatureWalk: built.place.id }, '');
    show(built, kept); refresh();
  }
  function closeWalk() { if (walkOf(history.state)) history.back(); else setOpen(null); refresh(); }
  return { kept, open, openWalk, closeWalk, openKept: (id: string) => void loadWalk(id).then(built => { if (built) openWalk(built); }) };
}
export default function Home({onDestination, saved = [], onOpenSaved}: Props) {
  const { t, rich, lang } = useLanguage();
  const words = useRef<HTMLDivElement>(null);
  const places = useRef<HTMLElement>(null);
  const search = useRef<HTMLDivElement>(null);
  const openable = useOpenable();
  const hero = useHero();
  const walks = useWalks();
  const insets = useFree(words, places, search);
  // The guide's line sits at the bottom, where the route screen has it; the photos and the credit rest above it.
  const shell = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const root = shell.current, line = root?.querySelector<HTMLElement>('.home-guide');
    if (!root || !line) return;
    const fit = () => root.style.setProperty('--guide', `${line.offsetHeight}px`);
    fit();
    const observer = new ResizeObserver(fit); observer.observe(line);
    return () => observer.disconnect();
  });
  // What the guide says while she searches, the walk being built drawn behind it, and the last walk built, which can take another start.
  const [line, setLine] = useState<GuideLine | null>(null);
  const [talking, setTalking] = useState(false);
  const [preview, setPreview] = useState<Built | null>(null);
  const [again, setAgain] = useState<Again | null>(null);
  const shown = useMemo(() => { if (!preview) return null; try { const data = toDestination(preview.place), walk = buildWalk(data); return { data, walk, markers: spotMarkers(walk, null) }; } catch { return null; } }, [preview]);
  const prepared: Prepared[] = useMemo(() => covers.filter(cover => openable(cover.id)).map(cover => ({ id: cover.id, name: cover.name, area: fromRecord(cover.area, lang), aliases: `${cover.area} ${cover.aliases}` })), [openable, lang]);
  const mapWords = { zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut'), fit: t('map.fit'), credit: t('map.credit') };
  const others = covers.filter(cover => cover.id !== HERO && openable(cover.id));
  const status = !hero.data ? null : hero.flagged === 0 ? t('home.noFlaggedSpots') : hero.flagged === 1 ? t('home.oneFlaggedSpot') : t('home.flaggedSpots', { n: hero.flagged });
  if (walks.open) return <RouteCanvas key={walks.open.built.place.id} data={walks.open.data} asset={file => file} onHome={walks.closeWalk} onPlace={onDestination}
    spots={walks.open.built.spots} caption={walks.open.kept ? t('search.mapOnlyLong') : `${t('search.mapOnlyLong')} ${t('search.notKept')}`}/>;
  return <main ref={shell} className="welcome-shell site-home" aria-label={t('home.label')}>
    {shown ? <RouteMap key={shown.data.id} still data={shown.data} walk={shown.walk} photoView="" markers={shown.markers} labels={[]} insets={insets}
      highlight={null} onMarker={() => {}} onMap={() => {}} clearBottom={0} words={mapWords} ariaLabel={shown.data.target.name}/>
      : hero.data && hero.walk && <RouteMap still turntable data={hero.data} walk={hero.walk} photoView="" markers={hero.markers} labels={[]} insets={insets}
      highlight={null} onMarker={() => {}} onMap={() => {}} clearBottom={0} words={mapWords} ariaLabel={DESTINATIONS[HERO].name}/>}
    <div className="home-veil" aria-hidden="true"/>
    {hero.data && <p className="home-credit">{t('map.credit')}</p>}
    <header className="welcome-chrome"><span className="welcome-brand">mercature</span><Menu onPlace={onDestination}/></header>
    <div className="home-words" ref={words}><h1>{rich('home.title', { br: <br/> })}</h1>
      <div ref={search}><Search key={again ? `again ${again.target.id}` : 'search'} prepared={prepared} onPrepared={onDestination} onLine={setLine} onPreview={setPreview} again={again}
        onWalk={(built, kept, target) => { setAgain({ target, from: built.place.request.start.name }); walks.openWalk(built, kept); }}/></div>
    </div>
    <Places label={t('home.onPhone')} savedLabel={t('home.onDevice')}
      places={[
        { id: HERO, name: DESTINATIONS[HERO].name, image: qorikancha, label: t('home.explore', { name: covers[0].name, area: fromRecord(covers[0].area, lang) }),
          meta: [fromRecord(covers[0].area, lang), hero.data && t('common.metres', { m: Math.round(hero.data.lengthMetres) }), status].filter(Boolean).join(' · '),
          onOpen: () => onDestination(HERO) },
        ...others.map(cover => ({ id: cover.id, name: cover.name, image: cover.image, meta: fromRecord(cover.area, lang),
          label: t('home.explore', { name: cover.name, area: fromRecord(cover.area, lang) }), onOpen: () => onDestination(cover.id) })),
      ]}
      saved={[...walks.kept.map(walk => ({ id: walk.id, title: walk.target, detail: [t('search.mapOnly'), walk.area].filter(Boolean).join(' · '), onOpen: () => walks.openKept(walk.id) })),
        ...saved.map(entry => ({ id: entry.id, title: entry.title, detail: t(entry.kind === 'plan' ? 'home.savedPlan' : 'home.savedPlace'), onOpen: () => onOpenSaved(entry) }))]}/>
    <Companion className="home-bot" talking={talking}/>
    <Dialogue className="home-guide" label={t('home.guide')} lang={lang} say={line?.text ?? SCRIPT[lang].home.greet} onTalking={setTalking} continueLabel={t('home.more')}/>
  </main>;
}

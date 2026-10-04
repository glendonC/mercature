import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import qorikancha from '../covers/qorikancha.webp';
import narikala from '../covers/narikala.webp';
import swayambhu from '../covers/swayambhu.webp';
import { NOOR_FARM } from '../site/farm';
import { DESTINATIONS, PACKAGES, isDestinationId, loadDestination, type Destination } from '../destinations/data';
import RouteMap, { type Insets, type Marker } from '../destinations/RouteMap';
import { buildWalk, type Walk } from '../destinations/walk';
import { loadReview, verdictOf } from '../decisions/store';
import { CloseIcon, InfoIcon, SceneIcon } from '../icons';
import { useLanguage } from '../i18n';
import LanguageSwitch from '../i18n/LanguageSwitch';
import './Home.css';
export const covers = [
  { id: 'cusco-qorikancha', area: 'Cusco', name: 'Qorikancha', aliases: 'Plaza de Armas Coricancha Qoricancha Korikancha Temple of the Sun Templo del Sol', image: qorikancha, author: 'Draceane', year: 2023, license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', source: 'https://commons.wikimedia.org/wiki/File:Cuzco,_Coricancha,_2023_(01).jpg' },
  { id: 'tbilisi-narikala', area: 'Tbilisi', name: 'Narikala', aliases: 'Narikala fortress cable car', image: narikala, author: 'shankar s.', year: 2016, license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', source: 'https://commons.wikimedia.org/wiki/File:Looking_towards_Narikala_Fortress_from_the_cable_car_station.jpg' },
  { id: 'kathmandu-swayambhu', area: 'Kathmandu', name: 'Swayambhu', aliases: 'Swayambhunath monkey temple stupa', image: swayambhu, author: 'Jorge Láscar', year: 2014, license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', source: 'https://commons.wikimedia.org/wiki/File:Stairs_with_365_steps_to_climb_to_Swayambhunath_(17209517714).jpg' },
];
export type SavedEntry = { id: string; title: string; kind: 'place' | 'plan' };
type Props = {
  onOpen: (name: string) => void;
  onExample: () => void;
  onFarm: () => void;
  onDestination: (id: string) => void;
  onImport: () => void;
  onUpload: (name: string) => void;
  saved?: SavedEntry[];
  onOpenSaved: (entry: SavedEntry) => void;
};
/** The walk drawn behind Home, and the first place it offers. */
const HERO = 'cusco-qorikancha';
const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];
/** Places that open here: a published package on any host, a local record only where it answers on this device. */
function useOpenable(): (id: string) => boolean {
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
function useHero(): { data: Destination | null; walk: Walk | null; markers: Marker[]; left: number } {
  const [data, setData] = useState<Destination | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    loadDestination(HERO, controller.signal).then(setData).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const walk = useMemo(() => data && buildWalk(data), [data]);
  const review = useMemo(() => data && loadReview(data.id).review, [data]);
  if (!walk || !review) return { data, walk: null, markers: [], left: 0 };
  /** A spot carries the state the route canvas gives it (src/destinations/RouteCanvas.tsx); the still map hides the labels. */
  const markers: Marker[] = walk.spots.map(spot => ({
    id: spot.id, at: spot.at, selected: false, label: '',
    state: spot.kind === 'no-photos' ? 'no-photos' : verdictOf(review, spot.stretches) ?? 'open',
  }));
  const flagged = walk.spots.filter(spot => spot.kind === 'flagged');
  return { data, walk, markers, left: flagged.filter(spot => !verdictOf(review, spot.stretches)).length };
}
const sameInsets = (a: Insets, b: Insets) => a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
/** The part of the screen the walk may use: beside the words on a wide screen, between them on a phone. */
function useFree(words: RefObject<HTMLElement | null>, places: RefObject<HTMLElement | null>): Insets {
  const [insets, setInsets] = useState<Insets>({ top: 96, right: 24, bottom: 220, left: 24 });
  useLayoutEffect(() => {
    const fit = () => {
      const wide = window.innerWidth >= 640, text = words.current?.getBoundingClientRect(), row = places.current?.getBoundingClientRect();
      const next: Insets = {
        top: wide ? 96 : text ? text.bottom + 16 : 96,
        right: 24,
        bottom: row ? Math.max(24, window.innerHeight - row.top + 16) : 24,
        left: wide && text ? text.right + 32 : 16,
      };
      setInsets(previous => sameInsets(previous, next) ? previous : next);
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (words.current) observer.observe(words.current);
    if (places.current) observer.observe(places.current);
    window.addEventListener('resize', fit);
    return () => { observer.disconnect(); window.removeEventListener('resize', fit); };
  }, [words, places]);
  return insets;
}
/** The authored terrace drawn from its own scene records. */
function FarmPlan() {
  const { bounds, obstacles, unknown } = NOOR_FARM.scene;
  const w = bounds.maxX - bounds.minX, h = bounds.maxY - bounds.minY, side = Math.max(w, h) + 3;
  const box = (b: { minX: number; minY: number; maxX: number; maxY: number }) => ({ x: b.minX - bounds.minX, y: bounds.maxY - b.maxY, width: b.maxX - b.minX, height: b.maxY - b.minY });
  return <svg className="result-plan" viewBox={`${(w - side) / 2} ${(h - side) / 2} ${side} ${side}`} aria-hidden="true">
    <rect width={w} height={h} rx=".5" className="plan-ground"/>
    {unknown.map(region => <rect key={region.id} {...box(region.bounds)} className="plan-unknown"/>)}
    {obstacles.map(item => <rect key={item.id} {...box(item.bounds)} rx=".15" className={item.movable ? 'plan-movable' : 'plan-fixed'}/>)}
  </svg>;
}
export default function Home({onExample, onFarm, onDestination, saved = [], onOpenSaved}: Props) {
  const { t, rich, lang } = useLanguage();
  const credits = useRef<HTMLDialogElement>(null);
  const words = useRef<HTMLDivElement>(null);
  const places = useRef<HTMLElement>(null);
  const openable = useOpenable();
  const hero = useHero();
  const insets = useFree(words, places);
  const mapWords = { zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut'), fit: t('map.fit'), credit: t('map.credit') };
  const others = covers.filter(cover => cover.id !== HERO && openable(cover.id));
  const status = !hero.data ? null : hero.left === 0 ? t('home.allChecked') : hero.left === 1 ? t('home.oneSpotToCheck') : t('home.spotsToCheck', { n: hero.left });
  return <main className="welcome-shell site-home" aria-label={t('home.label')}>
    {hero.data && hero.walk && <RouteMap still data={hero.data} walk={hero.walk} photoView="" markers={hero.markers} labels={[]} insets={insets}
      highlight={null} onMarker={() => {}} onMap={() => {}} clearBottom={0} words={mapWords} ariaLabel={DESTINATIONS[HERO].name}/>}
    <div className="home-veil" aria-hidden="true"/>
    <header className="welcome-chrome"><span className="welcome-brand">mercature</span><div className="welcome-tools"><LanguageSwitch/><button className="welcome-tool" onClick={() => credits.current?.showModal()} aria-label={t('home.credits')}><InfoIcon/></button></div></header>
    <div className="home-words" ref={words}>
      <h1>{rich('home.title', { br: <br/> })}</h1>
      <p className="home-subtitle">{t('home.subtitle')}</p>
    </div>
    <section className="home-places" ref={places} aria-label={t('home.onPhone')}>
      <button className="home-place is-hero" aria-label={t('home.explore', { name: covers[0].name, area: covers[0].area })} onClick={() => onDestination(HERO)}>
        <img src={qorikancha} alt=""/>
        <span className="home-place-text">
          <strong>{DESTINATIONS[HERO].name}</strong>
          <small>{hero.data ? t('home.onFoot', { area: covers[0].area, metres: Math.round(hero.data.lengthMetres) }) : covers[0].area}</small>
          {status && <span className="home-status">{status}</span>}
        </span>
        <span className="home-open">{t('home.open')}</span>
      </button>
      {others.map(cover => <button key={cover.id} className="home-place" aria-label={t('home.explore', { name: cover.name, area: cover.area })} onClick={() => onDestination(cover.id)}>
        <img src={cover.image} alt=""/><span className="home-place-text"><strong>{cover.name}</strong><small>{cover.area}</small></span>
      </button>)}
      <button className="home-place" onClick={onFarm}>
        <FarmPlan/><span className="home-place-text"><strong>{NOOR_FARM.name[lang]}</strong><small>{t('farm.place')}</small></span><span className="badge">{t('common.example')}</span>
      </button>
      <button className="home-place" onClick={onExample}>
        <span className="result-scene-icon"><SceneIcon/></span><span className="home-place-text"><strong>{t('home.courtyard')}</strong></span><span className="badge">{t('common.example')}</span>
      </button>
      {saved.length > 0 && <div className="home-saved"><p>{t('home.onDevice')}</p>{saved.map(entry => <button key={entry.id} onClick={() => onOpenSaved(entry)}>
        <span>{entry.title}</span><small>{t(entry.kind === 'plan' ? 'home.savedPlan' : 'home.savedPlace')}</small>
      </button>)}</div>}
    </section>
    <dialog ref={credits} className="welcome-dialog" aria-labelledby="credits-title"><header><h2 id="credits-title">{t('home.credits')}</h2><button onClick={() => credits.current?.close()} aria-label={t('home.closeCredits')}><CloseIcon/></button></header><p>{t('home.creditsNote')}</p><ul>{covers.map(cover => <li key={cover.name}><a href={cover.source}>{cover.name}</a><br/>{cover.author}, {cover.year} · <a href={cover.licenseUrl}>{cover.license}</a></li>)}</ul></dialog>
  </main>;
}

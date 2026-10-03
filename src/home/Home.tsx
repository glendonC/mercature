import { useLayoutEffect, useRef, useState } from 'react';
import qorikancha from '../covers/qorikancha.webp';
import narikala from '../covers/narikala.webp';
import swayambhu from '../covers/swayambhu.webp';
import './Home.css';
export const covers = [
  { id: 'cusco-qorikancha', area: 'Cusco', name: 'Qorikancha', image: qorikancha, author: 'Draceane', year: 2023, license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', source: 'https://commons.wikimedia.org/wiki/File:Cuzco,_Coricancha,_2023_(01).jpg' },
  { id: 'tbilisi-narikala', area: 'Tbilisi', name: 'Narikala', image: narikala, author: 'shankar s.', year: 2016, license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', source: 'https://commons.wikimedia.org/wiki/File:Looking_towards_Narikala_Fortress_from_the_cable_car_station.jpg' },
  { id: 'kathmandu-swayambhu', area: 'Kathmandu', name: 'Swayambhu', image: swayambhu, author: 'Jorge Láscar', year: 2014, license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', source: 'https://commons.wikimedia.org/wiki/File:Stairs_with_365_steps_to_climb_to_Swayambhunath_(17209517714).jpg' },
];
export type SavedEntry = { id: string; title: string; kind: 'place' | 'plan' };
type Props = {
  onOpen: (name: string) => void;
  onExample: () => void;
  onDestination: (id: string) => void;
  onImport: () => void;
  onUpload: (name: string) => void;
  saved?: SavedEntry[];
  onOpenSaved: (entry: SavedEntry) => void;
};
function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>;
}
function UploadIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>;
}
export default function Home({onOpen, onExample, onDestination, onImport, onUpload, saved = [], onOpenSaved}: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const credits = useRef<HTMLDialogElement>(null);
  const upload = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!expanded) return;
    const fit = () => {
      if (results.current) results.current.style.maxHeight = `${Math.max(80, Math.min(370, window.innerHeight - results.current.getBoundingClientRect().top - 16))}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [expanded]);
  const term = query.trim().toLocaleLowerCase();
  const matches = saved.filter(item => item.title.toLocaleLowerCase().includes(term));
  const destinations = covers.filter(cover => `${cover.name} ${cover.area}`.toLocaleLowerCase().includes(term));
  const showDemo = !term || 'visitor courtyard authored editing demo'.includes(term);
  const showNew = !!term && !matches.length && !destinations.length && !showDemo;
  return <main className="welcome-shell site-home" aria-label="Mercature home">
    <header className="welcome-chrome"><span className="welcome-brand">mercature</span><button className="welcome-tool" onClick={() => credits.current?.showModal()} aria-label="Photo credits">ⓘ</button></header>
    <div className="welcome-atmosphere" aria-label="Prepared destinations">{covers.map((cover, i) => <button key={cover.name} className={`welcome-photo welcome-photo-slot-${i+1}`} aria-label={`Explore ${cover.name} · ${cover.area}`} onClick={() => onDestination(cover.id)}><span className="welcome-photo-content"><span className="welcome-photo-frame"><img src={cover.image} alt=""/></span><span className="welcome-place-label">{cover.name}</span></span></button>)}</div>
    <section className="welcome-center">
      <h1>An editable spatial<br/>accessibility model</h1>
      <div className="home-discovery" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false); }} onKeyDown={event => { if(event.key === 'Escape') { search.current?.focus(); setExpanded(false); } }}>
        <form className="place-search" role="search" onSubmit={event => { event.preventDefault(); setExpanded(true); requestAnimationFrame(() => results.current?.querySelector<HTMLButtonElement>('button')?.focus()); }}>
          <button type="button" className="search-circle upload-circle" aria-label="Upload photos or a saved plan" title="Upload photos or a saved plan" onClick={() => upload.current?.showModal()}><UploadIcon/></button>
          <input ref={search} aria-label="Explore a place" aria-controls="place-results" aria-expanded={expanded} placeholder="Explore a place" value={query} onFocus={() => setExpanded(true)} onChange={event => { setQuery(event.target.value); setExpanded(true); }} maxLength={120}/>
          <button className="search-circle search-submit" aria-label="Search places" title="Search places"><SearchIcon/></button>
        </form>
        <div id="place-results" ref={results} className="home-results" hidden={!expanded} aria-label="Places">
          {(destinations.length>0 || showDemo) && <div className="home-prepared"><p>Prepared examples</p>{destinations.map(cover => <button key={cover.id} onClick={() => onDestination(cover.id)}><img src={cover.image} alt=""/><span><strong>{cover.name}</strong><small>{cover.area}</small></span></button>)}{showDemo && <button onClick={onExample} aria-label="Visitor courtyard · Authored editing demo"><span className="result-scene-icon" aria-hidden="true">⌘</span><span><strong>Visitor courtyard</strong><small>Authored editing demo</small></span></button>}</div>}
          {expanded && matches.length>0 && <div className="home-saved"><p>On this device</p>{matches.map(item => <button key={item.id} onClick={() => onOpenSaved(item)}><span>{item.title}</span><small>{item.kind === 'plan' ? 'Improvement plan' : 'Photos & notes'}</small></button>)}</div>}
          {expanded && showNew && <div className="home-new"><p>No prepared scene for “{query.trim()}” yet.</p><button onClick={() => onOpen(query.trim())}>Add your own photos<span>Start “{query.trim()}”</span></button></div>}
        </div>
      </div>
    </section>
    <dialog ref={upload} className="welcome-dialog" aria-labelledby="upload-title">
      <header><h2 id="upload-title">Add to Mercature</h2><button onClick={() => upload.current?.close()} aria-label="Close upload">×</button></header>
      <div className="upload-choices"><button onClick={() => { upload.current?.close(); onUpload(query.trim()); }}><strong>Photos or video</strong><span>Start with views of your place</span></button><button onClick={() => { upload.current?.close(); onImport(); }}><strong>Saved Mercature plan</strong><span>Continue from a backup</span></button></div>
      <p className="upload-local">Files stay on this device. Add only files you may keep.</p>
    </dialog>
    <dialog ref={credits} className="welcome-dialog" aria-labelledby="credits-title"><header><h2 id="credits-title">Photo credits</h2><button onClick={() => credits.current?.close()} aria-label="Close photo credits">×</button></header><p>Destination covers from Wikimedia Commons. Resized to WebP and masked for display; separate from each example’s source evidence.</p><ul>{covers.map(cover => <li key={cover.name}><a href={cover.source}>{cover.name}</a><br/>{cover.author}, {cover.year} · <a href={cover.licenseUrl}>{cover.license}</a></li>)}</ul></dialog>
  </main>;
}

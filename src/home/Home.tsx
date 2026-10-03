import { useRef, useState } from 'react';
import qorikancha from '../covers/qorikancha.webp';
import narikala from '../covers/narikala.webp';
import swayambhu from '../covers/swayambhu.webp';
import './Home.css';
export const covers = [
  { name: 'Qorikancha', image: qorikancha, author: 'Draceane', year: 2023, license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', source: 'https://commons.wikimedia.org/wiki/File:Cuzco,_Coricancha,_2023_(01).jpg' },
  { name: 'Narikala', image: narikala, author: 'shankar s.', year: 2016, license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', source: 'https://commons.wikimedia.org/wiki/File:Looking_towards_Narikala_Fortress_from_the_cable_car_station.jpg' },
  { name: 'Swayambhu', image: swayambhu, author: 'Jorge Láscar', year: 2014, license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', source: 'https://commons.wikimedia.org/wiki/File:Stairs_with_365_steps_to_climb_to_Swayambhunath_(17209517714).jpg' },
];
export type SavedEntry = { id: string; title: string; kind: 'place' | 'plan' };
export default function Home({onOpen,onExample,onImport,saved=[],onOpenSaved}: {onOpen: (name: string) => void;onExample:()=>void;onImport:()=>void;saved?:SavedEntry[];onOpenSaved:(entry:SavedEntry)=>void}) {
  const [query, setQuery] = useState('');
  const credits = useRef<HTMLDialogElement>(null);
  const places = useRef<HTMLDialogElement>(null);
  const matches = query.trim()?saved.filter(item=>item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())):[];
  return <main className="welcome-shell site-home" aria-label="Mercature home">
    <header className="welcome-chrome"><span className="welcome-brand">mercature</span><nav className="welcome-tools" aria-label="Place actions"><button onClick={() => places.current?.showModal()}>My places{saved.length?` · ${saved.length}`:''}</button><button onClick={onImport}>Open file</button><button onClick={() => credits.current?.showModal()} aria-label="Photo credits">ⓘ</button></nav></header>
    <div className="welcome-atmosphere" aria-label="Cover photographs">{covers.map((cover, i) => <a key={cover.name} href={cover.source} className={`welcome-photo welcome-photo-slot-${i+1}`} title={`${cover.author}, ${cover.year} · ${cover.license}`}><span className="welcome-photo-frame"><img src={cover.image} alt={cover.name}/></span><span className="welcome-place-label"><span className="welcome-place-name">{cover.name}</span><span className="welcome-place-credit">{cover.author}, {cover.year} · {cover.license}</span></span></a>)}</div>
    <section className="welcome-center"><h1>An editable spatial accessibility model</h1><form className="place-search" onSubmit={event => {event.preventDefault(); if(query.trim()) onOpen(query.trim());}}><span aria-hidden="true">⌕</span><input aria-label="Find your place" placeholder="Find your place" value={query} onChange={event => setQuery(event.target.value)} maxLength={120}/><button aria-label="Open place" disabled={!query.trim()}>→</button></form><p className="search-note">Search your saved places, or start an unlisted place. No GPS needed.</p>{matches.length>0&&<div className="home-matches" aria-label="Matching saved places">{matches.slice(0,5).map(item=><button key={item.id} onClick={()=>onOpenSaved(item)}>{item.title}<span>{item.kind==='plan'?'Improvement plan':'Evidence workspace'} →</span></button>)}</div>}</section>
    <footer className="home-footer"><span>Small changes. More welcoming places.</span><button onClick={onExample}>Explore the editing example ↗</button></footer>
    <dialog ref={places} className="welcome-credit-dialog saved-dialog"><header><h2>My places</h2><button onClick={()=>places.current?.close()} aria-label="Close my places">×</button></header>{saved.length?<div className="saved-list">{saved.map(item=><button key={item.id} onClick={()=>onOpenSaved(item)}><strong>{item.title}</strong><span>{item.kind==='plan'?'Saved improvement plan':'Local evidence workspace'} →</span></button>)}</div>:<p>No saved places yet. Enter a place name to start locally, or explore the editing example.</p>}</dialog>
    <dialog ref={credits} className="welcome-credit-dialog"><header><h2>Photo credits</h2><button onClick={() => credits.current?.close()} aria-label="Close photo credits">×</button></header><p>Atmospheric covers, not site evidence. Resized to WebP and masked for display.</p><ul>{covers.map(cover => <li key={cover.name}><a href={cover.source}>{cover.name}</a><br/>{cover.author}, {cover.year} · <a href={cover.licenseUrl}>{cover.license}</a></li>)}</ul></dialog>
  </main>;
}

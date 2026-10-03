import {useId, type KeyboardEvent, type ReactNode, type Ref} from 'react';
import './place-canvas.css';

export type PlaceView = 'place' | 'messages' | 'changes';
const views: {id: PlaceView; label: string}[] = [
  {id: 'place', label: 'Place'}, {id: 'messages', label: 'Messages'}, {id: 'changes', label: 'Changes'},
];

/** A persistent map, with independent layers for navigation, context and conversation. */
export default function PlaceCanvas({title, view, onView, onHome, scene, overview, inspector, dialogue, tools, sceneRef, dialogueRef, children}: {
  title: string; view: PlaceView; onView: (view: PlaceView) => void; onHome: () => void;
  scene: ReactNode; overview: ReactNode; inspector?: ReactNode; dialogue: ReactNode; tools?: ReactNode;
  sceneRef: Ref<HTMLDivElement>; dialogueRef: Ref<HTMLElement>; children?: ReactNode;
}) {
  const id = useId();
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % views.length : event.key === 'ArrowLeft' ? (index + views.length - 1) % views.length : event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); onView(views[next].id);
    document.getElementById(`${id}-${views[next].id}`)?.focus();
  }
  return <main className="place-canvas" data-view={view} aria-label={`${title} workspace`}>
    <div className="place-scene guide-scene" ref={sceneRef}>{scene}</div>
    <header className="place-bar">
      <button className="place-home" onClick={onHome} aria-label="Home" title="Home"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 10 12 3l8 7v11h-6v-7h-4v7H4Z" /></svg></button>
      <div className="place-identity"><span>{title}</span><small>Example</small></div>
      <div className="place-tabs" role="tablist" aria-label="Place workspace">
        {views.map((item, index) => <button key={item.id} id={`${id}-${item.id}`} role="tab" aria-selected={view === item.id} aria-controls={`${id}-panel`} tabIndex={view === item.id ? 0 : -1} onKeyDown={event => navigate(event, index)} onClick={() => onView(item.id)}>{item.label}</button>)}
      </div>
      <div className="place-tools">{tools}</div>
    </header>
    <section id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${view}`} className="place-overview" key={view}>{overview}</section>
    {inspector && <aside className="place-inspector" aria-label="Selected spot">{inspector}</aside>}
    <section className="place-dialogue scene-dialogue" ref={dialogueRef} aria-label="Guide dialogue">{dialogue}</section>
    {children}
  </main>;
}

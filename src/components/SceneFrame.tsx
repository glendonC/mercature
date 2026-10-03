import type {ReactNode, Ref} from 'react';
import './scene-stage.css';

/** Shared presentation slots. Each region grows independently without replacing the scene. */
export default function SceneFrame({className = '', label, step, progress, scene, context, dialogue, sceneRef, dialogueRef, children}: {
  className?: string;
  label: string;
  step?: string;
  progress: ReactNode;
  scene: ReactNode;
  context: ReactNode;
  dialogue: ReactNode;
  sceneRef?: Ref<HTMLDivElement>;
  dialogueRef?: Ref<HTMLElement>;
  children?: ReactNode;
}) {
  return <main className={`scene-stage ${className}`} data-step={step} aria-label={label}>
    {progress}
    <div className="guide-scene" ref={sceneRef}>{scene}</div>
    <section className="context-panel" aria-label="Next action">{context}</section>
    <section className="scene-dialogue" ref={dialogueRef} aria-label="Guide dialogue">{dialogue}</section>
    {children}
  </main>;
}

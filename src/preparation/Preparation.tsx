import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import SceneFrame from '../components/SceneFrame';
import SceneProgress from '../components/SceneProgress';
import Companion from '../components/Companion';
import SpatialView from '../spatial/SpatialView';
import { DEFAULT_PROFILE, SYNTHETIC_SCENE } from '../spatial/fixtures';
import { solveScene } from '../spatial/solver';
import { validateScene } from '../spatial/validation';
import type { Result } from '../spatial/contracts';
import './preparation.css';

type PreparationProps = {
  optionsContent?: ReactNode;
  title: string;
  provenance: string;
  sourceLabel?: string;
  stage: 'views' | 'scene';
  busy: boolean;
  message: string;
  detail?: string;
  children: ReactNode;
  action?: string;
  onAction?: () => void;
  onHome: () => void;
  onSkip: () => void;
  error?: string;
};
/** A presentation of real preparation state. Stage changes never stand in for processing. */
export function Preparation({optionsContent, title, provenance, sourceLabel = "Views", stage, busy, message, detail, children, action, onAction, onHome, onSkip, error}: PreparationProps) {
  const optionsId = useId();
  const optionsRef = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({preventScroll: true}); }, [stage]);
  return <SceneFrame className="preparation" label={`Prepare ${title}`} step={stage}
    progress={<SceneProgress title="Prepare the scene" items={[
      {id:'views',label:sourceLabel,state:stage === 'views' ? 'current' : 'complete'},
      {id:'scene',label:'Open scene',state:stage === 'scene' ? 'current' : 'upcoming'},
    ]}/>}
    scene={<section className="preparation-stage" aria-label="Preparation preview">{children}</section>}
    context={<>
      <div className="context-panel-head"><span className="scene-caption">{provenance}</span><button className="dialogue-options" popoverTarget={optionsId} aria-label="Scene options">•••</button></div>
      <div className="preparation-task"><h1>{title}</h1>{detail && <p className="context-description">{detail}</p>}
      {error && <p role="alert" className="preparation-error">{error}</p>}
      {action && <button className="primary" disabled={busy} onClick={onAction}>{action}</button>}
      </div>
    </>}
    dialogue={<><span className="preparation-announcement" role="status">{message}</span>
      <div className="preparation-speaker">{busy ? <ThinkingOrb state="connecting" size={64} theme="light" /> : <Companion tone={stage === 'views' ? 'evidence' : 'guide'}><span className="sr-only">Preparation guide</span></Companion>}</div>
      <h2 className={busy ? "is-processing" : undefined} ref={heading} tabIndex={-1}>{message}</h2>
    </>}>
    <div popover="auto" id={optionsId} ref={optionsRef} className="scene-options" onClick={event => {
      if ((event.target as HTMLElement).closest('button')) optionsRef.current?.hidePopover();
    }}><p>{title}<span>{provenance}</span></p>{optionsContent}<div className="scene-options-links"><button onClick={onHome} aria-label="Home">Return home</button><button onClick={onSkip}>Skip walkthrough</button></div></div>
  </SceneFrame>;
}

export type AuthoredViewState = {selectedId: string | null; rotation: number};
export default function AuthoredPreparation({onHome, onReady}: {onHome: () => void; onReady: (state: AuthoredViewState) => void}) {
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<'views' | 'scene'>('views');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>('bench');
  const [rotation, setRotation] = useState(0);
  const enter = () => onReady({selectedId: selected, rotation});
  useEffect(() => {
    if (stage !== 'scene') return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      try {
        validateScene(SYNTHETIC_SCENE);
        const checked = solveScene(SYNTHETIC_SCENE, DEFAULT_PROFILE);
        if (!cancelled) setResult(checked);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [stage]);
  return <Preparation optionsContent={<div ref={setControlsTarget}/>} title="Visitor courtyard" provenance="Example" sourceLabel="Layout" stage={stage} busy={stage === 'scene' && !result && !error} onHome={onHome} onSkip={enter}
    message={stage === 'views' ? 'Start with the layout.' : error ? 'The layout needs attention.' : result ? 'Your scene is ready.' : 'Checking the layout…'}
    detail={stage === 'views' ? 'A dimensioned example with one movable bench.' : result ? 'Explore the bench, then preview a change.' : undefined}
    action={stage === 'views' ? 'Load scene' : result ? 'Enter scene' : undefined} onAction={stage === 'views' ? () => setStage('scene') : enter} error={error}>
    {result ? <div className="preparation-authored-scene"><SpatialView controlsTarget={controlsTarget} rotation={rotation} onRotationChange={setRotation} scene={SYNTHETIC_SCENE} result={result} selectedId={selected} onSelect={setSelected} view="3d" compact /></div> : <Layout/>}
  </Preparation>;
}
function Layout() {
  const scene = SYNTHETIC_SCENE;
  return <div className="preparation-layout"><svg viewBox="-1 -1 14 10" role="img" aria-label="Authored courtyard layout, with a bench between two dividing walls">
    <defs><pattern id="preparation-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#71867c22" strokeWidth=".025"/></pattern></defs>
    <rect width="12" height="8" rx=".12" fill="#e8eee7" stroke="#a8b9ae" strokeWidth=".025"/><rect width="12" height="8" fill="url(#preparation-grid)"/>
    {scene.obstacles.map(obstacle => <rect key={obstacle.id} x={obstacle.bounds.minX} y={8-obstacle.bounds.maxY} width={obstacle.bounds.maxX-obstacle.bounds.minX} height={obstacle.bounds.maxY-obstacle.bounds.minY} rx=".04" fill={obstacle.movable ? '#b58865' : '#89998e'}/>)}
    {scene.unknown.map(area => <rect key={area.id} x={area.bounds.minX} y={8-area.bounds.maxY} width={area.bounds.maxX-area.bounds.minX} height={area.bounds.maxY-area.bounds.minY} fill="#dcded3" stroke="#a8afa1" strokeWidth=".03" strokeDasharray=".1 .1"/>)}
    <circle cx={scene.start.x} cy={8-scene.start.y} r=".1" fill="#283e40"/>
    <text x="2" y="4.55" textAnchor="middle">Entrance</text><text x="7.2" y="4.4">Bench</text><path d="M6.2 4.4H7" stroke="#697e71" strokeWidth=".025"/>
    <text x="6" y="8.65" textAnchor="middle">12 m</text><text x="-.5" y="4.1" textAnchor="middle" transform="rotate(-90,-.5,4.1)">8 m</text>
  </svg><span className="preparation-layout-caption">Example layout, not measured</span></div>;
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Companion from '../components/Companion';
import SpatialView from '../spatial/SpatialView';
import { DEFAULT_PROFILE, SYNTHETIC_SCENE } from '../spatial/fixtures';
import { solveScene } from '../spatial/solver';
import { validateScene } from '../spatial/validation';
import type { Result } from '../spatial/contracts';
import './preparation.css';

type PreparationProps = {
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
export function Preparation({title, provenance, sourceLabel = "Views", stage, busy, message, detail, children, action, onAction, onHome, onSkip, error}: PreparationProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({preventScroll: true}); }, [stage]);
  return <main className="preparation">
    <header className="preparation-header"><button onClick={onHome} aria-label="Home">←</button><div><h1>{title}</h1><span>{provenance}</span></div><button className="preparation-skip" onClick={onSkip}>Skip walkthrough</button></header>
    <ol className="preparation-steps" aria-label="Preparation steps"><li aria-current={stage === 'views' ? 'step' : undefined}>{sourceLabel}</li><li aria-hidden="true">·</li><li aria-current={stage === 'scene' ? 'step' : undefined}>Scene</li></ol>
    <section className="preparation-stage" aria-label="Preparation preview">{children}</section>
    <footer className="preparation-guide">
      <div className="preparation-guide-copy"><Companion working={busy} tone={stage === 'views' ? 'evidence' : 'guide'}><span className="preparation-announcement" role="status">{message}</span></Companion><div><h2 ref={heading} tabIndex={-1}>{message}</h2>{detail && <p>{detail}</p>}{error && <p role="alert" className="preparation-error">{error}</p>}</div></div>
      {action && <button className="preparation-action" disabled={busy} onClick={onAction}>{action}<span aria-hidden="true">↗</span></button>}
    </footer>
  </main>;
}

export type AuthoredViewState = {selectedId: string | null; rotation: number};
export default function AuthoredPreparation({onHome, onReady}: {onHome: () => void; onReady: (state: AuthoredViewState) => void}) {
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
  return <Preparation title="Visitor courtyard" provenance="Authored example" sourceLabel="Layout" stage={stage} busy={stage === 'scene' && !result && !error} onHome={onHome} onSkip={enter}
    message={stage === 'views' ? 'Start with the layout.' : error ? 'The layout needs attention.' : result ? 'Your scene is ready.' : 'Checking the layout…'}
    detail={stage === 'views' ? 'A dimensioned example with one movable bench.' : result ? 'Explore the bench, then preview a change.' : undefined}
    action={stage === 'views' ? 'Load scene' : result ? 'Enter scene' : undefined} onAction={stage === 'views' ? () => setStage('scene') : enter} error={error}>
    {result ? <div className="preparation-authored-scene"><SpatialView rotation={rotation} onRotationChange={setRotation} scene={SYNTHETIC_SCENE} result={result} selectedId={selected} onSelect={setSelected} view="3d" compact /></div> : <Layout/>}
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
  </svg><span className="preparation-layout-caption">Authored dimensions · no captured photographs</span></div>;
}

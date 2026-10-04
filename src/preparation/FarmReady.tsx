import { useEffect, useRef, useState } from 'react';
import Companion from '../components/Companion';
import PlaceCanvas from '../components/PlaceCanvas';
import SpatialView from '../spatial/SpatialView';
import { modelDownloadBytes, modelState, modelStored, prepareModel, type ModelState } from '../language/understand';
import { NOOR_FARM } from '../site/farm';
import { createScenario } from '../spatial/scenario';
import { solveScene } from '../spatial/solver';
import type { Project, Result } from '../spatial/contracts';
import type { AuthoredViewState } from './Preparation';
import { useLanguage } from '../i18n';
import { PrimaryAction, TextButton } from '../ui';
import { DownloadIcon, EnterIcon, HomeIcon, RotateIcon } from '../ui/icons';
import './farm-ready.css';

/** When each row starts its work, so a person can follow it. The work itself is real and unpadded. */
const REVEAL = [350, 850, 1400, 1950];
/** Continue on its own at most this long after opening, leaving room for the exit fade. */
const LIMIT = 5600;
/** How long the finished panel stays readable before continuing. */
const HOLD = 1200;

type Model =
  | { kind: 'checking' }
  | { kind: 'loading' }
  | { kind: 'downloading'; loaded: number; total: number }
  | { kind: 'ready' }
  | { kind: 'off'; stored: boolean; failed: boolean };
type RowState = 'waiting' | 'working' | 'done' | 'off' | 'error';

const { bounds } = NOOR_FARM.scene;
const size = `${bounds.maxX - bounds.minX} × ${bounds.maxY - bounds.minY} m`;

function openSite(): Project {
  const scene = structuredClone(NOOR_FARM.scene), profile = structuredClone(NOOR_FARM.profile);
  return { schemaVersion: 'spatial-v1', scene, profile, scenario: createScenario(scene, profile) };
}

/** Nothing checked yet: no cells, and the place markers stay hidden until the real result arrives. */
function unchecked(project: Project): Result {
  return { schemaVersion: 'spatial-v1', sceneHash: '', profileHash: '', scenarioHash: '', solverHash: '', traversals: [], cells: [], destinations: [], reachableArea: 0, blockedArea: 0, unknownArea: 0, cellSize: project.profile.cellSize, unsupported: [], assumptions: [], hypothetical: false };
}

function fromState(state: ModelState, stored: boolean): Model {
  if (state.status === 'ready') return { kind: 'ready' };
  if (state.status === 'downloading') return { kind: 'downloading', loaded: state.loadedBytes, total: state.totalBytes };
  return { kind: 'off', stored, failed: state.status === 'failed' };
}

function Mark() {
  return <span className="step-mark" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m4.5 8.2 2.4 2.4 4.6-5"/></svg></span>;
}

/** Opens Noor's authored farm with real steps, then hands the same project to the workspace. */
export default function FarmReady({ onHome, onReady }: { onHome: () => void; onReady: (project: Project, view: AuthoredViewState) => void }) {
  const { t, lang } = useLanguage();
  const megabytes = (bytes: number) => t('common.megabytes', { mb: Math.round(bytes / 1e6) });
  const name = NOOR_FARM.name[lang];
  const started = useRef(performance.now());
  const alive = useRef(true);
  const stored = useRef(false);
  const enterButton = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null), dock = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [project, setProject] = useState<Project | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [model, setModel] = useState<Model>(() => modelState().status === 'ready' ? { kind: 'ready' } : { kind: 'checking' });
  const [hold, setHold] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [downloadSize, setDownloadSize] = useState<number | null>(null);

  useEffect(() => {
    alive.current = true;
    const update = (next: ModelState) => { if (alive.current) setModel(fromState(next, stored.current)); };
    const now = modelState();
    if (now.status === 'downloading') void prepareModel(update).then(update);
    else if (now.status !== 'ready') void modelStored().then(isStored => {
      if (!alive.current) return;
      stored.current = isStored;
      if (!isStored) return setModel({ kind: 'off', stored: false, failed: now.status === 'failed' });
      setModel({ kind: 'loading' });
      void prepareModel(update).then(update);
    });
    const timers = REVEAL.map((at, index) => window.setTimeout(() => setStep(current => Math.max(current, index + 1)), at));
    return () => { alive.current = false; timers.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    if (model.kind !== 'off' || model.stored) return;
    let live = true;
    void modelDownloadBytes().then(bytes => { if (live) setDownloadSize(bytes); });
    return () => { live = false; };
  }, [model]);

  useEffect(() => {
    if (step < 1 || project || error) return;
    try { setProject(openSite()); } catch (e) { setError((e as Error).message); }
  }, [step, project, error]);

  useEffect(() => {
    if (step < 4 || !project || result || error) return;
    // One frame lets "Checking" paint before the solver runs on the main thread.
    const frame = requestAnimationFrame(() => {
      try { setResult(solveScene(project.scene, project.profile)); } catch (e) { setError((e as Error).message); }
    });
    return () => cancelAnimationFrame(frame);
  }, [step, project, result, error]);

  const settled = model.kind === 'ready' || model.kind === 'off';
  const enter = () => {
    if (leaving) return;
    let ready = project;
    if (!ready) {
      try { ready = openSite(); } catch (e) { setError((e as Error).message); return; }
    }
    setLeaving(true);
    const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const view = { selectedId: selected, rotation: 0 };
    window.setTimeout(() => onReady(ready, view), quiet ? 0 : 280);
  };
  const latestEnter = useRef(enter);
  latestEnter.current = enter;

  useEffect(() => {
    if (!result) return;
    enterButton.current?.focus({ preventScroll: true });
  }, [result]);

  useEffect(() => {
    if (!result || hold || leaving || error) return;
    const left = Math.max(0, started.current + LIMIT - performance.now());
    const timer = window.setTimeout(() => latestEnter.current(), settled ? Math.min(HOLD, left) : left);
    return () => clearTimeout(timer);
  }, [result, settled, hold, leaving, error]);

  function download() {
    setHold(true);
    setModel({ kind: 'downloading', loaded: 0, total: 0 });
    const update = (next: ModelState) => { if (alive.current) setModel(fromState(next, stored.current)); };
    void prepareModel(update).then(update);
  }

  const reachable = result?.destinations.filter(destination => destination.status === 'reachable').length ?? 0;
  const modelRow: { state: RowState; value: string } =
    model.kind === 'ready' ? { state: 'done', value: t('common.ready') }
    : model.kind === 'off' ? { state: 'off', value: t('farm.useWithoutAi') }
    : model.kind === 'downloading' ? { state: 'working', value: model.total ? t('farm.percentOf', { percent: Math.floor(model.loaded / model.total * 100), size: megabytes(model.total) }) : t('common.starting') }
    : { state: 'working', value: t(model.kind === 'loading' ? 'common.loading' : 'common.checking') };
  const rows: { id: string; label: string; state: RowState; value: string }[] = [
    { id: 'site', label: t('farm.site'), state: step < 1 ? 'waiting' : project ? 'done' : error ? 'error' : 'working', value: project ? size : '' },
    { id: 'model', label: t('farm.model'), state: step < 2 ? 'waiting' : modelRow.state, value: step < 2 ? '' : modelRow.value },
    { id: 'spots', label: t('farm.spots'), state: step < 3 ? 'waiting' : 'done', value: step < 3 ? '' : t('farm.listed', { count: NOOR_FARM.features.length }) },
    { id: 'paths', label: t('farm.paths'), state: step < 4 ? 'waiting' : result ? 'done' : error ? 'error' : 'working', value: result ? t('farm.reachable', { count: reachable, total: result.destinations.length }) : step < 4 ? '' : t('common.checking') },
  ];
  const line = error ? t('farm.attention') : result ? t('farm.ready', { name }) : t('farm.getting', { name });
  const stage_ = !project ? 'empty' : result ? 'paths' : 'site';

  return <PlaceCanvas title={name} view="place" onView={() => undefined} onHome={onHome} sceneRef={stage} dialogueRef={dock}
    scene={<div className={`farm-ready-scene${leaving ? ' is-leaving' : ''}`} data-stage={stage_}>{project && <SpatialView controlsTarget={null} rotation={0} scene={project.scene} result={result ?? unchecked(project)} selectedId={selected} onSelect={setSelected} view="3d" compact />}</div>}
    overview={<div className={`farm-ready${leaving ? ' is-leaving' : ''}`}>
      <span className="place-kicker">{t('farm.kicker')}</span>
      <h1>{name}</h1>
      <p className="place-copy">{t('farm.place')}</p>
      <ol className="farm-ready-steps" aria-label={t('farm.kicker')}>{rows.map(row => <li key={row.id} data-state={row.state} data-step={row.id}>
        <Mark/><span className="step-label">{row.label}</span><span className="step-value">{row.value}</span>
        {row.id === 'model' && step >= 2 && model.kind === 'downloading' && <span className="step-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, model.loaded / Math.max(1, model.total) * 100)}%` }}/></span>}
        {row.id === 'model' && step >= 2 && model.kind === 'off' && (model.stored ? model.failed && <TextButton className="step-action" icon={<RotateIcon/>} onClick={download}>{t('common.tryAgain')}</TextButton> : !!downloadSize && <TextButton className="step-action" icon={<DownloadIcon/>} onClick={download}>{t('farm.download', { size: megabytes(downloadSize) })}</TextButton>)}
      </li>)}</ol>
      {error && <p className="guide-error" role="alert">{error}</p>}
      <div className="farm-ready-actions"><PrimaryAction ref={enterButton} icon={error ? <HomeIcon/> : <EnterIcon/>} onClick={error ? onHome : enter}>{t(error ? 'common.returnHome' : 'common.enter')}</PrimaryAction></div>
    </div>}
    dialogue={<><div className="farm-ready-bot"><Companion working={!result && !error}><span className="sr-only">{t('common.guide')}</span></Companion></div><p role="status">{line}</p></>}/>;
}

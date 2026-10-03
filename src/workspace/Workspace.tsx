import { useEffect, useId, useMemo, useRef, useState } from "react";
import SpatialView from "../spatial/SpatialView";
import PlaceCanvas, {type PlaceView} from "../components/PlaceCanvas";
import ScenePins from "../components/ScenePins";
import {NOOR_FARM} from "../site/farm";
import type {Site} from "../site/contracts";
import {understand, prepareModel, modelState, type Understanding, type ModelState} from "../language/understand";
import AIResultCard, { type AIResult } from "../components/AIResultCard";
import ContextualGuide from "../components/ContextualGuide";
import {
  BENCH_CLEAR_POSITION,
} from "../spatial/fixtures";
import {
  appendOperation,
  applyScenario,
  createScenario,
  undoScenario,
} from "../spatial/scenario";
import { solveScene } from "../spatial/solver";
import { contentHash } from "../spatial/validation";
import type { Operation, Profile, Project } from "../spatial/contracts";
import {
  confirmTargets,
  createPlan,
  serializePlan,
  type Confirmation,
  type ImprovementPlan,
  type Origin,
} from "../plans";
import "./workspace.css";
export type WorkspaceProps = {
  initialPlan?: ImprovementPlan;
  analysisResult?: AIResult;
  initialViewState?: {selectedId: string | null; rotation: number};
  initialProject?: Project;
  onHome: () => void;
  onSave: (plan: ImprovementPlan) => void;
};
type Step = "start" | "message" | "confirm" | "edit" | "compare" | "done";
const outcome = (status: string) =>
  status === "reachable"
    ? "Connected"
    : status === "blocked"
      ? "Blocked"
      : "Unknown";
export default function Workspace({
  initialPlan,
  analysisResult,
  initialViewState,
  initialProject,
  onHome,
  onSave,
}: WorkspaceProps) {
  const initial = initialPlan?.project ?? initialProject;
  const [scene] = useState(() =>
    structuredClone(initial?.scene ?? NOOR_FARM.scene),
  );
  const inventory = useMemo(
    () => [
      ...scene.obstacles,
      ...scene.supports,
      ...scene.unknown,
      ...scene.destinations,
    ],
    [scene],
  );
  const [profile, setProfile] = useState(() =>
    structuredClone(initial?.profile ?? NOOR_FARM.profile),
  );
  const [scenario, setScenario] = useState(() =>
    structuredClone(initial?.scenario ?? createScenario(scene, profile)),
  );
  const [rotation, setRotation] = useState(initialViewState?.rotation ?? 0);
  const [view, setView] = useState<"map" | "3d" | "split">("3d");
  const viewBeforePlacement = useRef<"map" | "3d" | "split">("3d");
  const [comparison, setComparison] = useState<"original" | "proposed">(
    "proposed",
  );
  const [selected, setSelected] = useState<string | null>(
    initialPlan?.confirmation.targets[0]?.id ??
      (initialViewState?.selectedId && inventory.some(item => item.id === initialViewState.selectedId) ? initialViewState.selectedId : null) ??
      null,
  );
  const [section, setSection] = useState<PlaceView>(initialPlan ? "changes" : "place");
  const [understanding, setUnderstanding] = useState<Understanding | null>(null);
  const [thinking, setThinking] = useState(false);
  const [model, setModel] = useState<ModelState>(() => modelState());
  const [preparingModel, setPreparingModel] = useState(false);
  const request = useRef(0);
  useEffect(() => () => {request.current++;}, []);
  const [step, setStep] = useState<Step>(initialPlan ? "done" : "start");
  const [mode, setMode] = useState<"concern" | "proactive">(
    initialPlan?.origin.kind ?? "proactive",
  );
  const [message, setMessage] = useState(
    initialPlan?.origin.kind === "concern"
      ? initialPlan.origin.originalText
      : "",
  );
  const [language, setLanguage] = useState(
    initialPlan?.origin.kind === "concern" ? initialPlan.origin.language : "en",
  );
  const [confirmation, setConfirmation] = useState<Confirmation | null>(
    initialPlan?.confirmation ?? null,
  );
  const [origin, setOrigin] = useState<Origin | null>(
    initialPlan?.origin ?? null,
  );
  const [savedIdentity, setSavedIdentity] = useState(
    initialPlan
      ? {
          id: initialPlan.id,
          createdAt: initialPlan.createdAt,
          originHash: contentHash(initialPlan.origin),
        }
      : null,
  );
  const [title, setTitle] = useState(
    initialPlan?.title ?? "Review the visitor approach",
  );
  const [decision, setDecision] = useState<ImprovementPlan["decision"]>(
    initialPlan?.decision ?? "planned",
  );
  const [notes, setNotes] = useState(initialPlan?.notes ?? "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [plan, setPlan] = useState<ImprovementPlan | null>(initialPlan ?? null);
  const [placing, setPlacing] = useState(false);
  const [move, setMove] = useState({
    x: BENCH_CLEAR_POSITION.x.toString(),
    y: BENCH_CLEAR_POSITION.y.toString(),
  });
  const optionsId = useId();
  const options = useRef<HTMLDivElement>(null);
  const optionsButton = useRef<HTMLButtonElement>(null);
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);

  const details = useRef<HTMLDialogElement>(null);
  const placementDialog = useRef<HTMLDialogElement>(null);
  const baseline = useMemo(() => solveScene(scene, profile), [scene, profile]);
  const proposed = useMemo(
    () => solveScene(scene, profile, scenario),
    [scene, profile, scenario],
  );
  const applied = useMemo(
    () => applyScenario(scene, profile, scenario),
    [scene, profile, scenario],
  );
  const site: Site = useMemo(() => scene.id === NOOR_FARM.id ? {...NOOR_FARM, scene, profile} : {
    id: scene.id, name: {en: scene.title, es: scene.title}, place: '', provenance: 'synthetic', scene, profile,
    features: inventory.map(item => ({id: item.id, name: {en: item.label, es: item.label}, description: '', aliases: {}})), placements: [],
  }, [scene, profile, inventory]);
  const nameOf = (id: string) => site.features.find(item => item.id === id)?.name.en ?? inventory.find(item => item.id === id)?.label ?? id;
  const target = confirmation?.targets[0]?.id ?? selected;
  const feature = scene.obstacles.find((o) => o.id === target);
  const selectedFeature = inventory.find((o) => o.id === selected);
  const editable = !!confirmation && !!feature?.movable && !!feature.reviewed;
  const actionName =
    feature?.label.replace(/^Reviewed movable /, "") ?? "object";
  const destination = scene.destinations[0]?.label ?? "Destination";
  const dirty = () => {
    setPlan(null);
    setNotice("");
  };
  const materialDirty = () => {
    setDecision("planned");
    dirty();
  };
  function begin(kind: "concern" | "proactive") {
    setSection(kind === "concern" ? "messages" : "changes");
    setMode(kind);
    setConfirmation(null);
    setOrigin(null);
    setScenario(createScenario(scene, profile));
    setStep(kind === "concern" ? "message" : "confirm");
    setPlacing(false);
    setError("");
    materialDirty();
  }
  function confirm() {
    try {
      if (!selectedFeature) throw new Error("Select a feature in the scene.");
      if (mode === "concern" && !message.trim())
        throw new Error("Add the visitor message first.");
      const id = crypto.randomUUID();
      const next: Origin =
        mode === "concern"
          ? {
              kind: "concern",
              id,
              source: {
                id: `report-${id}`,
                revision: "1",
                description:
                  "Operator-entered visitor report; retained only on this device.",
                provenance: "local",
                permission: "local-only",
              },
              originalText: message,
              language,
              supportingSpan: { start: 0, end: message.length, quote: message },
            }
          : {
              kind: "proactive",
              id,
              source: {
                id: "authored-site-check",
                revision: String(scene.revision),
                description: "Operator check of the authored synthetic scene.",
                provenance: "synthetic",
                permission: "exportable",
              },
              expectation: `Review modeled access from the start to ${destination} under explicit movement requirements.`,
              method:
                "Deterministic horizontal square-envelope check; operator reviews linked evidence.",
            };
      const checked = confirmTargets({
        origin: next,
        scene,
        targetIds: [selectedFeature.id],
        reviewer: "Local operator",
        interpretation:
          mode === "concern"
            ? `Operator associated the original report with ${selectedFeature.label}; no measurement inferred from the report.`
            : `Operator selected ${selectedFeature.label} for review of the modeled passage.`,
      });
      setOrigin(next);
      setConfirmation(checked);
      setScenario(createScenario(scene, profile));
      setTitle(`Review ${selectedFeature.label.toLocaleLowerCase()}`);
      setStep("edit");
      setSection("changes");
      setError("");
      materialDirty();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function edit(operation: Operation) {
    try {
      if (!editable) throw new Error("Confirm a movable feature first.");
      setScenario(appendOperation(scene, profile, scenario, operation));
      setComparison("proposed");
      setTitle(
        `${operation.kind === "move" ? "Move" : "Remove"} ${feature!.label.toLocaleLowerCase()}`,
      );
      if (placing) setView(viewBeforePlacement.current);
      setPlacing(false);
      setStep("compare");
      setError("");
      materialDirty();
      placementDialog.current?.close();
    } catch (e) {
      const raw = (e as Error).message;
      setError(/support|ground|unknown/i.test(raw) ? "The ground there isn’t mapped. Try another position." : /intersect|collision|overlap/i.test(raw) ? "Something is already there. Try another position." : /bounds|outside|edge/i.test(raw) ? "Too close to the edge. Try another position." : "That position can’t be checked. Try another position.");
    }
  }
  function changeProfile(next: Profile) {
    try {
      solveScene(scene, next);
      setProfile(next);
      setScenario(createScenario(scene, next));
      setStep(confirmation ? "edit" : "start");
      setComparison("proposed");
      setError("");
      materialDirty();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function save() {
    try {
      if (!origin || !confirmation) throw new Error("Confirm a feature first.");
      const same = savedIdentity?.originHash === contentHash(origin);
      const next = createPlan({
        id: same ? savedIdentity!.id : crypto.randomUUID(),
        title: title.trim(),
        origin,
        confirmation,
        project: { schemaVersion: "spatial-v1", scene, profile, scenario },
        decision,
        notes,
      });
      if (same) next.createdAt = savedIdentity!.createdAt;
      onSave(next);
      setSavedIdentity({
        id: next.id,
        createdAt: next.createdAt,
        originHash: contentHash(origin),
      });
      setPlan(next);
      setStep("done");
      setError("");
      setNotice("Saved on this device.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function backup() {
    if (!plan) return;
    try {
      const url = URL.createObjectURL(
        new Blob([serializePlan(plan)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `mercature-plan-${plan.id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Local backup downloaded.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function undo() {
    setScenario(undoScenario(scenario));
    setStep("edit");
    setPlacing(false);
    materialDirty();
  }
  const pathChanges = proposed.destinations.map(after => ({after, before: baseline.destinations.find(item => item.id === after.id)!})).sort((a,b) => Number(b.before.status !== b.after.status) - Number(a.before.status !== a.after.status));
  const newProblems = pathChanges.filter(({before, after}) => before.status === "reachable" && after.status !== "reachable");
  const improved = pathChanges.filter(({before, after}) => before.status !== "reachable" && after.status === "reachable");
  const reviewed = step === "compare" || step === "done";
  const selectedRecord = selectedFeature && 'evidence' in selectedFeature ? selectedFeature.evidence : [];
  const selectedBounds = selectedFeature && 'bounds' in selectedFeature ? selectedFeature.bounds : null;
  const candidateSpots = useMemo(() => (understanding?.candidates ?? analysisResult?.spots.map(item => item.id) ?? [])
    .filter(id => inventory.some(item => item.id === id)).slice(0, 3).map(id => ({id, label: site.features.find(item => item.id === id)?.name.en ?? id})), [understanding, analysisResult, inventory, site]);
  const categoryNames: Record<string, string> = {'path-blocked':'Blocked path','steps-or-slope':'Steps or slope','seating-or-shade':'Seating or shade','signs-or-language':'Signs or language',facilities:'Facilities',other:'Other'};
  const resultCard: AIResult | undefined = understanding && (understanding.status === 'ready' || understanding.status === 'unsure') ? {
    messageType: understanding.kind ? understanding.kind[0].toUpperCase() + understanding.kind.slice(1) : 'Not sure',
    issueType: understanding.category ? categoryNames[understanding.category] : '',
    state: understanding.status === 'ready' ? 'matched' : 'not-sure', spots: candidateSpots,
  } : analysisResult;
  const pins = useMemo(() => section === 'messages' ? candidateSpots : confirmation ? confirmation.targets.map(item => ({id: item.id, label: site.features.find(spot => spot.id === item.id)?.name.en ?? item.id})) : [], [section, candidateSpots, confirmation, site]);
  const cue = thinking ? "Reading the visitor’s message."
    : section === 'place' ? selected ? "This spot can be linked to a message or a plan." : "Select a spot to look closer, or bring in a visitor’s message."
    : section === 'messages' ? step === 'confirm' ? understanding?.status === 'unavailable' ? "Choose the spot yourself. AI isn’t available on this device yet." : "Check the suggested spot before planning a fix." : "Start with the visitor’s own words."
    : placing ? "Tap a new position to check it."
    : plan ? "Your plan is saved on this device."
    : reviewed ? newProblems.length ? "This fix creates another blocked path. Check it before saving." : improved.length ? "The path check improved. Review the result before saving." : "No path improved. Try another position or keep it for review."
    : confirmation ? "Preview a fix. Nothing here changes the real place." : "Choose a spot to start a plan.";
  async function readMessage() {
    const ticket = ++request.current;
    setThinking(true); setError(''); setUnderstanding(null); setSelected(null);
    try {
      const result = await understand(message, site);
      if (ticket !== request.current) return;
      if (result.status === 'invalid') {setError('Add a shorter message with some words.'); return;}
      setUnderstanding(result); setMode('concern'); setConfirmation(null); setOrigin(null);
      setScenario(createScenario(scene, profile)); setComparison('proposed'); materialDirty();
      setSelected(result.status === 'ready' && result.candidates[0] && inventory.some(item => item.id === result.candidates[0]) ? result.candidates[0] : null);
      setStep('confirm');
    } catch { if (ticket === request.current) {setConfirmation(null); setOrigin(null); setScenario(createScenario(scene, profile)); materialDirty(); setUnderstanding({status:'unavailable',kind:null,category:null,candidates:[],reason:'model-failed'}); setStep('confirm'); setMode('concern');} }
    finally { if (ticket === request.current) setThinking(false); }
  }
  async function loadModel() {
    setPreparingModel(true); setError('');
    try {setModel(await prepareModel(setModel));} catch {setError('AI could not be prepared. You can choose the spot yourself.');}
    finally {setPreparingModel(false);}
  }
  function switchSection(next: PlaceView) {setSection(next); setPlacing(false); setError('');}
  function selectSpot(id: string) {setSelected(id); setError('');}
  function retryChange() {
    setScenario(createScenario(scene, profile)); setStep("edit"); setPlacing(false); setSelected(target); setComparison("proposed"); materialDirty();
  }
  const spotPicker = <><label className="canvas-label" htmlFor="feature-choice">Choose a spot</label><select id="feature-choice" value={selected ?? ''} onChange={event => selectSpot(event.target.value)}><option value="" disabled>Select on the map or here</option>{inventory.map(item => <option key={item.id} value={item.id}>{nameOf(item.id)}</option>)}</select></>;
  const selectedDetails = selectedFeature && <details className="feature-facts"><summary>Spot details</summary>
    {selectedBounds && <p>{(selectedBounds.maxX-selectedBounds.minX).toFixed(1)} × {(selectedBounds.maxY-selectedBounds.minY).toFixed(1)} m footprint</p>}
    {selectedRecord.map((text,index) => <p key={index}>{text}</p>)}
    {'reason' in selectedFeature && <p>{selectedFeature.reason}</p>}
  </details>;
  const messagesOverview = <>
    <span className="place-kicker">Visitor message</span><h1>What did they say?</h1>
    <label className="sr-only" htmlFor="visitor-message">Original visitor message</label>
    <textarea id="visitor-message" value={message} maxLength={4000} placeholder="Paste or type their message…" onChange={event => {
      request.current++; setThinking(false); setMessage(event.target.value); setUnderstanding(null); setStep('message');
      if (/[\uac00-\ud7af]/.test(event.target.value)) setLanguage('ko');
    }} />
    <label className="canvas-label" htmlFor="message-language">Message language</label>
    <select id="message-language" value={language} onChange={event => setLanguage(event.target.value)}><option value="en">English</option><option value="es">Español</option><option value="ko">한국어</option><option value="qu">Runasimi</option><option value="other">Other</option></select>
    <div className="canvas-actions"><button className="primary" disabled={!message.trim() || thinking} onClick={() => void readMessage()}>{thinking ? 'Reading message…' : 'Find the spot'}</button></div>
    <p className="canvas-note">Kept on this device.</p>
    {model.status !== 'ready' && <details className="feature-facts"><summary>Use AI on this device</summary><p>Prepare it once while connected. You can also choose a spot yourself.</p><div className="canvas-actions"><button disabled={preparingModel} onClick={() => void loadModel()}>{preparingModel ? model.status === 'downloading' ? `${Math.round(model.loadedBytes / 1_000_000)} / ${Math.round(model.totalBytes / 1_000_000)} MB` : 'Preparing AI…' : 'Download AI (about 147 MB)'}</button></div></details>}
  </>;
  const placeOverview = <>
    <span className="place-kicker">Look around</span><h1>{site.name.en}</h1>
    <p className="place-copy">{site.place || 'An editable example'}</p>
    <ul className="spot-list" aria-label="Paths to destinations">{proposed.destinations.map(item => <li key={item.id}><button aria-pressed={selected === item.id} onClick={() => selectSpot(item.id)}><span className="spot-symbol" aria-hidden="true">◇</span><span>{nameOf(item.id)}</span><span className={`spot-state result-${item.status}`}>{outcome(item.status)}</span></button></li>)}</ul>
    <div className="canvas-actions"><button className="primary" onClick={() => {setSection('messages'); if (step === 'start') setStep('message');}}>Add a visitor message</button></div>
    {spotPicker}<p className="canvas-note">Path check on an example. Select a spot for details.</p>
  </>;
  const changesOverview = <>
    <span className="place-kicker">Plan a fix</span><h1>{confirmation ? nameOf(target!) : 'No fixes yet'}</h1>
    {!confirmation ? <><p className="place-copy">Start with a message or select a spot on the map.</p><div className="canvas-actions"><button className="primary" onClick={() => switchSection('place')}>Explore the place</button></div></> : <>
      {origin?.kind === 'concern' && <blockquote>{origin.originalText}</blockquote>}
      {scenario.operations.length > 0 && <p className="place-copy">{scenario.operations.at(-1)?.kind === 'remove' ? 'Remove from this position' : 'Move to a new position'}</p>}
      <table className="canvas-comparison" aria-label="All path results"><thead><tr><th>Path to</th><th>Before</th><th>After</th></tr></thead><tbody>{pathChanges.map(({before, after}) => <tr key={after.id} className={before.status === 'reachable' && after.status !== 'reachable' ? 'new-problem' : ''}><td>{nameOf(after.id)}</td><td className={`result-${before.status}`}>{outcome(before.status)}</td><td className={`result-${after.status}`}>{outcome(after.status)}</td></tr>)}</tbody></table>
      {newProblems.length > 0 && <p className="guide-error" role="status">New problem: {newProblems.map(({after}) => nameOf(after.id)).join(', ')}</p>}
      <div className="canvas-comparison-switch" aria-label="Compare scene"><button aria-pressed={comparison === 'original'} onClick={() => setComparison('original')}>Before</button><button aria-pressed={comparison === 'proposed'} onClick={() => setComparison('proposed')}>After</button></div>
      <p className="canvas-note">Checks the proposed layout, not work done on site.</p>
    </>}
  </>;
  const inspector = section === 'place' ? selectedFeature && <>
    <div className="place-inspector-head"><span className="place-kicker">Selected spot</span><button className="place-dismiss" onClick={() => setSelected(null)} aria-label="Close spot details">×</button></div>
    <h2>{nameOf(selectedFeature.id)}</h2><p className="place-copy">{site.features.find(item => item.id === selected)?.description}</p>
    <div className="canvas-actions"><button className="primary" onClick={() => {setMode('proactive'); begin('proactive');}}>Plan a fix</button><button onClick={() => {setSection('messages'); setStep('message');}}>Link a visitor message</button></div>{selectedDetails}
  </> : section === 'messages' ? (step === 'confirm' || thinking) && <>
    <span className="place-kicker">{thinking ? 'Reading message' : 'Check the spot'}</span><h2>{thinking ? 'Finding the right spot…' : 'Which spot is it about?'}</h2>
    {resultCard && !thinking && <AIResultCard result={resultCard} selectedId={selected} onSpot={selectSpot} onNotSure={() => setSelected(null)} />}
    {!thinking && <>{understanding?.status === 'unavailable' && <p className="place-copy">AI isn’t available. Choose a spot to continue.</p>}{spotPicker}<div className="canvas-actions"><button className="primary" disabled={!selectedFeature} onClick={confirm}>Yes, this spot</button></div>{selectedDetails}</>}
  </> : confirmation || step === 'confirm' ? <>
    <span className="place-kicker">{plan ? 'Saved plan' : reviewed ? 'Review the fix' : 'Try a position'}</span>
    {step === 'confirm' ? <><h2>{selected ? nameOf(selected) : 'Choose a spot'}</h2>{spotPicker}<div className="canvas-actions"><button className="primary" disabled={!selectedFeature} onClick={confirm}>Plan this fix</button></div></>
    : plan ? <><h2>Plan saved.</h2><p className="place-copy">{title}</p><label className="canvas-label" htmlFor="visitor-reply">Reply to the visitor</label><select id="visitor-reply" value={language} onChange={event => setLanguage(event.target.value)}><option value="en">English</option><option value="es">Español</option><option value="ko">한국어</option><option value="qu">Runasimi</option><option value="other">Other</option></select><blockquote>{language === 'ko' ? '알려 주셔서 감사합니다. 말씀하신 장소를 확인하고 개선 계획을 세웠습니다.' : language === 'es' ? 'Gracias por avisarnos. Revisamos el lugar y preparamos un plan para mejorarlo.' : 'Thank you for letting us know. We reviewed the spot and made a plan to improve it.'}</blockquote><p className="canvas-note">Pre-written reply{language === 'ko' ? ' · Korean wording needs review' : language !== 'en' && language !== 'es' ? ' · English fallback' : ''}</p><div className="canvas-actions"><button className="primary" onClick={() => void navigator.clipboard.writeText(language === 'ko' ? '알려 주셔서 감사합니다. 말씀하신 장소를 확인하고 개선 계획을 세웠습니다.' : language === 'es' ? 'Gracias por avisarnos. Revisamos el lugar y preparamos un plan para mejorarlo.' : 'Thank you for letting us know. We reviewed the spot and made a plan to improve it.').then(() => setNotice('Reply copied.')).catch(() => setError('Copy the reply text above. Clipboard access is unavailable.'))}>Copy reply</button><button onClick={retryChange}>Try another fix</button><button onClick={backup}>Download backup</button></div></>
    : reviewed ? <><h2>{newProblems.length ? 'A new path is blocked.' : improved.length ? 'Review your fix.' : 'The path check is unchanged.'}</h2><div className="canvas-actions"><button className={newProblems.length ? '' : 'primary'} onClick={save}>Save plan</button><button className={newProblems.length ? 'primary' : ''} onClick={retryChange}>Try another position</button></div><label className="canvas-label" htmlFor="plan-notes">Note for this plan</label><textarea id="plan-notes" value={notes} onChange={event => {setNotes(event.target.value); dirty();}} maxLength={4000} placeholder="What needs checking on site?" /></>
    : <><h2>{placing ? 'Choose a position on the map.' : editable ? `Move ${nameOf(target!).toLowerCase()}` : 'Keep this for review.'}</h2><div className="canvas-actions">
      {editable ? <>{!placing && site.placements.filter(item => item.featureId === target).map((item,index) => <button key={index} className={index === 0 ? 'primary' : ''} onClick={() => edit({kind:'move',objectId:target!,to:item.to})}>{item.name.en}</button>)}
        <button onClick={() => {setSelected(target); viewBeforePlacement.current = view; setPlacing(true); setView('map'); setComparison('proposed');}}>Choose on map</button>
        {placing && <><button onClick={() => placementDialog.current?.showModal()}>Enter a position</button><button onClick={() => {setPlacing(false); setView(viewBeforePlacement.current);}}>Cancel move</button></>}
        <button onClick={() => edit({kind:'remove',objectId:target!})}>Remove from this position</button>
      </> : <button className="primary" onClick={() => setStep('compare')}>Review plan</button>}
    </div></>}
  </> : null;
  return (
    <PlaceCanvas title={site.name.en} view={section} onView={switchSection} onHome={onHome} sceneRef={stageRef} dialogueRef={dockRef}
      tools={<><button className="view-mode" aria-pressed={view === 'map'} onClick={() => setView(view === 'map' ? '3d' : 'map')}>{view === 'map' ? 'Map' : '3D'}</button><button ref={optionsButton} popoverTarget={optionsId} aria-label="Scene options">Options</button></>}
      scene={<><SpatialView controlsTarget={controlsTarget} returnFocus={() => optionsButton.current?.focus()} rotation={rotation} onRotationChange={setRotation}
        scene={comparison === 'original' ? scene : applied} result={comparison === 'original' ? baseline : proposed} selectedId={selected} onSelect={selectSpot} view={view} compact evidenceScene={scene}
        onPlace={placing ? point => edit({kind:'move',objectId:target!,to:point}) : undefined} />
        <ScenePins stageRef={stageRef} spots={pins} selectedId={selected} onSelect={selectSpot} revision={`${view}:${rotation}:${comparison}:${scenario.operations.length}`} /></>}
      overview={section === 'place' ? placeOverview : section === 'messages' ? messagesOverview : changesOverview}
      inspector={inspector && <>{inspector}{error && <p className="guide-error" role="alert">{error}</p>}{notice && <p className="guide-notice" role="status">{notice}</p>}</>}
      dialogue={<p role="status">{cue}</p>}>
      {!inspector && error && <p className="canvas-toast guide-error" role="alert">{error}</p>}
      <ContextualGuide stageRef={stageRef} dockRef={dockRef} selectedId={section === 'messages' && step === 'confirm' ? selected : null}
        revision={`${section}:${step}:${view}:${rotation}:${scenario.operations.length}:${comparison}:${placing}`} tone={section === 'messages' ? 'evidence' : section === 'changes' ? 'review' : 'guide'} />
      <div popover="auto" id={optionsId} ref={options} className="scene-options" onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) options.current?.hidePopover();
      }}>
        <p>{site.name.en} <span>Authored example</span></p>
        <div className="segmented" aria-label="Workspace view">
          {(["map", "3d", "split"] as const).map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => {
                setView(v);
                if (v !== "map") setPlacing(false);
              }}
            >
              {v === "map" ? "Map" : v === "3d" ? "3D" : "Split"}
            </button>
          ))}
        </div>
        {scenario.operations.length > 0 && (
          <div className="scenario-tools">
            <button className="quiet-button" onClick={undo}>
              Undo fix
            </button>
          </div>
        )}

        <div ref={setControlsTarget} />
        <div className="scene-options-links"><button onClick={() => details.current?.showModal()}>Details</button><button onClick={onHome} aria-label="Home">Return home</button></div>
      </div>
      <dialog onClose={() => optionsButton.current?.focus()} ref={details} className="guide-dialog" aria-label="Plan details">
        <header>
          <h2>Plan details</h2>
          <button
            onClick={() => details.current?.close()}
            aria-label="Close details"
          >
            ×
          </button>
        </header>
        <p className="subtle-line">
          All geometry in this example is authored. No real site has been
          measured.
        </p>
        <label>
          Plan title
          <input
            value={title}
            maxLength={160}
            onChange={(e) => {
              setTitle(e.target.value);
              dirty();
            }}
          />
        </label>
        <label>
          Decision
          <select
            aria-label="Decision"
            value={decision}
            onChange={(e) => {
              setDecision(e.target.value as ImprovementPlan["decision"]);
              dirty();
            }}
          >
            <option value="planned">Proposed</option>
            <option value="approved">Approved for action</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label>
          Next actions and unresolved questions
          <textarea
            rows={3}
            value={notes}
            maxLength={4000}
            onChange={(e) => {
              setNotes(e.target.value);
              dirty();
            }}
          />
        </label>
        {origin?.kind === "concern" && (
          <details>
            <summary>Original visitor message</summary>
            <p>{origin.originalText}</p>
            <p>Private report · kept on this device.</p>
          </details>
        )}
        <details>
          <summary>Movement requirements</summary>
          <p>
            Illustrative square envelope; not a wheelchair prescription or
            regulatory standard.
          </p>
          <div className="field-row">
            <label>
              Width (m)
              <input
                aria-label="Square width in metres"
                type="number"
                step="0.1"
                value={profile.width}
                onChange={(e) =>
                  changeProfile({ ...profile, width: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Headroom (m)
              <input
                aria-label="Headroom in metres"
                type="number"
                step="0.1"
                value={profile.height}
                onChange={(e) =>
                  changeProfile({ ...profile, height: Number(e.target.value) })
                }
              />
            </label>
          </div>
          {(
            [
              "turning",
              "longitudinalSlope",
              "crossSlope",
              "multilevel",
            ] as const
          ).map((k) => (
            <label className="check-row" key={k}>
              <input
                type="checkbox"
                checked={profile.requirements[k]}
                onChange={(e) =>
                  changeProfile({
                    ...profile,
                    requirements: {
                      ...profile.requirements,
                      [k]: e.target.checked,
                    },
                  })
                }
              />
              {
                {
                  turning: "Turning",
                  longitudinalSlope: "Slope",
                  crossSlope: "Cross-slope",
                  multilevel: "Movement between levels",
                }[k]
              }{" "}
              required (unsupported)
            </label>
          ))}
        </details>
        <details>
          <summary>What this check includes</summary>
          <p>
            {baseline.reachableArea.toFixed(2)} m² connected originally;{" "}
            {proposed.reachableArea.toFixed(2)} m² proposed. These are
            envelope-centre assessment areas, not usable floor area. Unknown:{" "}
            {proposed.unknownArea.toFixed(2)} m².
          </p>
          <ul>
            {[...proposed.unsupported, ...proposed.assumptions].map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p>
            Approving a plan does not mean physical work has been completed.
          </p>
        </details>
        {confirmation && (
          <button
            className="primary"
            onClick={() => {
              save();
              details.current?.close();
            }}
          >
            Save plan
          </button>
        )}
      </dialog>
      <dialog
        ref={placementDialog}
        className="guide-dialog"
        aria-label="Exact placement"
      >
        <header>
          <h2>Place the object</h2>
          <button
            onClick={() => placementDialog.current?.close()}
            aria-label="Close placement"
          >
            ×
          </button>
        </header>
        <p>
          Minimum X/Y corner in metres. The position must fit known support.
        </p>
        <div className="field-row">
          <label>
            X (m)
            <input
              type="number"
              step="0.1"
              value={move.x}
              onChange={(e) => setMove({ ...move, x: e.target.value })}
            />
          </label>
          <label>
            Y (m)
            <input
              type="number"
              step="0.1"
              value={move.y}
              onChange={(e) => setMove({ ...move, y: e.target.value })}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="guide-error">
            {error}
          </p>
        )}
        <button
          className="primary"
          onClick={() => {
            if (!move.x.trim() || !move.y.trim()) {
              setError("Enter both coordinates.");
              return;
            }
            edit({
              kind: "move",
              objectId: target!,
              to: { x: Number(move.x), y: Number(move.y) },
            });
          }}
        >
          Preview move
        </button>
      </dialog>
    </PlaceCanvas>
  );
}
